/**
 * 服务证明（`service_certificates`）—— 签发 / 查询 / 验真（投影裁剪）/ 作废（软删）。
 *
 * 设计依据：`deliverables/software-company/volunteer-service-hours-design.md`
 * （§4.1 DDL / §4.3 端点 #2–#4 / §5.2 时序② / §10-Q6 编号 / §8 T9·T15）。
 *
 * 硬约束（违反即缺陷）：
 * - `user_id` **只来自 token**（由路由传入，本模块绝不读请求体）；
 * - 区间聚合口径**复用** `serviceLog.buildBreakdown()`（唯一权威口径），不另写一份 SQL；
 * - 验真**投影裁剪为 5 字段、零 PII**（`verify()` 的 SQL **不 SELECT** 身份列）；
 * - 作废**软删留痕**（`status='revoked'`、不物理删除），且覆盖区间的台账行**软删**（留痕、不物理删，T9）；
 * - `cert_no` 唯一靠 `UNIQUE(cert_no)` 索引 + **撞库重试**（Q6，无校验位）。
 */
import db, { get, all } from '../db'
import { genId, buildBreakdown } from './serviceLog'
import type {
  ServiceCertificateView,
  ServiceCertificateListItem,
  ServiceCertificateVerifyView,
} from '../types'
import type { ServiceCertificateRow } from '../types/rows'

/** 证明编号前缀（Q6/N3：默认固定 `VS-`，不引入多租户可配）。 */
export const CERT_NO_PREFIX = 'VS-'

/** 撞库重试上限（Q6：日期内 36⁶ ≈ 21.7 亿组合，重试 5 次足够）。 */
const CERT_NO_MAX_ATTEMPTS = 5

/** 两位补零（手写，不依赖 locale，照 `govExport.ts` 的既有取向）。 */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** `YYYYMMDD`（**本地时间**、手写补零、不依赖 locale —— 与 `govExport.ts` 的确定性取向一致）。 */
function formatYmd(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
}

/** 6 位大写 base36 随机后缀。 */
function randomSuffix(): string {
  let s = ''
  while (s.length < 6) s += Math.random().toString(36).slice(2)
  return s.slice(0, 6).toUpperCase()
}

/**
 * 生成证明编号 `VS-YYYYMMDD-<6位base36大写>`（Q6）。
 * 唯一性由 `UNIQUE(cert_no)` + **撞库重试**保证，编号本身**不含校验位**。
 */
export function genCertNo(now: number): string {
  return `${CERT_NO_PREFIX}${formatYmd(now)}-${randomSuffix()}`
}

/** 判定是否为 `UNIQUE` 约束冲突（用于撞库重试；其它错误一律上抛，不吞）。 */
function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string })?.code
  const msg = e instanceof Error ? e.message : String(e)
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint failed/i.test(msg)
}

/** `issue()` 入参。 */
export interface IssueCertificateInput {
  /** 身份，**必须**由调用方从 token 派生。 */
  userId: string
  /** 区间起点（epoch 毫秒，含）。 */
  fromMs: number
  /** 区间终点（epoch 毫秒，不含）。 */
  toMs: number
  /** 签发人：`self`（本人）/ `org_admin`（机构代发）。默认 `self`。 */
  issuedBy?: 'self' | 'org_admin'
  /** 签发时刻；供测试注入确定性时间。默认 `Date.now()`。 */
  now?: number
}

/**
 * 签发一份证明（§5.2：区间聚合 → 生成编号 → 落库）。
 *
 * @returns 证明对象；**区间内无可用服务记录（`total === 0`）⇒ `null`**（路由据此返回 400）。
 */
