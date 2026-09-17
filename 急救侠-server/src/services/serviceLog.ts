/**
 * 志愿服务时长台账（`volunteer_service_logs`）—— **唯一权威写入口径 + 聚合读**。
 *
 * 设计依据：`deliverables/software-company/volunteer-service-hours-design.md`
 * （§3.2 架构 / §3.5 时长算法 / §4.1 DDL / §5.1 时序）。
 *
 * 为什么把 SQL 集中在此而不是散在路由里：
 * 1. **唯一权威口径**（§3.2）—— 所有展示 / 证明 / 导出只读本模块的聚合，杜绝「双真值」；
 * 2. **可突变验证** —— 若各调用点各写一份 SQL，测试只能断言**自己那份**，对生产路径做突变会**假绿**
 *    （同 `sosTelemetry.ts` 的教训）。T02 / T05 一律复用本模块。
 *
 * 硬约束（违反即缺陷）：
 * - `user_id` **只来自 token**（由调用方传入，本模块**绝不**读请求体）；
 * - 时长**服务端算**（`computeDurationMin`），**忽略**任何客户端传入的 `duration_min`；
 * - 幂等靠**数据库约束**（`idx_vsl_dedup` + `INSERT OR IGNORE` + `ended_at_ms IS NULL` 守卫），
 *   不做应用层「先查后插」。
 */
import db, { all, get } from '../db'
import type {
  ActivityType,
  ServiceSourceType,
  ServiceLogStatus,
  ServiceHoursView,
  ServiceHoursItem,
  ServiceHoursBreakdownItem,
} from '../types'
import type { VolunteerServiceLogRow } from '../types/rows'

/** 单次服务时长上限（分钟，D2/Q5）。超出 ⇒ 封顶 480 且 `status='pending'` 待人工确认。 */
export const MAX_SINGLE_MINUTES = 480

/**
 * 生成带**随机后缀**的主键。
 *
 * 前缀：`vsl_`（台账）/ `sc_`（证明）/ `tv_`（任务参与）。
 * ⚠️ **禁止纯 `Date.now()`** —— 同毫秒内多次写入会碰撞（`NEXT_STEPS.md:216`）。
 */
export function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

/**
 * 服务时长（分钟）= 起止时刻相减取整。**唯一实现**。
 *
 * @param startedMs 起始时刻（epoch 毫秒）
 * @param endedMs   结束时刻；`null` = 未闭合 ⇒ 返回 `null`（**不计入**，§10-Q3b）
 * @returns 非负整数分钟；时钟回拨时归零（防御性）
 */
export function computeDurationMin(startedMs: number, endedMs: number | null): number | null {
  if (endedMs == null) return null
  return Math.max(0, Math.round((endedMs - startedMs) / 60000))
}

/** `recordService()` 入参。 */
export interface RecordServiceInput {
  /** 身份，**必须**由调用方从 token 派生（本模块不读请求体）。 */
  userId: string
  activityType: ActivityType
  sourceType?: ServiceSourceType
  /** 关联事件 id；`system` 来源必填，`manual` 为空。 */
  sourceRef?: string
  startedAtMs: number
  /** `null` / 缺省 = 未闭合（不计入时长，`status='pending'`）。 */
  endedAtMs?: number | null
  isDrill?: boolean
  orgId?: string
  createdBy?: string
  /**
   * 状态覆盖（默认：闭合 ⇒ `confirmed`，未闭合 ⇒ `pending`）。
   * ⚠️ **封顶（>480）时无论如何都会被强制为 `pending`**（D2/Q5），此参数不能绕过。
   */
  status?: ServiceLogStatus
  /** 写入时刻（`created_at_ms`）；供测试注入确定性时间。默认 `Date.now()`。 */
  now?: number
}

/** `recordService()` 结果。`inserted=false` 表示被 `idx_vsl_dedup` 去重（未新增行）。 */
export interface RecordServiceResult {
  id: string
  inserted: boolean
  durationMin: number | null
  status: ServiceLogStatus
}

