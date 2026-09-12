/**
 * 阿里云短信状态报告（SmsReport）处理 + 语音降级触发（P1）
 *
 * **前提已按官方文档核实**（2026）：
 * - 推送载体：**HTTP 批量推送模式**，`POST application/json (UTF-8)`，报文体为 **JSON Array**（单次可含多条）。
 * - 字段有**两套形态**（需容错）：国内 `success:(Boolean)`/`err_code`/`biz_id`/`phone_number`；
 *   国际/批量推送模式 `Status:("1"/"2"/"6")`/`ErrorCode`/`MessageId`/`To`。
 * - **响应体硬要求**：必须 `HTTP 200` 且 body 为 `{"code":<数字>,...}`，否则阿里云重推（1/5/10 分钟，最多 3 次）。
 * - 阿里云明确「回执消息**无法保证幂等**」⇒ 幂等由本模块保证。
 *
 * 安全 / 纪律：
 * - **号码绝不取自回调 payload**：只按 `custodian_user_id` 回本库重新解析（防伪造回调让我方呼叫任意号码）。
 * - **仅 `FAIL` 才呼语音**；`SUCCESS`/`UNKNOWN` 只记录。
 * - **每行最多呼一次**（`voice_state` 落库即防重）；另有**全局日上限**（`app_meta` 计数）防回调滥用。
 * - 日志**不含完整号码**。
 */

import db, { get } from '../db'
import { resolveCustodianPhone } from './custodianPhone'
import { isVoiceConfigured, sendVoiceCall } from './voiceService'
import { logAudit } from './aedAudit'

/** 单次推送最多处理的报告条数（防畸形报文撑爆循环；鉴权已挡外部）。 */
export const MAX_REPORTS_PER_REQUEST = 100

/** 语音每日全局上限（成本护栏）；可用 env `ALIYUN_VOICE_DAILY_LIMIT` 覆盖（测试用）。 */
function dailyLimit(): number {
  const n = parseInt(process.env.ALIYUN_VOICE_DAILY_LIMIT || '', 10)
  return Number.isFinite(n) && n > 0 ? n : 200
}

/** 对外暴露当日上限（供管理看板读取；避免重复实现）。 */
export function getVoiceDailyLimit(): number {
  return dailyLimit()
}

export type SmsReportStatus = 'SUCCESS' | 'FAIL' | 'UNKNOWN'

export interface SmsReportItem {
  /** 对账键：国内 `biz_id` / 国际 `MessageId`；缺失为空串。 */
  bizId: string
  status: SmsReportStatus
  errCode?: string
  errMsg?: string
  /** 回调 payload 里的号码（**不采信**，仅用于脱敏日志对账）。 */
  rawPhone?: string
}

function str(v: unknown): string {
  if (typeof v === 'string') return v
  if (v == null) return ''
  return String(v)
}

/** 成败判定：`success` 布尔（国内）优先，其次 `Status` "1"成功/"2"失败/"6"失效（国际/批量推送）。 */
function deriveStatus(o: Record<string, unknown>): SmsReportStatus {
  if (o.success === true || o.success === 'true') return 'SUCCESS'
  if (o.success === false || o.success === 'false') return 'FAIL'
  const s = o.Status === undefined ? undefined : String(o.Status)
  if (s === '1') return 'SUCCESS'
  if (s === '2' || s === '6') return 'FAIL'
  return 'UNKNOWN'
}

/**
 * 解析 SmsReport 报文体（**纯函数**，双形态容错）。
 * 接受 **JSON Array**（官方形态）或单对象；缺字段 / 未知 → `UNKNOWN`，`bizId` 为空串。
 */
export function parseSmsReports(body: unknown): SmsReportItem[] {
  const arr: unknown[] = Array.isArray(body)
    ? body
    : body && typeof body === 'object'
      ? [body]
      : []

  return arr.map((raw): SmsReportItem => {
    if (!raw || typeof raw !== 'object') return { bizId: '', status: 'UNKNOWN' }
    const o = raw as Record<string, unknown>
    return {
      bizId: str(o.biz_id ?? o.MessageId ?? o.bizId),
      status: deriveStatus(o),
      errCode: str(o.err_code ?? o.ErrorCode) || undefined,
      errMsg: str(o.err_msg ?? o.ErrorDescription) || undefined,
      rawPhone: str(o.phone_number ?? o.To) || undefined,
    }
  })
}

interface DispatchRow {
  id: string
  biz_id: string
  alert_id: string
  custodian_user_id: string
  report_status: string
  voice_state: string
  voice_at_ms: number | null
}

