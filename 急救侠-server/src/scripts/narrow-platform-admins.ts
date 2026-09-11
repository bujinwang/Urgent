/**
 * 运维 CLI：平台管理员「收窄」。
 *
 * 背景：迁移 036 为避免静默失权，把既有「队长」一次性保权为平台管理员
 * （`backfillPlatformAdmins()`，保权而非授权）。其副作用是历史上凭 `is_leader`
 * 拿到管理面权限的账号被固化为平台管理员。本脚本提供**受控的收窄手段**：
 * 把不该有管理权的账号 `is_platform_admin: 1 → 0`，并置位 durable 标记，
 * 使 `backfillPlatformAdmins()` 永久停用 —— 收窄不会被下一次回填静默撤销。
 *
 * 用法（在 `急救侠-server/` 下）：
 *   npm run admin:narrow -- --list
 *   npm run admin:narrow -- --downgrade <id1,id2,...>
 *   npm run admin:narrow -- --downgrade <id1,id2,...> --force
 *   npx tsx src/scripts/narrow-platform-admins.ts --help
 *
 * 退出码：0 成功；2 用法错误 / 被拒绝；1 意外错误。
 *
 * ⚠️ 脚本**不含任何 HTTP 端点** —— 收窄是运维动作，不经由公网接口暴露，
 *    以保持攻击面不变。
 */

import db, {
  initDb,
  getMeta,
  setMeta,
  all,
  PLATFORM_ADMIN_NARROWING_DONE_KEY,
} from '../db'
import { planDowngrade, type DowngradeSnapshot } from './narrow-plan'

const KEY = PLATFORM_ADMIN_NARROWING_DONE_KEY

/** 候选账号行（仅取收窄所需的字段，绝不输出敏感信息）。 */
interface CandidateRow {
  id: string
  name: string
  affiliation: string
  is_leader: number
  is_platform_admin: number
}

/** 打印完整用法。 */
function printUsage(): void {
  console.log(
    [
      '平台管理员收窄工具',
      '',
      '用法：',
      '  npm run admin:narrow -- [--list]',
      '  npm run admin:narrow -- --downgrade <id1,id2,...> [--force]',
      '  npm run admin:narrow -- --help',
      '',
      '模式：',
      '  --list                 [默认] 列出候选账号（is_leader=1 或 is_platform_admin=1），',
      '                         并显式标注「回填固化候选」（is_leader=1 且 is_platform_admin=1）。',
      '  --downgrade <ids>      把列出的 id 的 is_platform_admin 置 0（且仅这些 id）。',
      '                         完成后置位标记 platform_admin_narrowing_done=1，',
      '                         使 backfillPlatformAdmins() 永久停用（收窄不被静默撤销）。',
      '  --force                仅用于放行「会把平台管理员清零」的操作（默认拒绝，自锁保护）。',
      '  --help, -h             显示本用法。',
      '',
      '退出码：0 成功；2 用法错误 / 被拒绝；1 意外错误。',
    ].join('\n')
  )
}

/** 从数据库读取决策所需的状态快照。 */
function loadSnapshot(): DowngradeSnapshot {
  const existingIds = all<{ id: string }>('SELECT id FROM users').map((r) => r.id)
  const adminIds = all<{ id: string }>('SELECT id FROM users WHERE is_platform_admin = 1').map(
    (r) => r.id
  )
  return { existingIds, adminIds }
}

/** 当前标记状态的可读描述。 */
function markerStatus(): string {
  return getMeta(KEY) === '1'
    ? '已置位（收窄已发生 → backfillPlatformAdmins() 已停用）'
    : '未置位（尚未收窄 → backfillPlatformAdmins() 仍可能在首次应用 036 时回填）'
}

