import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, db, userToken, makeAdmin } from './setup'
import { setMeta } from '../db'
import { readLastSentAtMs, SIGNATURE_LAST_SENT_META_KEY } from '../services/signatureKeepAlive'

const ADMIN = 'user_001'

function todayKey(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `voice_daily_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function addAlert(id: string, deliveryState: string, notifyMs = Date.now()): void {
  db.prepare(
    'INSERT INTO aed_custodian_alerts (id, aed_id, notify_time_ms, sla_deadline_ms, delivery_state, created_at, updated_at) VALUES (?,?,?,?,?,?,?)'
  ).run(id, 'aed_001', notifyMs, notifyMs + 1000, deliveryState, notifyMs, notifyMs)
}

function addDispatch(id: string, bizId: string, voiceState: string, voiceAtMs: number | null = null): void {
  db.prepare(
    'INSERT INTO aed_sms_dispatches (id, biz_id, alert_id, custodian_user_id, voice_state, voice_at_ms) VALUES (?,?,?,?,?,?)'
  ).run(id, bizId, 'ca_x', 'u_x', voiceState, voiceAtMs)
}

function getDash(token: string) {
  return request(server).get('/api/admin/dashboard').set('Authorization', `Bearer ${token}`)
}

const DAY = 86_400_000

/** 插入一条短信下发流水，`created_at` 用 SQLite `datetime('now', <modifier>)` 生成（**UTC 文本**）。 */
function addDispatchAt(id: string, modifier: string): void {
  db.prepare(
    `INSERT INTO aed_sms_dispatches (id, biz_id, alert_id, custodian_user_id, created_at)
     VALUES (?,?,?,?, datetime('now', ?))`
  ).run(id, 'B_' + id, 'ca_x', 'u_x', modifier)
}

afterEach(() => { delete process.env.ALIYUN_VOICE_DAILY_LIMIT })

describe('GET /api/admin/dashboard — custodianReach（责任人触达/降级可观测）', () => {
  beforeEach(() => { seedTestData(); makeAdmin(ADMIN) })

  it('空库：计数全 0，且 reachRate === null（无样本不假报 0）', async () => {
    const res = await getDash(userToken(ADMIN))
    expect(res.status).toBe(200)
    const c = res.body.data.custodianReach
    expect(c).toMatchObject({
      alerts: 0, pending: 0, delivered: 0, smsFallback: 0, failed: 0, noSubscription: 0, other: 0,
      reachRate: null,
      voice: { dispatched: 0, called: 0, failed: 0, noPhone: 0 },
      voiceDaily: { used: 0, limit: 200 },
      last24h: { alerts: 0, smsFallback: 0, voiceCalled: 0 },
    })
  })

  it('混合夹具：各状态计数正确、reachRate 精确、状态之和守恒', async () => {
    // delivery_state：delivered 3 / sms_fallback 2 / failed 1 / no_subscription 1 / pending 1 = 8
    for (let i = 0; i < 3; i++) addAlert(`ca_d${i}`, 'delivered')
    for (let i = 0; i < 2; i++) addAlert(`ca_s${i}`, 'sms_fallback')
    addAlert('ca_f0', 'failed')
    addAlert('ca_n0', 'no_subscription')
    addAlert('ca_p0', 'pending')
    // dispatch：called 2 / failed 1 / no_phone 1 / none 1 = 5
    addDispatch('sd_c0', 'B0', 'called', Date.now())
    addDispatch('sd_c1', 'B1', 'called', Date.now())
    addDispatch('sd_f0', 'B2', 'failed')
    addDispatch('sd_np0', 'B3', 'no_phone')
    addDispatch('sd_n0', 'B4', 'none')

    const res = await getDash(userToken(ADMIN))
    const c = res.body.data.custodianReach
    expect(c.alerts).toBe(8)
    expect(c.delivered).toBe(3)
    expect(c.smsFallback).toBe(2)
    expect(c.failed).toBe(1)
    expect(c.noSubscription).toBe(1)
    expect(c.pending).toBe(1)
    expect(c.reachRate).toBeCloseTo((3 + 2) / 8, 10)
    // 守恒（含 other）：六项之和 === alerts（本夹具均为已知态 ⇒ other=0）
    expect(c.other).toBe(0)
    expect(c.pending + c.delivered + c.smsFallback + c.failed + c.noSubscription + c.other).toBe(c.alerts)
    expect(c.voice).toEqual({ dispatched: 5, called: 2, failed: 1, noPhone: 1 })
  })

  it('未预期 delivery_state（`` / queued）⇒ 计入 other，六项之和仍 === alerts', async () => {
    addAlert('ca_k0', 'delivered')
    addAlert('ca_k1', 'failed')
    addAlert('ca_u0', '') // 未映射
    addAlert('ca_u1', 'queued') // 未映射（未来新增态）

    const c = (await getDash(userToken(ADMIN))).body.data.custodianReach
    expect(c.alerts).toBe(4)
    expect(c.other).toBe(2) // 两个未映射态归入 other
    expect(c.delivered).toBe(1)
    expect(c.failed).toBe(1)
    // 守恒在**任意输入**下成立
    expect(c.pending + c.delivered + c.smsFallback + c.failed + c.noSubscription + c.other).toBe(c.alerts)
  })

  it('24h 窗口：早于 24h 的告警计入累计、不计入 last24h', async () => {
    const old = Date.now() - 25 * 60 * 60 * 1000
    addAlert('ca_old', 'delivered', old) // 25h 前
    addAlert('ca_new', 'sms_fallback', Date.now()) // 现在
    addDispatch('sd_c', 'B0', 'called', old) // 25h 前呼叫 → 不计入 last24h
    addDispatch('sd_c2', 'B1', 'called', Date.now()) // 现在 → 计入

    const c = (await getDash(userToken(ADMIN))).body.data.custodianReach
    expect(c.alerts).toBe(2) // 累计含旧
    expect(c.last24h.alerts).toBe(1) // 仅新的
    expect(c.last24h.smsFallback).toBe(1)
    expect(c.voice.dispatched).toBe(2)
    expect(c.last24h.voiceCalled).toBe(1) // 仅 24h 内的 called
  })

  it('voiceDaily：used 反映当日计数、limit 取配置（env 覆盖）', async () => {
    db.prepare('INSERT INTO app_meta (key, value, updated_at) VALUES (?,?,?)').run(todayKey(), '2', Date.now())
    process.env.ALIYUN_VOICE_DAILY_LIMIT = '5'
    const c = (await getDash(userToken(ADMIN))).body.data.custodianReach
    expect(c.voiceDaily).toEqual({ used: 2, limit: 5 })
  })

  it('回归：既有字段值不变', async () => {
    const res = await getDash(userToken(ADMIN))
    const d = res.body.data
    // seedTestData 造了 1 用户 / 1 AED / 1 新闻等；组织/教练/证书/取用为 0
    expect(d.totalUsers).toBe(1)
    expect(d.totalOrganizations).toBe(0)
    expect(d.totalCoaches).toBe(0)
    expect(d.totalAeds).toBe(1)
    expect(d.totalCertificates).toBe(0)
    expect(d.activePickups).toBe(0)
    // 新增字段存在（附加，不动既有）
    expect(d.custodianReach).toBeTruthy()
  })

  it('非平台管理员 → 403（中间件不变）', async () => {
    db.prepare('UPDATE users SET is_platform_admin = 0 WHERE id = ?').run(ADMIN) // 收回管理权限
    const res = await getDash(userToken(ADMIN))
    expect(res.status).toBe(403)
  })
})

describe('GET /api/admin/dashboard — smsSignature（阿里云签名保活巡检）', () => {
  beforeEach(() => { seedTestData(); makeAdmin(ADMIN) })

  it('空库 ⇒ level=never_sent，三个数值字段全为 null（无样本不假报 0）', async () => {
    const s = (await getDash(userToken(ADMIN))).body.data.smsSignature
    expect(s.level).toBe('never_sent')
    expect(s.actionRequired).toBe(true)
    expect(s.lastSentAtMs).toBeNull()
    expect(s.daysSinceLastSent).toBeNull()
    expect(s.daysRemaining).toBeNull()
    // 形状固定为 5 个字段
    expect(Object.keys(s).sort()).toEqual(
      ['actionRequired', 'daysRemaining', 'daysSinceLastSent', 'lastSentAtMs', 'level'].sort()
    )
  })

  it('插入 100 天前的下发流水 ⇒ level=ok、daysSinceLastSent≈100', async () => {
    addDispatchAt('sd_k100', '-100 days')
    const s = (await getDash(userToken(ADMIN))).body.data.smsSignature
    expect(s.level).toBe('ok')
    expect(s.daysSinceLastSent).toBe(100)
    expect(s.daysRemaining).toBe(180 - 100)
  })

  it('取证 db 与 meta 取 max：db=-100d、meta=-5d ⇒ 用 meta（更晚）', async () => {
    addDispatchAt('sd_k100b', '-100 days')
    setMeta(SIGNATURE_LAST_SENT_META_KEY, String(Date.now() - 5 * DAY))
    const s = (await getDash(userToken(ADMIN))).body.data.smsSignature
    expect(s.daysSinceLastSent).toBe(5)
    expect(s.level).toBe('ok')
  })

  it('取证 max 语义（反向）：db=-1d、meta=-100d ⇒ 用 db（更晚）', async () => {
    addDispatchAt('sd_k1', '-1 days')
    setMeta(SIGNATURE_LAST_SENT_META_KEY, String(Date.now() - 100 * DAY))
    const s = (await getDash(userToken(ADMIN))).body.data.smsSignature
    expect(s.daysSinceLastSent).toBe(1)
  })

  it('UTC 基准取证：DB 默认 created_at（datetime(\'now\')）与 Date.now() 同基准（差 < 60s，而非时区偏移 8h）', () => {
    addDispatchAt('sd_now', '+0 seconds') // 即 datetime('now')
    const ms = readLastSentAtMs()
    expect(ms).not.toBeNull()
    // 若把 UTC 文本按本地时区解析，东八区会差 8h（28,800,000ms）⇒ 本条会失败。
    expect(Math.abs((ms as number) - Date.now())).toBeLessThan(60_000)
  })

  it('回归：既有 custodianReach 字段逐字未变（纯新增 smsSignature）', async () => {
    const d = (await getDash(userToken(ADMIN))).body.data
    expect(d.custodianReach).toMatchObject({
      alerts: 0, pending: 0, delivered: 0, smsFallback: 0, failed: 0, noSubscription: 0, other: 0,
      reachRate: null,
      voice: { dispatched: 0, called: 0, failed: 0, noPhone: 0 },
      voiceDaily: { used: 0, limit: 200 },
      last24h: { alerts: 0, smsFallback: 0, voiceCalled: 0 },
    })
  })
})