function todayKey(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `voice_daily_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 读取指定 key 的当日计数。 */
function readDailyCount(key: string): number {
  const r = get<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', key)
  return r ? parseInt(r.value, 10) || 0 : 0
}

/** 当日已呼次数（`app_meta` 计数）。 */
export function getVoiceDailyCount(): number {
  return readDailyCount(todayKey())
}

/**
 * 原子「预留」一个当日呼叫名额：**读 + 判上限 + 自增** 收进**同一个同步事务**（better-sqlite3），
 * 内部**无 `await`** ⇒ Node 单线程下不会被并发交错（消除 check-then-act 的 TOCTOU 竞态）。
 *
 * 口径：**预留计数**（在**即将发起呼叫时**自增，而非呼叫返回后）；失败呼叫**不回收**名额
 * —— 对「成本护栏」而言，按"发起次数"计数更正确（避免失败呼叫被反复重试无限占用成本）。
 */
const reserveVoiceSlotTx = db.transaction((key: string, limit: number): boolean => {
  const cur = readDailyCount(key)
  if (cur >= limit) return false
  db.prepare(
    `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, String(cur + 1), Date.now())
  return true
})

/** 原子预留一个当日名额；已满返回 false。 */
function reserveVoiceSlot(): boolean {
  return reserveVoiceSlotTx(todayKey(), dailyLimit())
}

export interface SmsReportHandleResult {
  /** 是否命中本地 dispatch 行（未知 biz_id → false）。 */
  matched: boolean
  /** 本次是否真正**发起**了语音呼叫。 */
  voiced: boolean
  /** 结果说明（no_op / not_failed / already_handled / voice_not_configured / daily_cap / no_phone / called / failed）。 */
  reason: string
}

/**
 * 处理**单条**状态报告：记录报告状态 + 按需触发语音降级（幂等）。
 *
 * 抛出（DB/未预期异常）由调用方（端点）转为 `500` 让阿里云重推；其余一律正常返回（端点 `200`）。
 */
export async function handleSmsReport(item: SmsReportItem): Promise<SmsReportHandleResult> {
  if (!item.bizId) return { matched: false, voiced: false, reason: 'no_biz_id' }

  const row = get<DispatchRow>('SELECT * FROM aed_sms_dispatches WHERE biz_id = ?', item.bizId)
  if (!row) return { matched: false, voiced: false, reason: 'unknown_biz_id' } // 未知 → 静默 no-op

  // 始终记录报告状态（含错误码），便于日后按错误码收窄策略
  db.prepare(`UPDATE aed_sms_dispatches SET report_status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(item.errCode || item.status, row.id)

  // 幂等：该行已触发过语音（voice_state !== 'none'）→ no-op
  if (row.voice_state !== 'none') return { matched: true, voiced: false, reason: 'already_handled' }
  // 仅 FAIL 才呼语音
  if (item.status !== 'FAIL') return { matched: true, voiced: false, reason: 'not_failed' }
  // 语音未配置 → 记录但不呼
  if (!isVoiceConfigured()) return { matched: true, voiced: false, reason: 'voice_not_configured' }

  // 号码**只从本库**解析（回调 payload 号码一律不采信）
  const alert = get<{ aed_id: string }>('SELECT aed_id FROM aed_custodian_alerts WHERE id = ?', row.alert_id)
  const device = alert
    ? get<{ name: string; custodian_phone: string }>('SELECT name, custodian_phone FROM aed_devices WHERE id = ?', alert.aed_id)
    : undefined
  const phone = resolveCustodianPhone(row.custodian_user_id, { custodian_phone: device?.custodian_phone || '' })

  if (!phone) {
    db.prepare(`UPDATE aed_sms_dispatches SET voice_state = 'no_phone', updated_at = datetime('now') WHERE id = ?`).run(row.id)
    return { matched: true, voiced: false, reason: 'no_phone' }
  }

  // 全局日上限（成本护栏）：**原子预留名额**（读+判+自增 同一同步事务，且在 `await` 呼叫**之前**）——
  // 名额按"发起次数"预留，呼叫失败**不回收**。此处放在号码解析之后，避免「无号码」白白占用名额。
  if (!reserveVoiceSlot()) return { matched: true, voiced: false, reason: 'daily_cap' }

  const r = await sendVoiceCall(phone, { device: device?.name || 'AED' })
  db.prepare(
    `UPDATE aed_sms_dispatches SET voice_state = ?, voice_at_ms = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(r.ok ? 'called' : 'failed', Date.now(), row.id)

  if (alert) {
    logAudit(
      alert.aed_id,
      'custodian_voice_fallback',
      `短信未送达，已语音呼叫责任人（呼叫：${r.ok ? 'called' : (r.reason || 'failed')}）`,
      '',
      '系统'
    )
  }
  return { matched: true, voiced: true, reason: r.ok ? 'called' : (r.reason || 'failed') }
}
