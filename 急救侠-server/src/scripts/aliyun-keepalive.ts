/**
 * 运维 CLI：阿里云签名「保活巡检」。
 *
 * 背景：阿里云规定签名报备通过后**超过 6 个月无任何发送记录**即「报备失效」且发送失败
 * （<https://help.aliyun.com/document_detail/2873145.html>）；本项目属**低频**场景
 * （AED 取用告警月量级低），一旦某段时间无真实告警，签名可能**静默失效**。
 * 本脚本把「巡检」做成可执行命令，并可用退出码接 cron/CI 告警。
 *
 * 设计纪律（与项目一致）：
 * - **零新增依赖 / 无新表 / 无新迁移 / 无新 HTTP 端点 / 无后台定时器**；
 * - `aed_sms_dispatches` **只读**；保活记录写入 `app_meta`；
 * - **零 PII**：输出绝不含完整手机号（一律经 `maskPhone` 脱敏）；
 * - **绝不静默**：短信未配置时 `--send-test` 明确报错并非零退出。
 *
 * 用法（在 `急救侠-server/` 下）：
 *   npm run aliyun:keepalive -- --status
 *   npm run aliyun:keepalive -- --send-test <11 位手机号>
 *   npm run aliyun:keepalive -- --mark-sent [--at <ISO8601>]
 *   npm run aliyun:keepalive -- --days 90
 *   npx tsx src/scripts/aliyun-keepalive.ts --help
 *
 * 退出码：
 *   --status：0 = ok/warn（无需动作）；1 = action_due；2 = overdue / never_sent
 *   --send-test：0 成功；2 用法错误 / 短信未配置 / 号码非法；1 发送失败
 *   --mark-sent：写 meta 后**立刻复算**，退出码同 --status（0 = ok/warn；1 = action_due；2 = overdue / never_sent）；
 *                用法错误 / --at 不可解析 → 2
 *   其它意外错误：1
 */

import { initDb, setMeta } from '../db'
import { isSmsConfigured, sendSms, maskPhone } from '../services/smsService'
import { isVoiceConfigured } from '../services/voiceService'
import { getVoiceDailyCount, getVoiceDailyLimit } from '../services/smsReportService'
import {
  readLastSentAtMs,
  SIGNATURE_LAST_SENT_META_KEY,
} from '../services/signatureKeepAlive'
import {
  evaluateSignatureKeepAlive,
  SIGNATURE_KEEPALIVE_THRESHOLD_DAYS,
  type KeepAliveLevel,
} from './keepalive-plan'

/** 中国大陆手机号（11 位，1[3-9] 开头）。 */
const CN_MOBILE = /^1[3-9]\d{9}$/

/** `--status` 等级 → 退出码。 */
function levelExitCode(level: KeepAliveLevel): number {
  if (level === 'overdue' || level === 'never_sent') return 2
  if (level === 'action_due') return 1
  return 0 // ok / warn
}

