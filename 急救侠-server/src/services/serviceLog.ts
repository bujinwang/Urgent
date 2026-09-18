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

/**
 * 解析志愿者计入**机构聚合**时归属的机构（★ D-7）。
 *
 * 多对多、无主机构标记 ⇒ **确定性选一个**：优先取用户担任 `admin`/`manager` 的机构，
 * 否则取 `joined_at` 最早加入的机构。无任何机构归属 ⇒ 返回 `''`
 * （时长仍进**政府全局**聚合、不进任何机构聚合）。
 *
 * ⚠️ 归属**只能**从 `organization_members` 关系推导 —— 请求体传 `org_id` 违反「硬约束 #1」
 * （归属不可信请求体，否则可伪造把时长记到别家机构）。本函数即唯一权威推导点。
 */
export function resolveUserOrgId(userId: string): string {
  const row = get<{ org_id: string }>(
    `SELECT org_id FROM organization_members
     WHERE user_id = ?
     ORDER BY (role IN ('admin','manager')) DESC, joined_at ASC
     LIMIT 1`,
    userId
  )
  return row?.org_id ?? ''
}

/**
 * D-7 迁移回填：把 `org_id = ''` 的旧台账行补上**确定性**机构（与 {@link resolveUserOrgId} 同一规则）。
 *
 * 历史台账在 `org_id` 落地前写入，归属为空；本函数用同一规则回填，使存量时长也能被机构聚合计入
 * （且只计入一次 —— 因为每行只解析出一个归属机构，不会因用户多机构而翻倍）。
 *
 * @returns 受影响（被补上 `org_id`）的行数。
 */
export function backfillServiceLogOrgId(): number {
  // ★ `COALESCE(..., '')` 必需：`volunteer_service_logs.org_id` 是 `NOT NULL`，无机构用户的子查询返回 NULL
  // ⇒ 直接 `SET org_id = (SELECT ...)` 会抛 `NOT NULL constraint failed`。COALESCE 让无机构行保持 ''
  // （既满足「无机构用户保持 ''」不变量，也契合列 `DEFAULT ''`）。
  const info = db.prepare(
    `UPDATE volunteer_service_logs
     SET org_id = COALESCE((SELECT om.org_id FROM organization_members om
                  WHERE om.user_id = volunteer_service_logs.user_id
                  ORDER BY (om.role IN ('admin','manager')) DESC, om.joined_at ASC LIMIT 1), '')
     WHERE org_id = ''`
  ).run()
  return info.changes
}

/** `arriveParticipation()` 入参。 */
export interface ArriveParticipationInput {
  taskId: string
  /** 身份，**必须**由调用方从 token 派生。 */
  userId: string
  /** 到达时刻（epoch 毫秒，= 时长起点）。 */
  arrivedMs: number
}

/**
 * 记「**到达现场**」（★ v1.2，= 时长起点；§11.4）。
 *
 * 幂等（T27）：`UPDATE ... WHERE arrived_at_ms IS NULL` 守卫 ⇒ 重复上报**不覆盖起点**。
 * 只作用于**本人**行（`user_id` 过滤），绝不 task-wide；无本人行 / 已到达 / 已作废 ⇒ no-op。
 *
 * @returns `true` = 本次真正写入到达时刻。
 */
export function arriveParticipation(input: ArriveParticipationInput): boolean {
  const info = db.prepare(
    `UPDATE task_volunteers SET arrived_at_ms = ?, status = 'arrived'
     WHERE task_id = ? AND user_id = ? AND arrived_at_ms IS NULL AND status <> 'voided'`
  ).run(input.arrivedMs, input.taskId, input.userId)
  return info.changes === 1
}

/** `abandonParticipation()` 入参。 */
export interface AbandonParticipationInput {
  taskId: string
  userId: string
  reason?: string
  now?: number
}