/**
 * 写入一条台账（**唯一权威写入口径**）。
 *
 * 幂等：`INSERT OR IGNORE` + 部分唯一索引 `idx_vsl_dedup(source_type, source_ref, user_id)`
 * （仅当 `source_ref <> ''` 生效）。系统来源 + 有事件 id 时，同一事件同一人只落一行。
 *
 * @returns 实际写入的 id 与是否新增；`durationMin` / `status` 为**服务端算定**的最终值。
 */
export function recordService(input: RecordServiceInput): RecordServiceResult {
  const sourceType: ServiceSourceType = input.sourceType ?? 'system'
  const sourceRef = input.sourceRef ?? ''
  const endedMs = input.endedAtMs ?? null
  const now = input.now ?? Date.now()

  const rawDuration = computeDurationMin(input.startedAtMs, endedMs)
  const capped = rawDuration != null && rawDuration > MAX_SINGLE_MINUTES
  const durationMin = capped ? MAX_SINGLE_MINUTES : rawDuration

  let status: ServiceLogStatus = input.status ?? (endedMs == null ? 'pending' : 'confirmed')
  if (capped) status = 'pending'

  const id = genId('vsl')
  const info = db.prepare(
    `INSERT OR IGNORE INTO volunteer_service_logs
       (id, user_id, activity_type, source_type, source_ref, started_at_ms, ended_at_ms,
        duration_min, is_drill, status, org_id, created_by, voided_at_ms, void_reason, created_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '', ?)`
  ).run(
    id, input.userId, input.activityType, sourceType, sourceRef, input.startedAtMs, endedMs,
    durationMin, input.isDrill ? 1 : 0, status, input.orgId ?? '', input.createdBy ?? '', now
  )

  return { id, inserted: info.changes === 1, durationMin, status }
}

/** `closeService()` 入参。 */
export interface CloseServiceInput {
  taskId: string
  /** 闭合时刻（epoch 毫秒）；由路由层用 `Date.now()` 传入，便于测试注入。 */
  endedMs: number
  now?: number
}

/** `closeService()` 结果。重复调用恒为 `{ closed: 0, minutes: 0 }`。 */
export interface CloseServiceResult {
  closed: number
  minutes: number
}

/**
 * 闭合某任务的**全部未闭合参与行**并为每人写一条台账（§5.1 时序）。
 *
 * 幂等（T18）：`UPDATE ... WHERE ended_at_ms IS NULL` 守卫 ⇒
 * 二次调用更新 **0 行** ⇒ 不写重复台账、时长不翻倍、`ended_at_ms` 不被覆盖。
 * 台账侧另有 `idx_vsl_dedup` 兜底（即便并发也只落一行）。
 *
 * @returns `closed` = 本次真正闭合的参与行数；`minutes` = 本次入账分钟之和。
 */
export function closeService(input: CloseServiceInput): CloseServiceResult {
  const rows = all<{ user_id: string; responded_at_ms: number }>(
    'SELECT user_id, responded_at_ms FROM task_volunteers WHERE task_id = ? AND ended_at_ms IS NULL',
    input.taskId
  )

  let closed = 0
  let minutes = 0
  for (const row of rows) {
    const upd = db.prepare(
      "UPDATE task_volunteers SET ended_at_ms = ?, status = 'closed' WHERE task_id = ? AND user_id = ? AND ended_at_ms IS NULL"
    ).run(input.endedMs, input.taskId, row.user_id)
    if (upd.changes !== 1) continue // 竞态 / 已被闭合 ⇒ 不重复入账

    const res = recordService({
      userId: row.user_id,
      activityType: 'rescue_task',
      sourceType: 'system',
      sourceRef: input.taskId,
      startedAtMs: row.responded_at_ms,
      endedAtMs: input.endedMs,
      isDrill: false,
      now: input.now,
    })
    closed += 1
    minutes += res.durationMin ?? 0
  }
  return { closed, minutes }
}

