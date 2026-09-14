/**
 * SOS 留痕（`sos_events`）的读取与清理 —— **唯一实现**，供 CLI 脚本与测试共用。
 *
 * 之所以抽成模块而不是把 SQL 直接写在脚本里：脚本若各写一份 SQL，测试就只能断言
 * **自己那份**，对脚本的改动做突变验证会**假绿**。这里集中后，测试断言的是生产路径。
 *
 * 设计依据：`deliverables/software-company/sos-telemetry-design.md`（§6 保留期 / §7 统计 / §8 信任边界）。
 */
import db, { get } from '../db'

/** 默认保留期（天）。兼顾「可追溯」与 PIPL「最小必要 / 存储期限最短」。 */
export const SOS_RETENTION_DAYS = 90

export interface SosCounts {
  /** 真实触发（`is_drill = 0`）。 */
  real: number
  /** 演习触发（`is_drill = 1`）。 */
  drill: number
  /** 合计。 */
  total: number
}

/**
 * 按条件统计 SOS 触发次数。
 *
 * ⚠️ **必须三者同时返回，不可只返回 `real`**：`is_drill` 是客户端声明、服务端**不可验证**
 * （设计文档 §8），恶意用户可标注 `isDrill:true` 把自己的记录从"真实"计数里藏掉。
 * 三行并列时，「某账号真实数很低但演习数畸高」这种模式仍然可见 —— 这是对信任边界的廉价缓解。
 *
 * @param userId  精确匹配 `user_id`；**不传**表示不限用户（含匿名的 `NULL` 行）。
 *                传 `null` 表示只看匿名触发。
 * @param sinceMs 起始时间（epoch 毫秒，含）。刻意用 `created_at_ms` 整数列比较，
 *                **不用 `strftime`** —— 该函数会忽略时区后缀，本项目已因此出过事故。
 */
export function countSosEvents(opts: { userId?: string | null; sinceMs?: number } = {}): SosCounts {
  const where: string[] = []
  const args: unknown[] = []
  if (opts.userId !== undefined) {
    if (opts.userId === null) where.push('user_id IS NULL')
    else { where.push('user_id = ?'); args.push(opts.userId) }
  }
  if (opts.sinceMs !== undefined) { where.push('created_at_ms >= ?'); args.push(opts.sinceMs) }

  const row = get<{ real: number; drill: number; total: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN is_drill = 0 THEN 1 ELSE 0 END), 0) AS real,
       COALESCE(SUM(CASE WHEN is_drill = 1 THEN 1 ELSE 0 END), 0) AS drill,
       COUNT(*) AS total
     FROM sos_events${where.length ? ' WHERE ' + where.join(' AND ') : ''}`,
    ...(args as never[])
  )
  return { real: row?.real ?? 0, drill: row?.drill ?? 0, total: row?.total ?? 0 }
}

/**
 * 删除早于 `beforeMs` 的留痕，返回受影响行数。
 *
 * @param dryRun `true` 时只报数不删（供运维先确认影响面）。
 */
export function purgeSosEvents(beforeMs: number, dryRun = false): number {
  if (dryRun) {
    const row = get<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM sos_events WHERE created_at_ms < ?', beforeMs)
    return row?.cnt ?? 0
  }
  return db.prepare('DELETE FROM sos_events WHERE created_at_ms < ?').run(beforeMs).changes
}

/** `days` 天前的时间戳（epoch 毫秒）。 */
export function retentionCutoffMs(days: number = SOS_RETENTION_DAYS): number {
  return Date.now() - days * 24 * 60 * 60 * 1000
}