/**
 * 记「**放弃 / 中途退出**」（★ v1.2，§11.4）：参与行标为 `voided` 并留痕，**绝不写台账**（Q2）。
 *
 * 幂等：`ended_at_ms IS NULL AND status <> 'voided'` 守卫 ⇒ 重复调用无副作用。已闭合（`left`）⇒ no-op。
 *
 * ⚠️ **`status='voided'` 不是终局**：★ v1.4 起支持「放弃后反悔、重新参与同一任务」，
 * 由 {@link rejoinParticipation} 把 `voided` 行重新激活为 `responded`（§11.11）。
 * 但 ★ **`left`（已闭合）是终局**：本函数与 `rejoinParticipation()` 的守卫都排除 `ended_at_ms` 非空的行。
 *
 * @returns `true` = 本次真正作了废。
 */
export function abandonParticipation(input: AbandonParticipationInput): boolean {
  const info = db.prepare(
    `UPDATE task_volunteers SET status = 'voided', voided_at_ms = ?, void_reason = ?
     WHERE task_id = ? AND user_id = ? AND ended_at_ms IS NULL AND status <> 'voided'`
  ).run(input.now ?? Date.now(), input.reason ?? 'abandoned', input.taskId, input.userId)
  return info.changes === 1
}

/** `rejoinParticipation()` 入参。 */
export interface RejoinParticipationInput {
  taskId: string
  userId: string
  /** 本次重新接受的时刻（= 新的 `responded_at_ms`）。 */
  respondedMs: number
}

/**
 * 「放弃后反悔、重新参与同一任务」—— 把本人 `voided` 行重新激活为 `responded`（★ v1.4，§11.11-③）。
 *
 * 重置清单（team-lead 已识别的坑，**必须全做**）：
 * - `status = 'responded'`
 * - `responded_at_ms = input.respondedMs`（**本次**接受时刻，不是第一次）
 * - ★★ `arrived_at_ms = NULL`（**最危险的一行**：不清它 ⇒ `/arrive` 的 `arrived_at_ms IS NULL` 守卫
 *   不满足 ⇒ 本次到达**不被记录**；`/complete` 会拿**上一段的到达**当起点 ⇒ 算出**巨大且错误**的时长
 *   —— **越早反悔时长越大**，反向激励。T36 专测此点）
 * - `ended_at_ms = NULL`（`voided` 行本应已为 NULL，防御性重置）
 * - `rejoin_count = rejoin_count + 1`（审计）
 * - **`voided_at_ms` / `void_reason` 不清**（审计保留，语义＝「最近一次」作废痕迹）
 *
 * ⚠️ 守卫 `status = 'voided'` ⇒ **`left`（已闭合）的行命中不到** ⇒ **闭合后不可反悔**（§11.11-⑤）。
 *
 * ★★ **为什么 `left` 必须是终局（写进注释，勿删）**：台账部分唯一索引
 * `idx_vsl_dedup(source_type, source_ref, user_id) WHERE source_ref <> ''` 会按 `(system, taskId, user)`
 * 去重。若允许「一任务多段服务、每段各自入账」，第二段的台账行会被 `INSERT OR IGNORE` **静默丢弃**
 * ⇒ **静默丢时长**。⇒ 「`left` 终局」不只是产品语义，**也是本索引下"不丢时长"的必要条件**。
 * 后人若为支持"一任务多段服务"改掉它，**必须先**把 `source_ref` 扩为含段号（如 `taskId#2`）或改索引 ——
 * 那是独立设计，**不得**只改状态机。
 *
 * @returns `true` = 本次真的重新激活了（命中 `voided` 行）；`responded`/`arrived`/`left`/无行 ⇒ `false`。
 */
export function rejoinParticipation(input: RejoinParticipationInput): boolean {
  const info = db.prepare(
    `UPDATE task_volunteers
     SET status = 'responded',
         responded_at_ms = ?,
         arrived_at_ms = NULL,
         ended_at_ms = NULL,
         rejoin_count = rejoin_count + 1
     WHERE task_id = ? AND user_id = ? AND status = 'voided'`
  ).run(input.respondedMs, input.taskId, input.userId)
  return info.changes === 1
}

/** `closeServiceForUser()` 入参。 */
export interface CloseServiceForUserInput {
  taskId: string
  userId: string
  /** 离开时刻（epoch 毫秒，= 时长终点）。 */
  endedMs: number
  now?: number
}

/** `closeServiceForUser()` 结果。重复调用 / 未到场恒为 `{ closed: 0, minutes: 0 }`。 */
export interface CloseServiceForUserResult {
  closed: number
  minutes: number
}