/** 台账行 → 对外的明细项（字段名 camelCase 化）。 */
function mapServiceLogRow(row: VolunteerServiceLogRow): ServiceHoursItem {
  return {
    id: row.id,
    activityType: row.activity_type,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    startedAtMs: row.started_at_ms,
    endedAtMs: row.ended_at_ms as number,
    durationMin: row.duration_min as number,
    isDrill: row.is_drill === 1,
    orgId: row.org_id,
  }
}

/** 计入时长的**唯一过滤口径**：已闭合 + 非演习 + 已确认。 */
const COUNTING_WHERE = "ended_at_ms IS NOT NULL AND is_drill = 0 AND status = 'confirmed'"

/** `getUserHours()` 查询选项。 */
export interface GetUserHoursOptions {
  page?: number
  pageSize?: number
  activityType?: ActivityType
}

/**
 * 聚合「我的服务时长」（`GET /api/volunteer/service-hours/me` 的服务端实现）。
 *
 * 不变量：`Σ breakdown[].minutes === totalMinutes`（T5，**数据驱动**，不写死分项数）。
 * 只统计 `ended_at_ms IS NOT NULL AND is_drill = 0 AND status = 'confirmed'`。
 */
export function getUserHours(userId: string, opts: GetUserHoursOptions = {}): ServiceHoursView {
  const page = Math.max(1, Math.floor(opts.page ?? 1))
  const pageSize = Math.max(1, Math.floor(opts.pageSize ?? 20))
  const typeFilter = opts.activityType ? ' AND activity_type = ?' : ''
  const where = `user_id = ? AND ${COUNTING_WHERE}${typeFilter}`
  const whereArgs: string[] = opts.activityType ? [userId, opts.activityType] : [userId]

  const breakdownRows = all<{ activity_type: ActivityType; minutes: number; cnt: number }>(
    `SELECT activity_type, COALESCE(SUM(duration_min), 0) AS minutes, COUNT(*) AS cnt
     FROM volunteer_service_logs WHERE ${where}
     GROUP BY activity_type ORDER BY minutes DESC`,
    ...whereArgs
  )
  const breakdown: ServiceHoursBreakdownItem[] = breakdownRows.map((r) => ({
    activityType: r.activity_type,
    minutes: r.minutes,
    count: r.cnt,
  }))
  const totalMinutes = breakdown.reduce((sum, b) => sum + b.minutes, 0)

  const total = get<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM volunteer_service_logs WHERE ${where}`,
    ...whereArgs
  )?.cnt ?? 0

  const itemRows = all<VolunteerServiceLogRow>(
    `SELECT * FROM volunteer_service_logs WHERE ${where}
     ORDER BY started_at_ms DESC LIMIT ? OFFSET ?`,
    ...whereArgs, pageSize, (page - 1) * pageSize
  )

  return { totalMinutes, breakdown, items: itemRows.map(mapServiceLogRow), page, pageSize, total }
}

/**
 * 按区间聚合分项（供 T02 证明签发复用，§5.2 时序）。
 *
 * 过滤：已闭合 + 非演习 + 已确认，且 `started_at_ms ∈ [fromMs, toMs)`。
 */
export function buildBreakdown(
  userId: string,
  fromMs: number,
  toMs: number
): { totalMinutes: number; breakdown: ServiceHoursBreakdownItem[] } {
  const rows = all<{ activity_type: ActivityType; minutes: number; cnt: number }>(
    `SELECT activity_type, COALESCE(SUM(duration_min), 0) AS minutes, COUNT(*) AS cnt
     FROM volunteer_service_logs
     WHERE user_id = ? AND started_at_ms >= ? AND started_at_ms < ? AND ${COUNTING_WHERE}
     GROUP BY activity_type ORDER BY minutes DESC`,
    userId, fromMs, toMs
  )
  const breakdown: ServiceHoursBreakdownItem[] = rows.map((r) => ({
    activityType: r.activity_type,
    minutes: r.minutes,
    count: r.cnt,
  }))
  const totalMinutes = breakdown.reduce((sum, b) => sum + b.minutes, 0)
  return { totalMinutes, breakdown }
}
