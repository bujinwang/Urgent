/**
 * 阿里云签名保活 —— **纯决策函数** 边界测试。
 *
 * 只测 `evaluateSignatureKeepAlive`（无 IO）。DB 取数（UTC 基准、max 语义）与看板字段
 * 的测试在 `admin-dashboard.test.ts`。
 */

import { describe, it, expect } from 'vitest'
import {
  evaluateSignatureKeepAlive,
  SIGNATURE_KEEPALIVE_THRESHOLD_DAYS,
  type KeepAliveLevel,
} from '../scripts/keepalive-plan'

const DAY = 86_400_000
const T = SIGNATURE_KEEPALIVE_THRESHOLD_DAYS // 180（阿里云 6 个月）
const NOW = 1_700_000_000_000

/** 便捷构造：距今 `days` 天前发送过一次。 */
function atDays(days: number, thresholdDays = T) {
  return evaluateSignatureKeepAlive({
    lastSentAtMs: NOW - days * DAY,
    nowMs: NOW,
    thresholdDays,
  })
}

/** 由宽到严的序（用于单调性断言）。 */
const RANK: Record<KeepAliveLevel, number> = { ok: 0, warn: 1, action_due: 2, overdue: 3, never_sent: 4 }

describe('evaluateSignatureKeepAlive — 分级与边界', () => {
  it('从未发送 ⇒ never_sent，且三个数值字段全为 null、actionRequired=true', () => {
    const s = evaluateSignatureKeepAlive({ lastSentAtMs: null, nowMs: NOW })
    expect(s.level).toBe('never_sent')
    expect(s.actionRequired).toBe(true)
    expect(s.lastSentAtMs).toBeNull()
    expect(s.daysSinceLastSent).toBeNull()
    expect(s.daysRemaining).toBeNull()
  })

  it('恰好 119/120：ok → warn（120 = threshold-60）', () => {
    expect(atDays(119).level).toBe('ok')
    expect(atDays(120).level).toBe('warn')
    expect(atDays(120).actionRequired).toBe(false)
  })

  it('恰好 149/150：warn → action_due（150 = threshold-30）', () => {
    expect(atDays(149).level).toBe('warn')
    expect(atDays(150).level).toBe('action_due')
    expect(atDays(150).actionRequired).toBe(true)
  })

  it('恰好 179/180/181：action_due → overdue（180 即 overdue）', () => {
    expect(atDays(179).level).toBe('action_due')
    expect(atDays(180).level).toBe('overdue')
    expect(atDays(181).level).toBe('overdue')
    expect(atDays(180).actionRequired).toBe(true)
  })

  it('未来时间戳 ⇒ daysSinceLastSent=0（不返回负数），level=ok', () => {
    const s = evaluateSignatureKeepAlive({ lastSentAtMs: NOW + 10 * DAY, nowMs: NOW })
    expect(s.daysSinceLastSent).toBe(0)
    expect(s.level).toBe('ok')
    expect(s.daysRemaining).toBe(T)
  })

  it('自定义 thresholdDays：90 时 29=ok / 30=warn / 60=action_due / 90=overdue', () => {
    expect(atDays(29, 90).level).toBe('ok')
    expect(atDays(30, 90).level).toBe('warn')
    expect(atDays(60, 90).level).toBe('action_due')
    expect(atDays(90, 90).level).toBe('overdue')
  })

  it('daysRemaining 符号正确：100 天 ⇒ +80；180 ⇒ 0；181 ⇒ −1', () => {
    expect(atDays(100).daysRemaining).toBe(T - 100)
    expect(atDays(180).daysRemaining).toBe(0)
    expect(atDays(181).daysRemaining).toBe(-1)
  })

  it('单调性：daysSince 增大时 level 不得变宽松（ok→never_sent 序列非递减）', () => {
    let prev = -1
    for (let d = 0; d <= 400; d++) {
      const r = RANK[atDays(d).level]
      expect(r).toBeGreaterThanOrEqual(prev)
      prev = r
    }
  })
})