/**
 * 按人闭合「**本人 + 已到达 + 未闭合**」的参与行并写一条台账（★ v1.2，§11.4 / T26）。
 *
 * ⚠️ **只作用于本人**（`user_id` 过滤）—— 修复 v1.0 的 task-wide 连带缺陷：
 * 任何一个人的动作**不得**给该任务下其他人结算时长（堵「搭便车」，T29）。
 *
 * ⚠️ **时长起点 = `arrived_at_ms`（到达），不是 `responded_at_ms`（报名）**（Q1/T26）。
 * `arrived_at_ms IS NULL`（未到场）⇒ **no-op、不写台账**（未到场恒不计入）。
 *
 * 幂等（T31）：`ended_at_ms IS NULL` 守卫 ⇒ 二次调用影响 0 行，`ended_at_ms` 不被覆盖、时长不翻倍。
 */
export function closeServiceForUser(input: CloseServiceForUserInput): CloseServiceForUserResult {
  const row = get<{ arrived_at_ms: number | null }>(
    `SELECT arrived_at_ms FROM task_volunteers
     WHERE task_id = ? AND user_id = ? AND ended_at_ms IS NULL AND status <> 'voided'`,
    input.taskId, input.userId
  )
  if (!row) return { closed: 0, minutes: 0 }

  const arrivedAtMs = row.arrived_at_ms
  // 未到场（无到达时刻）⇒ 恒不计入，不闭合、不写台账（§11.2 Q1 / §11.4）。
  if (arrivedAtMs == null) return { closed: 0, minutes: 0 }

  const upd = db.prepare(
    `UPDATE task_volunteers SET ended_at_ms = ?, status = 'left'
     WHERE task_id = ? AND user_id = ? AND ended_at_ms IS NULL AND status <> 'voided'`
  ).run(input.endedMs, input.taskId, input.userId)
  if (upd.changes !== 1) return { closed: 0, minutes: 0 }

  const res = recordService({
    userId: input.userId,
    activityType: 'rescue_task',
    sourceType: 'system',
    sourceRef: input.taskId,
    startedAtMs: arrivedAtMs, // ★ 起点 = 到达，不是报名（T26）
    endedAtMs: input.endedMs,
    isDrill: false,
    orgId: resolveUserOrgId(input.userId), // ★ D-7：写入确定性机构归属（勿伪造/改请求体）
    now: input.now,
  })
  return { closed: 1, minutes: res.durationMin ?? 0 }
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

/**
 * 计入时长的**唯一过滤口径**：已闭合 + 非演习 + 已确认。
 *
 * ⚠️ **导出供「派生视图」复用**（机构/政府聚合，§3.2）：这些视图只读台账、各自过滤，
 * 但**必须**复用同一计入口径，否则口径会漂移（本项目反复踩过的坑）。
 */
export const COUNTING_WHERE = "ended_at_ms IS NOT NULL AND is_drill = 0 AND status = 'confirmed'"

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

// ---------------------------------------------------------------------------
// 保留期清理（P1-9，`npm run service:purge`）—— **只碰台账，绝不碰证明**
// ---------------------------------------------------------------------------

/**
 * 台账保留期清理：删除**写入时刻早于 `beforeMs`** 的台账行，返回受影响行数。
 *
 * ⚠️ **只删 `volunteer_service_logs`**；**证明（`service_certificates`）在此模块中
 * 没有任何删除路径**（设计 D7：证明是权益凭证，永久保留）。
 *
 * ⚠️ 保留期以 `created_at_ms`（**记录写入时刻**）为准 —— 与 `sosTelemetry.purgeSosEvents`
 * 用 `created_at` 的口径一致；**不用** `started_at_ms`（那是"服务发生时刻"，历史回填会让它偏旧）。
 *
 * @param dryRun `true` 时只报数不删（供运维先确认影响面）。
 */
export function purgeServiceLogs(beforeMs: number, dryRun = false): number {
  if (dryRun) {
    const row = get<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM volunteer_service_logs WHERE created_at_ms < ?', beforeMs)
    return row?.cnt ?? 0
  }
  return db.prepare('DELETE FROM volunteer_service_logs WHERE created_at_ms < ?').run(beforeMs).changes
}
