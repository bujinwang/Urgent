/**
 * 阿里云签名「保活」判定的**纯决策逻辑**。
 *
 * 背景：阿里云规定签名报备通过后**超过 6 个月无任何发送记录**即「报备失效」且发送失败
 * （官方《短信签名实名制报备》<https://help.aliyun.com/document_detail/2873145.html>）。
 * 本项目属**低频**场景，需把「巡检」机制化。
 *
 * 本模块与 `smsService`/`db` **解耦**（不 import 任何 IO），因此：
 * 1. 边界可**独立单测**（含恰好 180 天、未来时间戳等）；
 * 2. 不会被 CLI 顶层 `initDb()/process.exit()` 的副作用污染——取数在别处（见
 *    `services/signatureKeepAlive.ts`）。
 *
 * **纯函数**：不读 `Date.now()`、不读 DB、不读 env；`nowMs` 由调用方注入。
 */

/** 默认阈值：阿里云「6 个月无发送 ⇒ 报备失效」，即 180 天。 */
export const SIGNATURE_KEEPALIVE_THRESHOLD_DAYS = 180

/** 保活等级（由宽到严）。 */
export type KeepAliveLevel = 'never_sent' | 'overdue' | 'action_due' | 'warn' | 'ok'

/** 保活判定结果。 */
export interface KeepAliveStatus {
  /** 最近一次发送时间（UTC epoch ms）；从未有过记录时为 `null`。 */
  lastSentAtMs: number | null
  /** 距最近一次发送的天数（向下取整）；`never_sent` 时为 `null`。 */
  daysSinceLastSent: number | null
  /** 距阈值还剩几天（可为负，表示已超期）；`never_sent` 时为 `null`。 */
  daysRemaining: number | null
  /** 等级。 */
  level: KeepAliveLevel
  /** 是否需人工动作（`never_sent`/`overdue`/`action_due` 为 `true`）。 */
  actionRequired: boolean
}

const MS_PER_DAY = 86_400_000

/**
 * 评估签名保活状态。**纯函数**。
 *
 * 分级（默认阈值 180）：
 * | 条件 | level | actionRequired |
 * |---|---|---|
 * | `lastSentAtMs == null`（从未发送） | `never_sent` | `true` |
 * | `daysSince >= threshold`（**恰好 180 即 overdue**） | `overdue` | `true` |
 * | `daysSince >= threshold - 30`（≥150） | `action_due` | `true` |
 * | `daysSince >= threshold - 60`（≥120） | `warn` | `false` |
 * | 其它 | `ok` | `false` |
 *
 * `daysSince = max(0, floor((nowMs - lastSentAtMs) / 86_400_000))` —— 对**未来时间戳**防御性
 * 归零（不返回负数）。
 *
 * @param input.lastSentAtMs 最近发送时间（ms）或 `null`
 * @param input.nowMs        当前时间（ms），由调用方注入
 * @param input.thresholdDays 覆盖阈值（默认 {@link SIGNATURE_KEEPALIVE_THRESHOLD_DAYS}；建议 ≥60）
 */
export function evaluateSignatureKeepAlive(input: {
  lastSentAtMs: number | null
  nowMs: number
  thresholdDays?: number
}): KeepAliveStatus {
  const threshold = input.thresholdDays ?? SIGNATURE_KEEPALIVE_THRESHOLD_DAYS

  if (input.lastSentAtMs == null) {
    return {
      lastSentAtMs: null,
      daysSinceLastSent: null,
      daysRemaining: null,
      level: 'never_sent',
      actionRequired: true,
    }
  }

  // 防御未来时间戳（时钟回拨/数据异常）：不返回负数。
  const daysSinceLastSent = Math.max(0, Math.floor((input.nowMs - input.lastSentAtMs) / MS_PER_DAY))
  const daysRemaining = threshold - daysSinceLastSent

  let level: KeepAliveLevel
  let actionRequired: boolean
  if (daysSinceLastSent >= threshold) {
    level = 'overdue'
    actionRequired = true
  } else if (daysSinceLastSent >= threshold - 30) {
    level = 'action_due'
    actionRequired = true
  } else if (daysSinceLastSent >= threshold - 60) {
    level = 'warn'
    actionRequired = false
  } else {
    level = 'ok'
    actionRequired = false
  }

  return { lastSentAtMs: input.lastSentAtMs, daysSinceLastSent, daysRemaining, level, actionRequired }
}