/** 解析 ISO8601 时间串为 epoch ms；空串或不可解析返回 `null`（调用方据此报错 exit 2，**不回落 now**）。 */
function parseIsoMs(raw: string): number | null {
  if (!raw) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

/** 打印完整用法。 */
function printUsage(): void {
  console.log(
    [
      '阿里云签名保活巡检',
      '',
      '用法：',
      '  npm run aliyun:keepalive -- [--status] [--days N]',
      '  npm run aliyun:keepalive -- --send-test <11 位手机号>',
      '  npm run aliyun:keepalive -- --mark-sent [--at <ISO8601>]',
      '  npm run aliyun:keepalive -- --help',
      '',
      '模式：',
      '  --status                [默认] 打印最近发送时间/距今/剩余/等级/是否需动作，',
      '                          以及短信·语音配置齐备性与语音日用量。',
      '  --send-test <phone>     发送一条保活测试短信（**必须显式传号，无默认值**，防误发）；',
      '                          仅当发送成功才更新保活时间戳（app_meta）。',
      '  --mark-sent             【销账】在**阿里云控制台手工测试发送后**回来登记：',
      '                          把保活时间戳写为当前时间并**立刻复算**分级。',
      '                          默认取 now；可用 --at <ISO8601>（如 2026-09-12T20:00:00Z）指定发送时刻。',
      '                          ⚠️ 仅在**确实已发送**后使用，切勿用它伪造记录掩盖问题。',
      '  --days N                覆盖阈值天数（默认 180；仅影响本次判定）。',
      '  --help, -h              显示本用法。',
      '',
      '退出码：',
      `  --status：0 = ok/warn；1 = action_due；2 = overdue / never_sent` +
        `（阈值默认 ${SIGNATURE_KEEPALIVE_THRESHOLD_DAYS} 天）`,
      '  --send-test：0 成功；2 用法错误 / 短信未配置 / 号码非法；1 发送失败',
      '  --mark-sent：退出码同 --status（销账成功后通常为 0 = ok）；用法错误 / --at 不可解析 → 2',
    ].join('\n')
  )
}

/** 打印 `--status`，返回退出码。 */
function printStatus(thresholdDays: number | undefined): number {
  const nowMs = Date.now()
  const status = evaluateSignatureKeepAlive({
    lastSentAtMs: readLastSentAtMs(),
    nowMs,
    thresholdDays,
  })
  const threshold = thresholdDays ?? SIGNATURE_KEEPALIVE_THRESHOLD_DAYS

  console.log('阿里云签名保活巡检')
  console.log(`  阈值：${threshold} 天（阿里云：超 6 个月无发送 ⇒ 报备失效）`)
  console.log('')

  if (status.lastSentAtMs == null) {
    console.log('  最近发送时间：（从未有发送记录）')
    console.log('  距今：—   剩余：—')
  } else {
    const d = new Date(status.lastSentAtMs)
    console.log(`  最近发送时间：${d.toISOString()}（UTC）`)
    console.log(`                ${d.toLocaleString('zh-CN', { hour12: false })}（本地）`)
    console.log(`  距今：${status.daysSinceLastSent} 天   剩余：${status.daysRemaining} 天`)
  }
  console.log(`  等级：${status.level}   需人工动作：${status.actionRequired ? '是' : '否'}`)
  console.log('')

  // 配置齐备性 + 语音日用量（复用既有服务；零 PII）。
  console.log(`  短信配置：${isSmsConfigured() ? '已配置' : '未配置'}    语音配置：${isVoiceConfigured() ? '已配置' : '未配置'}`)
  console.log(`  语音日用量：${getVoiceDailyCount()} / ${getVoiceDailyLimit()}`)

  return levelExitCode(status.level)
}

/** 执行 `--send-test`，返回退出码。 */
async function sendTest(phone: string): Promise<number> {
  if (!CN_MOBILE.test(phone)) {
    console.error(`[keepalive] 拒绝：号码非法（需 11 位中国大陆手机号）：${maskPhone(phone)}`)
    return 2
  }
  if (!isSmsConfigured()) {
    // 明确报错并非零退出 —— 绝不静默（本项目已有「静默失效」的教训）。
    console.error(
      '[keepalive] 拒绝：短信未配置（缺 ALIYUN_SMS_ACCESS_KEY_ID / ACCESS_KEY_SECRET / SIGN_NAME / TEMPLATE_CODE 中至少一项）'
    )
    return 2
  }

  const r = await sendSms(phone, { device: '保活测试', address: '请忽略' })
  if (!r.ok) {
    console.error(
      `[keepalive] 保活短信发送失败：${maskPhone(phone)} reason=${r.reason ?? ''} code=${r.code ?? ''} message=${r.message ?? ''}`
    )
    return 1
  }

  // 仅成功才更新保活时间戳（写入 app_meta；不动 aed_sms_dispatches）。
  const nowMs = Date.now()
  setMeta(SIGNATURE_LAST_SENT_META_KEY, String(nowMs))
  console.log(`[keepalive] 保活短信已受理：${maskPhone(phone)}  bizId=${r.bizId ?? '(none)'}`)
  console.log(`[keepalive] 已更新保活时间戳 ${SIGNATURE_LAST_SENT_META_KEY}=${nowMs}`)
  return 0
}

/**
 * 执行 `--mark-sent`（销账），返回退出码。
 *
 * 场景：运维在**阿里云控制台**手工「测试发送」后回来登记 —— 那次发送不经本项目，
 * `aed_sms_dispatches` 无记录、`app_meta` 也不会自动更新，若不销账，巡检会**一直报
 * overdue**（修好了却永远报警）。本子命令把 `app_meta.aliyun_signature_last_sent_ms`
 * 写为指定时刻并**立刻复算**分级，使操作者即时看到「已销账、现在 level=ok」。
 *
 * ⚠️ 仅在**确实已发送**后使用；不得用于伪造记录掩盖问题。
 *
 * @param thresholdDays 覆盖阈值（仅影响本次复算的分级）
 * @param atMs 登记为「最近发送」的时刻（ms）
 */
function markSent(thresholdDays: number | undefined, atMs: number): number {
  setMeta(SIGNATURE_LAST_SENT_META_KEY, String(atMs))
  const d = new Date(atMs)

  console.log('[keepalive] 已登记保活发送时间（销账）')
  console.log(`  ${SIGNATURE_LAST_SENT_META_KEY}=${atMs}`)
  console.log(`  即 ${d.toISOString()}（UTC） / ${d.toLocaleString('zh-CN', { hour12: false })}（本地）`)

  // 立刻复算：读回（取 db 与 meta 的较晚者，与实际看板一致）再判定。
  const nowMs = Date.now()
  const status = evaluateSignatureKeepAlive({
    lastSentAtMs: readLastSentAtMs(),
    nowMs,
    thresholdDays,
  })
  const threshold = thresholdDays ?? SIGNATURE_KEEPALIVE_THRESHOLD_DAYS
  console.log('')
  console.log(
    `  复算（阈值 ${threshold} 天）：距今 ${status.daysSinceLastSent} 天   剩余 ${status.daysRemaining} 天   ` +
      `等级：${status.level}   需人工动作：${status.actionRequired ? '是' : '否'}`
  )

  return levelExitCode(status.level)
}

/** 解析 argv 并分发；返回退出码。 */
async function main(argv: string[]): Promise<number> {
  let mode: 'status' | 'send_test' | 'mark_sent' | 'help' = 'status'
  let testPhone = ''
  let markAtMs: number | null = null
  let thresholdDays: number | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--help' || arg === '-h') {
      mode = 'help'
    } else if (arg === '--status') {
      mode = 'status'
    } else if (arg === '--send-test') {
      mode = 'send_test'
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        testPhone = argv[i + 1]
        i++
      } else {
        testPhone = ''
      }
    } else if (arg.startsWith('--send-test=')) {
      mode = 'send_test'
      testPhone = arg.slice('--send-test='.length)
    } else if (arg === '--mark-sent') {
      mode = 'mark_sent'
    } else if (arg === '--at') {
      const raw = i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[++i] : ''
      const ms = parseIsoMs(raw)
      if (ms == null) {
        console.error(`[keepalive] --at 时间无法解析（需 ISO8601，如 2026-09-12T20:00:00Z）：${raw || '(空)'}`)
        return 2
      }
      markAtMs = ms
    } else if (arg.startsWith('--at=')) {
      const raw = arg.slice('--at='.length)
      const ms = parseIsoMs(raw)
      if (ms == null) {
        console.error(`[keepalive] --at 时间无法解析（需 ISO8601，如 2026-09-12T20:00:00Z）：${raw || '(空)'}`)
        return 2
      }
      markAtMs = ms
    } else if (arg === '--days') {
      const raw = i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[++i] : ''
      const n = Number(raw)
      if (!Number.isInteger(n) || n <= 0) {
        console.error(`[keepalive] --days 需为正整数，收到：${raw || '(空)'}`)
        return 2
      }
      thresholdDays = n
    } else if (arg.startsWith('--days=')) {
      const raw = arg.slice('--days='.length)
      const n = Number(raw)
      if (!Number.isInteger(n) || n <= 0) {
        console.error(`[keepalive] --days 需为正整数，收到：${raw || '(空)'}`)
        return 2
      }
      thresholdDays = n
    } else {
      console.error(`[keepalive] 未知参数：${arg}`)
      printUsage()
      return 2
    }
  }

  if (mode === 'help') {
    printUsage()
    return 0
  }
  if (markAtMs != null && mode !== 'mark_sent') {
    console.error('[keepalive] --at 仅可与 --mark-sent 一起使用')
    return 2
  }
  if (mode === 'send_test') {
    if (!testPhone) {
      console.error('[keepalive] --send-test 需要显式传入 11 位手机号（无默认值，防误发）')
      printUsage()
      return 2
    }
    return sendTest(testPhone)
  }
  if (mode === 'mark_sent') {
    // 未显式给 --at ⇒ 登记为当前时刻。
    return markSent(thresholdDays, markAtMs ?? Date.now())
  }
  return printStatus(thresholdDays)
}

initDb()

async function run(): Promise<void> {
  let exitCode: number
  try {
    exitCode = await main(process.argv.slice(2))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[keepalive] 意外错误：${msg}`)
    exitCode = 1
  }
  process.exit(exitCode)
}

void run()
