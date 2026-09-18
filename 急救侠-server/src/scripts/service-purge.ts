/**
 * 运维 CLI：志愿服务**台账**的保留期清理（P1-9 / D7）。
 *
 * ★★ **权益保护（本脚本最重要的一条）**：
 * - **证明记录（`service_certificates`）永不清理**（设计 D7：证明是权益凭证）—— 本脚本**没有任何**
 *   删除证明的代码路径（清理只调用 `serviceLog.purgeServiceLogs()`，它只碰 `volunteer_service_logs`）。
 * - **台账默认长期保留**（D7）⇒ **默认不删任何东西**；真删须**显式 `--confirm`**。
 *
 * **为什么是 CLI 而不是「启动时惰性清理」**（同 `sos-purge.ts`）：进程长期不重启 ⇒ 静默永不清理；
 * 大表 DELETE 会阻塞启动。
 *
 * ⚠️ **本脚本不会自己运行。** 须由运维挂 systemd timer / crontab（见 `docs/DEPLOY.md`）。
 *
 * 用法（在 `急救侠-server/` 下）：
 *   npm run service:purge -- --dry-run          # 先看会清理多少（不删）
 *   npm run service:purge --                    # 同样只报数（默认不删）
 *   npm run service:purge -- --days 365 --confirm   # 显式确认后真删台账
 *   npx tsx src/scripts/service-purge.ts --help
 *
 * 退出码：0 = 成功；2 = 用法错误；1 = 意外错误
 */

import { initDb } from '../db'
import { purgeServiceLogs } from '../services/serviceLog'

const DEFAULT_RETENTION_DAYS = 365

const USAGE = `用法: npm run service:purge -- [--days <N>] [--dry-run] [--confirm]

  --days <N>   清理写入时刻早于 N 天的**台账**行（默认 ${DEFAULT_RETENTION_DAYS}）
  --dry-run    只报告将被清理的行数，**不实际删除**（默认行为即"不删"）
  --confirm    **显式确认**后真删（否则一律不删）
  --help       显示本帮助

⚠️ **证明记录（service_certificates）永不清理**（权益凭证，D7）。
⚠️ 台账默认长期保留 ⇒ **不加 --confirm 就不删任何东西**。`

type Parsed = { ok: true; days: number; dryRun: boolean; confirm: boolean } | { ok: false; reason: string }

function parseArgs(argv: string[]): Parsed {
  let days = DEFAULT_RETENTION_DAYS
  let dryRun = false
  let confirm = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') return { ok: false, reason: 'help' }
    if (a === '--dry-run') { dryRun = true; continue }
    if (a === '--confirm') { confirm = true; continue }
    if (a === '--days') {
      const v = argv[++i]
      const n = Number(v)
      if (!v || !Number.isFinite(n) || n <= 0) return { ok: false, reason: '--days 需要一个正数' }
      days = n
      continue
    }
    return { ok: false, reason: `未知参数: ${a}` }
  }
  return { ok: true, days, dryRun, confirm }
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    if (parsed.reason === 'help') { console.log(USAGE); return 0 }
    console.error(`[service:purge] ${parsed.reason}\n\n${USAGE}`)
    return 2
  }

  initDb()

  const cutoffMs = Date.now() - parsed.days * 24 * 60 * 60 * 1000
  const cutoffIso = new Date(cutoffMs).toISOString()

  // `--dry-run` 优先于 `--confirm`（绝不因两者并存而误删）
  const willDelete = parsed.confirm && !parsed.dryRun

  const affected = purgeServiceLogs(cutoffMs, !willDelete)

  if (willDelete) {
    console.log(`[service:purge] 已清理台账 ${affected} 行（保留期 ${parsed.days} 天，cutoff ${cutoffIso}）`)
  } else {
    const why = parsed.dryRun ? 'DRY-RUN' : '默认不删'
    console.log(`[service:purge] ${why}（未删除任何数据）`)
    console.log(`  保留期    : ${parsed.days} 天（cutoff ${cutoffIso}）`)
    console.log(`  将清理台账: ${affected} 行`)
    console.log(`  如需真删：加 --confirm（仅清理台账）`)
  }
  // ★ 恒定的权益声明：证明永不被清理（本脚本无该代码路径）。
  console.log(`  证明记录  : 永不清理（权益凭证，D7）`)
  return 0
}

process.exit(main())