/** `--list`：打印候选表与标记状态。 */
function listCandidates(): number {
  const rows = all<CandidateRow>(
    `SELECT id, name, affiliation, is_leader, is_platform_admin
     FROM users
     WHERE is_leader = 1 OR is_platform_admin = 1
     ORDER BY is_leader DESC, is_platform_admin DESC, id`
  )

  console.log('平台管理员收窄 · 候选账号表')
  console.log(`标记 ${KEY}：${markerStatus()}`)
  console.log('')

  if (rows.length === 0) {
    console.log('（无候选账号）')
    return 0
  }

  // 列宽按内容自适应，避免破坏表格可读性。
  const headers = ['id', 'name', 'affiliation', 'is_leader', 'is_platform_admin']
  const widths = headers.map((h, i) => {
    const key = ['id', 'name', 'affiliation', 'is_leader', 'is_platform_admin'][i] as keyof CandidateRow
    return Math.max(
      h.length,
      ...rows.map((r) => String(r[key] ?? '').length)
    )
  })
  const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(' | ')

  console.log(fmt(headers))
  console.log(widths.map((w) => '-'.repeat(w)).join('-+-'))
  for (const r of rows) {
    const cells = [
      r.id,
      r.name,
      r.affiliation,
      String(r.is_leader),
      String(r.is_platform_admin),
    ]
    const backfillFixed = r.is_leader === 1 && r.is_platform_admin === 1
    console.log(fmt(cells) + (backfillFixed ? '  ← 回填固化候选（保权遗留，可考虑收窄）' : ''))
  }

  const adminCount = rows.filter((r) => r.is_platform_admin === 1).length
  const fixedCount = rows.filter((r) => r.is_leader === 1 && r.is_platform_admin === 1).length
  console.log('')
  console.log(`合计：候选 ${rows.length} 个 ｜ 平台管理员 ${adminCount} 个 ｜ 回填固化候选 ${fixedCount} 个`)
  console.log('提示：收窄前请与业务/运营确认名单；回填固化候选是主要审视对象。')
  return 0
}

/** `--downgrade`：执行收窄。返回退出码。 */
function downgrade(ids: string[], force: boolean): number {
  const snapshot = loadSnapshot()
  const plan = planDowngrade(ids, snapshot, { force })

  if (!plan.ok) {
    console.error(`[narrow] 拒绝执行：${plan.reason}`)
    return 2
  }

  // 记录 before 值，供逐条打印 before→after。
  const before = new Map<string, number>()
  for (const id of plan.targets) {
    const row = db
      .prepare('SELECT is_platform_admin FROM users WHERE id = ?')
      .get(id) as { is_platform_admin: number } | undefined
    before.set(id, row ? row.is_platform_admin : 0)
  }

  // 原子执行：降级 + 置位标记同处一个事务，避免「降级成功但标记未写入」。
  const placeholders = plan.targets.map(() => '?').join(', ')
  const run = db.transaction(() => {
    db.prepare(`UPDATE users SET is_platform_admin = 0 WHERE id IN (${placeholders})`).run(
      ...plan.targets
    )
    setMeta(KEY, '1')
  })
  run()

  console.log('[narrow] 已执行平台管理员收窄：')
  for (const id of plan.targets) {
    const beforeVal = before.get(id) ?? 0
    console.log(`  - ${id}: is_platform_admin ${beforeVal} → 0`)
  }
  if (plan.wouldLeaveZero) {
    console.log('  ⚠ 本次操作后平台管理员总数为 0（已通过 --force 放行）。')
  }
  console.log('')
  console.log(`[narrow] 已置位标记 ${KEY}=1 —— 此后 backfillPlatformAdmins() 永久停用，`)
  console.log('        被降级账号不会被下一次回填静默重新提权（这是收窄 durable 的保证）。')
  return 0
}

/** 解析 argv 并分发；返回退出码。 */
function main(argv: string[]): number {
  let mode: 'list' | 'downgrade' | 'help' = 'list'
  let downgradeRaw = ''
  let force = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      mode = 'help'
    } else if (arg === '--list') {
      mode = 'list'
    } else if (arg === '--force') {
      force = true
    } else if (arg === '--downgrade') {
      mode = 'downgrade'
      // 仅当下一参数不是另一个开关时才消费为 id 列表。
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        downgradeRaw = argv[i + 1]
        i++
      } else {
        downgradeRaw = ''
      }
    } else if (arg.startsWith('--downgrade=')) {
      mode = 'downgrade'
      downgradeRaw = arg.slice('--downgrade='.length)
    } else {
      console.error(`[narrow] 未知参数：${arg}`)
      printUsage()
      return 2
    }
  }

  if (mode === 'help') {
    printUsage()
    return 0
  }
  if (mode === 'list') {
    return listCandidates()
  }
  // mode === 'downgrade'
  const ids = downgradeRaw.split(',')
  return downgrade(ids, force)
}

initDb()

let exitCode: number
try {
  exitCode = main(process.argv.slice(2))
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[narrow] 意外错误：${msg}`)
  exitCode = 1
}
process.exit(exitCode)
