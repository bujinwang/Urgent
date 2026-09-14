/**
 * 运维 CLI：SOS 留痕的保留期清理（F3 / D6）。
 *
 * **为什么是 CLI 而不是「启动时惰性清理」**（设计文档 §6）：
 * 1. 惰性清理下，进程长期不重启 ⇒ **永不清理**，直接违反 PIPL「存储期限最短」，且违反是**静默**的；
 * 2. 大表 `DELETE` 会**阻塞启动**，与「紧急服务可用性优先」冲突。
 * CLI 显式、可审计、可 `--dry-run`，且与既有 `src/scripts/*` 惯例一致。
 *
 * ⚠️ **本脚本不会自己运行。** 需由运维挂 systemd timer / crontab（见 `NEXT_STEPS.md`）。
 *
 * 用法（在 `急救侠-server/` 下）：
 *   npm run sos:purge -- --dry-run          # 先看会删多少
 *   npm run sos:purge --                    # 按默认保留期（90 天）真删
 *   npm run sos:purge -- --days 30
 *   npx tsx src/scripts/sos-purge.ts --help
 *
 * 退出码：0 = 成功；2 = 用法错误；1 = 意外错误
 */

import { initDb } from '../db'
import { SOS_RETENTION_DAYS, purgeSosEvents, retentionCutoffMs } from '../services/sosTelemetry'

const USAGE = `用法: npm run sos:purge -- [--days <N>] [--dry-run]

  --days <N>   保留最近 N 天（默认 ${SOS_RETENTION_DAYS}）
  --dry-run    只报告将被删除的行数，**不实际删除**
  --help       显示本帮助

建议：先 --dry-run 看影响面，再真删。`

function parseArgs(argv: string[]): { ok: true; days: number; dryRun: boolean } | { ok: false; reason: string } {
  let days = SOS_RETENTION_DAYS
  let dryRun = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') return { ok: false, reason: 'help' }
    if (a === '--dry-run') { dryRun = true; continue }
    if (a === '--days') {
      const v = argv[++i]
      const n = Number(v)
      if (!v || !Number.isFinite(n) || n <= 0) return { ok: false, reason: '--days 需要一个正数' }
      days = n
      continue
    }
    return { ok: false, reason: `未知参数: ${a}` }
  }
  return { ok: true, days, dryRun }
}

function main(): number {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    if (parsed.reason === 'help') { console.log(USAGE); return 0 }
    console.error(`[sos:purge] ${parsed.reason}\n\n${USAGE}`)
    return 2
  }

  initDb()

  const cutoffMs = retentionCutoffMs(parsed.days)
  const cutoffIso = new Date(cutoffMs).toISOString()
  const affected = purgeSosEvents(cutoffMs, parsed.dryRun)

  if (parsed.dryRun) {
    console.log(`[sos:purge] DRY-RUN（未删除任何数据）`)
    console.log(`  保留期    : ${parsed.days} 天（cutoff ${cutoffIso}）`)
    console.log(`  将删除行数: ${affected}`)
    console.log(`  确认无误后去掉 --dry-run 真删。`)
  } else {
    console.log(`[sos:purge] 已删除 ${affected} 行（保留期 ${parsed.days} 天，cutoff ${cutoffIso}）`)
  }
  return 0
}

process.exit(main())
