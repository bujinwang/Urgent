/**
 * 运维 CLI：SOS 留痕的**只读**统计（F3 / 建议书 §10「恶意虚假呼救可追溯」）。
 *
 * 设计纪律（与项目一致）：
 * - **不新增 HTTP 端点**：与本项目「管理面不开接口」的既有取向一致（`narrow-plan.ts` 先例）；
 * - 纯只读，不做任何写操作（清理是另一个脚本 `sos-purge.ts`）；
 * - **必然输出三行**（真实 / 演习 / 合计），理由见下。
 *
 * ⚠️ 为什么必须输出三行：`is_drill` 是**客户端声明、服务端不可验证**的提示（设计文档 §8），
 * 恶意用户可发 `isDrill:true` 把自己的记录从"真实"计数里藏掉。只报"真实"会让这类记录
 * **完全隐形**；三行并列时「某账号真实数很低但演习数畸高」的模式仍然可见。
 * 本统计是**证据（evidence）而非证明（proof）**：用于收到举报后查证，不足以单独作为处置依据。
 *
 * 用法（在 `急救侠-server/` 下）：
 *   npm run sos:report
 *   npm run sos:report -- --user <userId>
 *   npm run sos:report -- --days 90
 *   npx tsx src/scripts/sos-report.ts --help
 *
 * 退出码：0 = 成功；2 = 用法错误；1 = 意外错误
 */

import { initDb } from '../db'
import { SOS_RETENTION_DAYS, countSosEvents, retentionCutoffMs } from '../services/sosTelemetry'

const USAGE = `用法: npm run sos:report -- [--user <userId>] [--days <N>]

  --user <userId>  只看该账号；不传 = 不限用户（**含匿名 NULL 行**）
  --days <N>       统计最近 N 天；不传 = 不限时间段
  --help           显示本帮助

注：真实 / 演习 / 合计三行**都会输出**，不要只看"真实"（见脚本头部说明）。`

function parseArgs(argv: string[]): { ok: true; userId?: string; days?: number } | { ok: false; reason: string } {
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

function main(): number {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    if (parsed.reason === 'help') { console.log(USAGE); return 0 }
    console.error(`[sos:report] ${parsed.reason}\n\n${USAGE}`)
    return 2
  }

  initDb()

  const sinceMs = parsed.days === undefined ? undefined : retentionCutoffMs(parsed.days)
  const counts = countSosEvents({ userId: parsed.userId, sinceMs })

  const scope = [
    parsed.userId === undefined ? '全部账号（含匿名）' : `账号 ${parsed.userId}`,
    parsed.days === undefined ? '全部时间段' : `最近 ${parsed.days} 天`,
  ].join(' · ')

  console.log(`[sos:report] 范围: ${scope}`)
  console.log(`  真实（is_drill=0）: ${counts.real}`)
  console.log(`  演习（is_drill=1）: ${counts.drill}`)
  console.log(`  合计              : ${counts.total}`)
  console.log(`  默认保留期        : ${SOS_RETENTION_DAYS} 天（清理: npm run sos:purge）`)

  // 真实 + 演习必须恒等于合计；不等说明 SQL 的 CASE 分支漏了取值（如 is_drill 存了非 0/1）。
  if (counts.real + counts.drill !== counts.total) {
    console.warn(`  ⚠️ 「真实 + 演习 ≠ 合计」：存在 is_drill 非 0/1 的行，请人工核查`)
    return 1
  }
  return 0
}

process.exit(main())
