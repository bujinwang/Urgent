/**
 * 运维 CLI：志愿服务时长的**只读**统计（P1-9 / 设计 §5.3）。
 *
 * 纪律（与 `sos-report.ts` 一致）：
 * - **不新增 HTTP 端点**（本项目「管理面不开接口」的既有取向）；
 * - **纯只读**，不做任何写操作（清理是另一个脚本 `service-purge.ts`）；
 * - **必然输出三行**（可归因率 / 未闭合率 / 演习污染率），并同时打印**分子/分母**（可审计）。
 *
 * ⚠️ **P0 口径（§2.4 / §3.4）**：P0 阶段唯一"端到端可归因"的来源是**救援任务**，
 * 故**分母 = `task_volunteers` 全部参与行**（救援任务场景内），**不是**"全部服务参与"。
 * 且「演习污染率」在 P0 是**防御性不变量**（演习台账只可能来自 `manual` 或测试直接插入）。
 *
 * 指标定义（写清楚，避免口径漂移）：
 * - **可归因率** = 有 ≥1 条救援任务台账的参与行 / 全部参与行（台账：`activity_type='rescue_task'`
 *   且 `source_ref = task_id` 且 `user_id` 相同）。
 * - **未闭合率** = 未闭合的参与行 / 全部参与行（未闭合 = `ended_at_ms IS NULL AND status <> 'voided'`；
 *   `voided` 是**终局**，不算"未闭合"）。
 * - **演习污染率** = `is_drill=1` 的台账行 / 全部台账行。
 *
 * 用法（在 `急救侠-server/` 下）：
 *   npm run service:report
 *   npm run service:report -- --user <userId> --days 90
 *   npx tsx src/scripts/service-report.ts --help
 *
 * 退出码：0 = 成功；2 = 用法错误；1 = 意外错误
 */

import { initDb, get } from '../db'

const USAGE = `用法: npm run service:report -- [--user <userId>] [--days <N>]

  --user <userId>  只看该账号；不传 = 全部账号
  --days <N>       只统计最近 N 天（参与行按 responded_at_ms、台账按 created_at_ms）
  --help           显示本帮助

注：三行指标**都会输出**，并附分子/分母（可审计）。`

type Parsed = { ok: true; userId?: string; days?: number } | { ok: false; reason: string }

function parseArgs(argv: string[]): Parsed {
  let userId: string | undefined
  let days: number | undefined
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') return { ok: false, reason: 'help' }
    if (a === '--user') {
      const v = argv[++i]
      if (!v) return { ok: false, reason: '--user 需要一个 userId 参数' }
      userId = v
    } else if (a === '--days') {
      const v = argv[++i]
      const n = Number(v)
      if (!v || !Number.isFinite(n) || n <= 0) return { ok: false, reason: '--days 需要一个正数' }
      days = n
    } else {
      return { ok: false, reason: `未知参数: ${a}` }
    }
  }
  return { ok: true, userId, days }
}

/** 比率（0 分母 ⇒ `—`，**绝不**用 0 兜底成"看起来正常"）。 */
function rate(num: number, den: number): string {
  if (den <= 0) return '—（无样本）'
  return `${((num / den) * 100).toFixed(1)}%（${num}/${den}）`
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    if (parsed.reason === 'help') { console.log(USAGE); return 0 }
    console.error(`[service:report] ${parsed.reason}\n\n${USAGE}`)
    return 2
  }

  initDb()

  const now = Date.now()
  const cutoff = parsed.days === undefined ? undefined : now - parsed.days * 24 * 60 * 60 * 1000

  // ---- 参与行（task_volunteers）----
  const tvWhere: string[] = []
  const tvArgs: Array<string | number> = []
  if (parsed.userId !== undefined) { tvWhere.push('user_id = ?'); tvArgs.push(parsed.userId) }
  if (cutoff !== undefined) { tvWhere.push('responded_at_ms >= ?'); tvArgs.push(cutoff) }
  const tvClause = tvWhere.length ? ' WHERE ' + tvWhere.join(' AND ') : ''
  const tvClauseAliased = tvWhere.length ? ' WHERE ' + tvWhere.map((w) => 'tv.' + w).join(' AND ') : ''
  const tvAndOr = tvWhere.length ? ' AND ' : ' WHERE '

  const tvTotal = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM task_volunteers${tvClause}`,
    ...(tvArgs as never[])
  )?.c ?? 0

  const attributed = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM task_volunteers tv${tvClauseAliased}${tvAndOr}EXISTS (
       SELECT 1 FROM volunteer_service_logs l
       WHERE l.user_id = tv.user_id AND l.source_ref = tv.task_id AND l.activity_type = 'rescue_task'
     )`,
    ...(tvArgs as never[])
  )?.c ?? 0

  const unclosed = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM task_volunteers tv${tvClauseAliased}${tvAndOr}tv.ended_at_ms IS NULL AND tv.status <> 'voided'`,
    ...(tvArgs as never[])
  )?.c ?? 0

  // ---- 台账（volunteer_service_logs）----
  const logWhere: string[] = []
  const logArgs: Array<string | number> = []
  if (parsed.userId !== undefined) { logWhere.push('user_id = ?'); logArgs.push(parsed.userId) }
  if (cutoff !== undefined) { logWhere.push('created_at_ms >= ?'); logArgs.push(cutoff) }
  const logClause = logWhere.length ? ' WHERE ' + logWhere.join(' AND ') : ''
  const logAndOr = logWhere.length ? ' AND ' : ' WHERE '

  const logTotal = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM volunteer_service_logs${logClause}`,
    ...(logArgs as never[])
  )?.c ?? 0
  const drill = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM volunteer_service_logs${logClause}${logAndOr}is_drill = 1`,
    ...(logArgs as never[])
  )?.c ?? 0

  const scope = [
    parsed.userId === undefined ? '全部账号' : `账号 ${parsed.userId}`,
    parsed.days === undefined ? '全部时间段' : `最近 ${parsed.days} 天`,
  ].join(' · ')

  console.log(`[service:report] 范围: ${scope}`)
  console.log(`  可归因率    : ${rate(attributed, tvTotal)}   ← 有台账的参与行 / 全部参与行（P0 分母=救援任务场景）`)
  console.log(`  未闭合率    : ${rate(unclosed, tvTotal)}   ← 未闭合参与行 / 全部参与行（voided 终局不计）`)
  console.log(`  演习污染率  : ${rate(drill, logTotal)}   ← is_drill=1 台账行 / 全部台账行（P0 为防御性不变量）`)
  console.log(`  （参与行 ${tvTotal} 行；台账 ${logTotal} 行；cutoff ${cutoff === undefined ? '—' : new Date(cutoff).toISOString()}）`)
  return 0
}

process.exit(main())