export function issue(input: IssueCertificateInput): ServiceCertificateView | null {
  // 唯一权威口径：只统计「已闭合 ∧ is_drill=0 ∧ status='confirmed' ∧ started_at_ms ∈ [from, to)」。
  const { totalMinutes, breakdown } = buildBreakdown(input.userId, input.fromMs, input.toMs)
  if (totalMinutes <= 0) return null

  const now = input.now ?? Date.now()
  const issuedBy = input.issuedBy ?? 'self'
  const id = genId('sc')

  for (let attempt = 0; attempt < CERT_NO_MAX_ATTEMPTS; attempt++) {
    const certNo = genCertNo(now)
    try {
      db.prepare(
        `INSERT INTO service_certificates
           (id, user_id, cert_no, period_from_ms, period_to_ms, total_minutes, breakdown_json,
            issued_at_ms, issued_by, status, revoked_at_ms, revoke_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, '')`
      ).run(
        id, input.userId, certNo, input.fromMs, input.toMs, totalMinutes,
        JSON.stringify(breakdown), now, issuedBy
      )
      return {
        certNo,
        periodFromMs: input.fromMs,
        periodToMs: input.toMs,
        totalMinutes,
        breakdown,
        issuedAtMs: now,
        status: 'active',
      }
    } catch (e) {
      // 撞库 ⇒ 重试；其余错误上抛（绝不吞异常）
      if (isUniqueViolation(e) && attempt < CERT_NO_MAX_ATTEMPTS - 1) continue
      throw e
    }
  }
  // 理论上不可达（循环内要么 return 要么 throw）；兜底显式报错，不静默。
  throw new Error('无法生成唯一证明编号')
}

/** 我的证明列表（按签发时间倒序；含已作废项，`status` 区分）。 */
export function listMine(userId: string): ServiceCertificateListItem[] {
  const rows = all<Pick<ServiceCertificateRow,
    'cert_no' | 'period_from_ms' | 'period_to_ms' | 'total_minutes' | 'status' | 'issued_at_ms'>>(
    `SELECT cert_no, period_from_ms, period_to_ms, total_minutes, status, issued_at_ms
     FROM service_certificates WHERE user_id = ? ORDER BY issued_at_ms DESC`,
    userId
  )
  return rows.map((r) => ({
    certNo: r.cert_no,
    periodFromMs: r.period_from_ms,
    periodToMs: r.period_to_ms,
    totalMinutes: r.total_minutes,
    status: r.status,
    issuedAtMs: r.issued_at_ms,
  }))
}

/**
 * 编号验真（**公开**）。**投影裁剪为 5 字段、零 PII**（T15）。
 *
 * ⚠️ SQL **只 SELECT 这 5 列** —— 不是「查全表再删字段」。列不存在就不可能泄漏。
 *
 * @returns 5 字段视图；编号不存在 ⇒ `null`（路由返回 404）。
 */
export function verify(certNo: string): ServiceCertificateVerifyView | null {
  const row = get<Pick<ServiceCertificateRow,
    'cert_no' | 'period_from_ms' | 'period_to_ms' | 'total_minutes' | 'status'>>(
    `SELECT cert_no, period_from_ms, period_to_ms, total_minutes, status
     FROM service_certificates WHERE cert_no = ?`,
    certNo
  )
  if (!row) return null
  return {
    certNo: row.cert_no,
    periodFromMs: row.period_from_ms,
    periodToMs: row.period_to_ms,
    totalMinutes: row.total_minutes,
    status: row.status,
  }
}

/**
 * 作废证明（**软删**，硬约束 #6）。
 *
 * 语义（T9）：① 证明本身 `status='revoked'` + `revoked_at_ms` + `revoke_reason` 留痕（**不物理删**，
 * 验真仍能查到「存在且已撤销」）；② 该证明覆盖区间内的台账行**软删**（`status='voided'` + 留痕）
 * ⇒ 该分钟数从**后续**证明中消失，但**原台账行仍在**（不物理删）。
 *
 * @returns `true` = 本次真正作废（仅 `active` 可作废；不存在 / 已作废 ⇒ `false`）。
 */
export function revoke(certId: string, reason = '', now: number = Date.now()): boolean {
  const cert = get<Pick<ServiceCertificateRow,
    'user_id' | 'period_from_ms' | 'period_to_ms' | 'status'>>(
    `SELECT user_id, period_from_ms, period_to_ms, status FROM service_certificates WHERE id = ?`,
    certId
  )
  if (!cert || cert.status !== 'active') return false

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE service_certificates SET status = 'revoked', revoked_at_ms = ?, revoke_reason = ?
       WHERE id = ? AND status = 'active'`
    ).run(now, reason, certId)
    // 台账**软删**（留痕、不物理删）：使该分钟数从后续证明中消失（T9 后半）。
    db.prepare(
      `UPDATE volunteer_service_logs SET status = 'voided', voided_at_ms = ?, void_reason = ?
       WHERE user_id = ? AND started_at_ms >= ? AND started_at_ms < ? AND status = 'confirmed'`
    ).run(now, reason || 'certificate_revoked', cert.user_id, cert.period_from_ms, cert.period_to_ms)
  })
  tx()
  return true
}
