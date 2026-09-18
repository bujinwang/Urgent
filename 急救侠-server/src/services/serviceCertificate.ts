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
  ServiceHoursBreakdownItem,
  CertificateRecordStatus,
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
 * 取「同人 + 同区间」的既有 `active` 证明视图（★ v1.3 幂等签发用）。
 * `breakdown` 从 `breakdown_json` 还原（既有的快照）。
 */
function activeCertView(userId: string, fromMs: number, toMs: number): ServiceCertificateView | null {
  const row = get<Pick<ServiceCertificateRow,
    'cert_no' | 'period_from_ms' | 'period_to_ms' | 'total_minutes' | 'breakdown_json' | 'issued_at_ms' | 'status'>>(
    `SELECT cert_no, period_from_ms, period_to_ms, total_minutes, breakdown_json, issued_at_ms, status
     FROM service_certificates
     WHERE user_id = ? AND period_from_ms = ? AND period_to_ms = ? AND status = 'active'
     LIMIT 1`,
    userId, fromMs, toMs
  )
  if (!row) return null
  let breakdown: ServiceHoursBreakdownItem[] = []
  try { breakdown = JSON.parse(row.breakdown_json || '[]') } catch { breakdown = [] }
  return {
    certNo: row.cert_no,
    periodFromMs: row.period_from_ms,
    periodToMs: row.period_to_ms,
    totalMinutes: row.total_minutes,
    breakdown,
    issuedAtMs: row.issued_at_ms,
    status: 'active',
  }
}

/**
 * 签发一份证明（§5.2：区间聚合 → 生成编号 → 落库）。
 *
 * ★ v1.3 **幂等签发**：同 `(user_id, period_from_ms, period_to_ms)` 已有 `active` 证明时，
 * **直接返回既有证明**（不新建、不换编号）。该不变量由 DB 的**部分唯一索引** `idx_scert_active_dedup`
 * 兜底（并发下撞索引 ⇒ 回捞既有）。若既有证明已 `revoked`，则**允许新建**（新编号、同 `totalMinutes`）。
 *
 * @returns 证明对象；**区间内无可用服务记录（`total === 0`）⇒ `null`**（路由据此返回 400）。
 */
export function issue(input: IssueCertificateInput): ServiceCertificateView | null {
  // 幂等：已有 active ⇒ 原样返回既有（不新建、不换编号）
  const existing = activeCertView(input.userId, input.fromMs, input.toMs)
  if (existing) return existing

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
      if (!isUniqueViolation(e)) throw e // 非唯一冲突 ⇒ 上抛，绝不吞
      // 唯一冲突有两种来源：① `cert_no` 撞库 ⇒ 换号重试；② `idx_scert_active_dedup`（并发）⇒ 回捞既有。
      const dup = activeCertView(input.userId, input.fromMs, input.toMs)
      if (dup) return dup
      // 否则是 cert_no 撞库 ⇒ 继续循环换号
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

/** `revokeForUser()` 结果。`outcome` 供路由映射 HTTP 状态码。 */
export type RevokeOutcome = 'revoked' | 'already_revoked' | 'not_found' | 'forbidden'

/** `revokeForUser()` 返回。 */
export interface RevokeForUserResult {
  outcome: RevokeOutcome
  certNo: string
  /** 作废/已作废时给出最终状态。 */
  status?: CertificateRecordStatus
}

/**
 * 本人撤销自己的证明（★ v1.3 **语义 B**，§11.9）。
 *
 * ★ **只作废「证明本身」，台账完全不动** —— 「作废」在常识里是「**这张纸无效了**」，
 * **不是**「这段服务没发生」。故：`status='revoked'` + `revoked_at_ms` + `revoke_reason` 留痕（**不物理删**），
 * **绝不**触碰 `volunteer_service_logs`。
 * ⇒ 该区间时长**不受影响**、**仍可被后续新证明统计**（T34 权益主守卫）。
 *
 * 鉴权在**服务层**做归属校验（端点只负责取 token 身份）：
 * - 编号不存在 ⇒ `not_found`（路由 404）
 * - **非本人** ⇒ `forbidden`（路由 403；**先于**状态判断，确保非本人永远拿不到 200）
 * - 已作废 ⇒ `already_revoked`（幂等，路由仍 200）
 * - 其余 ⇒ 真正作废，返回 `revoked`
 *
 * @param userId 调用者身份（**只来自 token**）
 * @param certNo 证明编号
 * @param reason 作废原因（留痕）
 */
export function revokeForUser(userId: string, certNo: string, reason = '', now: number = Date.now()): RevokeForUserResult {
  const row = get<Pick<ServiceCertificateRow, 'user_id' | 'status'>>(
    `SELECT user_id, status FROM service_certificates WHERE cert_no = ?`,
    certNo
  )
  if (!row) return { outcome: 'not_found', certNo }
  if (row.user_id !== userId) return { outcome: 'forbidden', certNo }
  if (row.status !== 'active') return { outcome: 'already_revoked', certNo, status: 'revoked' }

  db.prepare(
    `UPDATE service_certificates SET status = 'revoked', revoked_at_ms = ?, revoke_reason = ?
     WHERE cert_no = ? AND status = 'active'`
  ).run(now, reason, certNo)
  return { outcome: 'revoked', certNo, status: 'revoked' }
}
