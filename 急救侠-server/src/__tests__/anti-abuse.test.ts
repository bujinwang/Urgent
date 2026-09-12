import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { server, seedTestData, addCustodian, db } from './setup'
import { AlertCode } from '../types'
import * as pushService from '../services/pushService'
import * as smsService from '../services/smsService'
import * as voiceService from '../services/voiceService'

const AED_A = 'aed_001'

async function login(code: string): Promise<{ token: string; id: string }> {
  const res = await request(server).post('/api/auth/wechat-login').send({ code })
  return { token: res.body.data.token as string, id: res.body.data.openid as string }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function notify(aedId: string, token: string) {
  return request(server).post(`/api/aed/${aedId}/notify-custodian`).set(auth(token)).send({ consentGranted: true })
}

function alertCount(aedId?: string): number {
  const row = aedId
    ? (db.prepare('SELECT COUNT(*) AS c FROM aed_custodian_alerts WHERE aed_id=?').get(aedId) as { c: number })
    : (db.prepare('SELECT COUNT(*) AS c FROM aed_custodian_alerts').get() as { c: number })
  return row.c
}

function blockedAudits(): Array<{ description: string }> {
  return db.prepare("SELECT description FROM aed_audit_log WHERE event_type='custodian_notify_blocked'").all() as Array<{ description: string }>
}

/** 造一个「有责任人、无订阅」的设备（无订阅 ⇒ 推送必然失败，但 notify 本身成功）。 */
async function setupDeviceAndRequester(aedId = AED_A, rc = 'requester', cc = 'primary') {
  // 注意：dev 模式 openid = 'dev_' + code.slice(0,8) ⇒ 测试 code 需 ≤8 字符且互不相同
  const requester = await login(rc)
  const custodian = await login(cc)
  db.prepare('INSERT OR IGNORE INTO aed_devices (id, name, address, lat, lng, distance, status, last_check, battery_level) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(aedId, 'AED ' + aedId, '深圳', 22.5, 114.0, 80, 'available', '2025-05-01', 98)
  addCustodian(aedId, custodian.id, '陈敏', 'primary')
  return { requester, custodian }
}

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.AED_NOTIFY_COOLDOWN_MS
  delete process.env.AED_NOTIFY_HOURLY_LIMIT
})

describe('反滥用 — notify-custodian 冷却 + 小时上限', () => {
  beforeEach(() => { seedTestData() })

  it('冷却中第二次 ⇒ 429 / RATE_LIMITED，且**零触达**（不落 alert、不推送/短信/语音）', async () => {
    const { requester } = await setupDeviceAndRequester()
    const pushSpy = vi.spyOn(pushService, 'sendPushToUser')
    const smsSpy = vi.spyOn(smsService, 'sendSms')
    const voiceSpy = vi.spyOn(voiceService, 'sendVoiceCall')

    const first = await notify(AED_A, requester.token)
    expect(first.body.code).toBe(0)
    const alertsAfterFirst = alertCount()
    const pushesAfterFirst = pushSpy.mock.calls.length
    expect(alertsAfterFirst).toBe(1)
    expect(pushesAfterFirst).toBe(1) // 第一次确实发生了触达尝试

    const second = await notify(AED_A, requester.token)
    expect(second.status).toBe(429)
    expect(second.body.code).toBe(AlertCode.RATE_LIMITED)
    expect(second.body.message).toContain('请勿重复通知')

    // ★ 零触达：无新增告警、无新增推送、无短信/语音
    expect(alertCount()).toBe(alertsAfterFirst)
    expect(pushSpy.mock.calls.length).toBe(pushesAfterFirst)
    expect(smsSpy).not.toHaveBeenCalled()
    expect(voiceSpy).not.toHaveBeenCalled()

    // 留痕
    const blocked = blockedAudits()
    expect(blocked.length).toBeGreaterThanOrEqual(1)
    expect(blocked[blocked.length - 1].description).toContain('冷却')
  })

  it('冷却期过后（把上次 notify_time_ms 回拨）可再次发起（200）', async () => {
    const { requester } = await setupDeviceAndRequester()
    await notify(AED_A, requester.token)
    // 把该告警回拨到冷却期之外（可控时间，不 sleep）
    db.prepare('UPDATE aed_custodian_alerts SET notify_time_ms = notify_time_ms - ?').run(200000)

    const again = await notify(AED_A, requester.token)
    expect(again.body.code).toBe(0)
    expect(alertCount()).toBe(2)
  })

  it('超过小时上限 ⇒ 429（message 为「操作过于频繁」），且零触达', async () => {
    process.env.AED_NOTIFY_COOLDOWN_MS = '0' // 关闭冷却，只验小时上限
    process.env.AED_NOTIFY_HOURLY_LIMIT = '2'
    const { requester } = await setupDeviceAndRequester()
    const pushSpy = vi.spyOn(pushService, 'sendPushToUser')

    expect((await notify(AED_A, requester.token)).body.code).toBe(0)
    expect((await notify(AED_A, requester.token)).body.code).toBe(0)
    const before = alertCount()
    const pushesBefore = pushSpy.mock.calls.length // 2

    const third = await notify(AED_A, requester.token)
    expect(third.status).toBe(429)
    expect(third.body.code).toBe(AlertCode.RATE_LIMITED)
    expect(third.body.message).toContain('操作过于频繁')
    expect(alertCount()).toBe(before) // 零新增
    expect(pushSpy.mock.calls.length).toBe(pushesBefore) // 零新增推送
    expect(blockedAudits().some((b) => b.description.includes('超限'))).toBe(true)
  })

  it('不同 AED / 不同请求者互不影响（不误伤正常路径）', async () => {
    const a = await setupDeviceAndRequester(AED_A, 'reqA0001', 'cusA0001')
    const b = await setupDeviceAndRequester('aed_002', 'reqB0002', 'cusB0002')
    const other = await login('reqC0003')

    expect((await notify(AED_A, a.requester.token)).body.code).toBe(0)
    // 同请求者换设备 → 不受 aed_001 冷却影响
    expect((await notify('aed_002', a.requester.token)).body.code).toBe(0)
    // 不同请求者回到 aed_001 → 不受他人冷却影响
    expect((await notify(AED_A, other.token)).body.code).toBe(0)
    // 不同请求者在 aed_002（此前由 a.requester 触发过）→ 不受影响
    expect((await notify('aed_002', b.requester.token)).body.code).toBe(0)
  })
})
