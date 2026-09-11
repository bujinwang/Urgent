import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { server, seedTestData, addCustodian, addPushSubscription, db } from './setup'
import * as pushService from '../services/pushService'

const AED_ID = 'aed_001'
const TPL = 'tpl_aed_custodian_request'

/** 微信登录拿 token 与身份 id（openid）。 */
async function login(code: string): Promise<{ token: string; id: string }> {
  const res = await request(server).post('/api/auth/wechat-login').send({ code })
  return { token: res.body.data.token as string, id: res.body.data.openid as string }
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function alertCount(): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM aed_custodian_alerts').get() as { c: number }
  return row.c
}

// 恢复对 pushService 的 spy，避免跨用例串扰
afterEach(() => { vi.restoreAllMocks() })

/** 造一个「急救者通知责任人」的 alert（primary + backup 均已订阅）。 */
async function setupAlert() {
  const req = await login('requester')
  const cp = await login('primary')
  const cb = await login('backup')
  addCustodian(AED_ID, cp.id, '陈敏', 'primary')
  addCustodian(AED_ID, cb.id, '王磊', 'backup')
  addPushSubscription(cp.id, TPL, true)
  addPushSubscription(cb.id, TPL, true)
  const n = await request(server)
    .post(`/api/aed/${AED_ID}/notify-custodian`)
    .set(auth(req.token))
    .send({ consentGranted: true })
  return { req, cp, cb, alertId: n.body.data.alertId as string }
}

/* ══════════════════ notify-custodian ══════════════════ */

describe('AED 责任人联动 — notify-custodian', () => {
  beforeEach(() => { seedTestData() })

  it('需要登录（无 token → 401）', async () => {
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/notify-custodian`)
      .send({ consentGranted: true })
    expect(res.status).toBe(401)
  })

  it('未同意 PIPL → HTTP 200 + code 4006', async () => {
    const req = await login('requester')
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/notify-custodian`)
      .set(auth(req.token))
      .send({ consentGranted: false })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(4006)
  })

  it('缺少 consentGranted → 400 参数校验失败', async () => {
    const req = await login('requester')
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/notify-custodian`)
      .set(auth(req.token))
      .send({})
    expect(res.status).toBe(400)
  })

  it('设备不存在 → 404 + 4007', async () => {
    const req = await login('requester')
    const res = await request(server)
      .post('/api/aed/aed_not_exist/notify-custodian')
      .set(auth(req.token))
      .send({ consentGranted: true })
    expect(res.status).toBe(404)
    expect(res.body.code).toBe(4007)
  })

  it('无责任人 → HTTP 200 + 4001，且不落 alert（不阻断急救）', async () => {
    const req = await login('requester')
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/notify-custodian`)
      .set(auth(req.token))
      .send({ consentGranted: true })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(4001)
    expect(alertCount()).toBe(0)
  })

  it('主备并行通知：primary 与 backup 均被扇出（谁先确认谁生效）', async () => {
    const req = await login('requester')
    const cp = await login('primary')
    const cb = await login('backup')
    addCustodian(AED_ID, cp.id, '陈敏', 'primary')
    addCustodian(AED_ID, cb.id, '王磊', 'backup')
    // 只给 backup 订阅：既证明 backup 可达，也证明 primary 仍会被「尝试」推送（扇出）。
    addPushSubscription(cb.id, TPL, true)

    // 记录定向推送的扇出（spy 保留真实实现：dev 模式下仍会真正送达）
    const spy = vi.spyOn(pushService, 'sendPushToUser')

    const res = await request(server)
      .post(`/api/aed/${AED_ID}/notify-custodian`)
      .set(auth(req.token))
      .send({ consentGranted: true, consentVersion: 'v1' })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.alertId).toMatch(/^ca_/)
    expect(res.body.data.status).toBe('sent')
    expect(res.body.data.deliveryState).toBe('delivered')
    expect(res.body.data.commandStatus).toBe('not_issued')
    expect(res.body.data.slaDeadlineMs - res.body.data.notifyTimeMs).toBe(120000)
    expect(alertCount()).toBe(1)

    // ★ 扇出断言 1：推送次数 == 该 AED 的 manager 数（2），且收件人集合 == {primary, backup}
    expect(spy).toHaveBeenCalledTimes(2)
    const calledUserIds = spy.mock.calls.map((call) => call[0])
    expect(new Set(calledUserIds)).toEqual(new Set([cp.id, cb.id]))
    for (const call of spy.mock.calls) {
      expect(call[1].templateId).toBe(TPL)
    }

    // ★ 扇出断言 2：审计描述含 manager 数（"2 名"），锁死扇出语义
    const audit = db
      .prepare("SELECT description FROM aed_audit_log WHERE event_type='custodian_notified' ORDER BY rowid DESC LIMIT 1")
      .get() as { description: string } | undefined
    expect(audit?.description).toContain('2 名')
  })

  it('无订阅 → unreachable / no_subscription（仍返回 alertId）', async () => {
    const req = await login('requester')
    const cp = await login('primary')
    addCustodian(AED_ID, cp.id, '陈敏', 'primary')
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/notify-custodian`)
      .set(auth(req.token))
      .send({ consentGranted: true })
    expect(res.body.code).toBe(0)
    expect(res.body.data.status).toBe('unreachable')
    expect(res.body.data.deliveryState).toBe('no_subscription')
  })

  it('写入审计 custodian_notified', async () => {
    const { alertId } = await setupAlert()
    expect(alertId).toBeTruthy()
    const row = db.prepare("SELECT COUNT(*) AS c FROM aed_audit_log WHERE event_type='custodian_notified'").get() as { c: number }
    expect(row.c).toBeGreaterThanOrEqual(1)
  })
})

/* ══════════════════ unlock ══════════════════ */

describe('AED 责任人联动 — unlock（确认授权）', () => {
  beforeEach(() => { seedTestData() })

  it('责任人确认授权 → acknowledged + issued + unlockToken + slaMet=true', async () => {
    const { cp, alertId } = await setupAlert()
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/unlock`)
      .set(auth(cp.token))
      .send({ alertId, action: 'authorize' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.status).toBe('acknowledged')
    expect(res.body.data.unlockAction).toBe('authorize')
    expect(res.body.data.commandStatus).toBe('issued')
    expect(res.body.data.unlockToken).toMatch(/^ut_/)
    expect(res.body.data.slaMet).toBe(true)
  })

  it('责任人拒绝 → rejected + not_issued + 无 token', async () => {
    const { cp, alertId } = await setupAlert()
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/unlock`)
      .set(auth(cp.token))
      .send({ alertId, action: 'deny' })
    expect(res.body.code).toBe(0)
    expect(res.body.data.status).toBe('rejected')
    expect(res.body.data.commandStatus).toBe('not_issued')
    expect(res.body.data.unlockToken).toBeUndefined()
  })

  it('非责任人 → HTTP 403 + code 4003', async () => {
    const { req, alertId } = await setupAlert()
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/unlock`)
      .set(auth(req.token))
      .send({ alertId, action: 'authorize' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe(4003)
  })

  it('alert 不存在 → 404 + 4002', async () => {
    const cp = await login('primary')
    addCustodian(AED_ID, cp.id, '陈敏', 'primary')
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/unlock`)
      .set(auth(cp.token))
      .send({ alertId: 'ca_missing', action: 'authorize' })
    expect(res.status).toBe(404)
    expect(res.body.code).toBe(4002)
  })

  it('首确认幂等：同一人重试 → 200 idempotent；他人确认 → 409 / 4004', async () => {
    const { cp, cb, alertId } = await setupAlert()

    const first = await request(server)
      .post(`/api/aed/${AED_ID}/unlock`)
      .set(auth(cp.token))
      .send({ alertId, action: 'authorize' })
    expect(first.body.data.status).toBe('acknowledged')
    const firstRespondedMs = first.body.data.respondedTimeMs

    // 同一人同一动作重试 → 幂等，不覆盖 responded_time_ms
    const retry = await request(server)
      .post(`/api/aed/${AED_ID}/unlock`)
      .set(auth(cp.token))
      .send({ alertId, action: 'authorize' })
    expect(retry.status).toBe(200)
    expect(retry.body.data.idempotent).toBe(true)
    expect(retry.body.data.respondedTimeMs).toBe(firstRespondedMs)

    // 他人确认（即便动作相同）→ 已被他人确认
    const other = await request(server)
      .post(`/api/aed/${AED_ID}/unlock`)
      .set(auth(cb.token))
      .send({ alertId, action: 'authorize' })
    expect(other.status).toBe(409)
    expect(other.body.code).toBe(4004)
  })

  it('超时后迟到授权 → 仍受理且 slaMet=false', async () => {
    const { cp, alertId } = await setupAlert()
    // 让 SLA 截止时间已成为过去
    db.prepare('UPDATE aed_custodian_alerts SET sla_deadline_ms = ? WHERE id = ?').run(Date.now() - 1000, alertId)

    const res = await request(server)
      .post(`/api/aed/${AED_ID}/unlock`)
      .set(auth(cp.token))
      .send({ alertId, action: 'authorize' })
    expect(res.body.code).toBe(0)
    expect(res.body.data.status).toBe('acknowledged')
    expect(res.body.data.slaMet).toBe(false)
  })

  it('写入审计 custodian_acknowledged + unlock_issued', async () => {
    const { cp, alertId } = await setupAlert()
    await request(server).post(`/api/aed/${AED_ID}/unlock`).set(auth(cp.token)).send({ alertId, action: 'authorize' })
    const ack = db.prepare("SELECT COUNT(*) AS c FROM aed_audit_log WHERE event_type='custodian_acknowledged'").get() as { c: number }
    const issued = db.prepare("SELECT COUNT(*) AS c FROM aed_audit_log WHERE event_type='unlock_issued'").get() as { c: number }
    expect(ack.c).toBeGreaterThanOrEqual(1)
    expect(issued.c).toBeGreaterThanOrEqual(1)
  })
})

/* ══════════════════ 状态回读 / 收件箱 / 撤回同意 ══════════════════ */

describe('AED 责任人联动 — 回读 / 收件箱 / 撤回同意', () => {
  beforeEach(() => { seedTestData() })

  it('状态回读：返回 camelCase 且不泄露责任人手机号', async () => {
    const { req, alertId } = await setupAlert()
    const res = await request(server)
      .get(`/api/aed/${AED_ID}/custodian-alerts/${alertId}`)
      .set(auth(req.token))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.id).toBe(alertId)
    expect(res.body.data.aedId).toBe(AED_ID)
    expect(res.body.data.status).toBe('sent')
    expect(typeof res.body.data.slaDeadlineMs).toBe('number')
    expect(res.body.data.custodianPhone).toBeUndefined()
    expect(res.body.data.custodianPhoneSnapshot).toBeUndefined()
  })

  it('状态回读：惰性过期（超 SLA → expired）', async () => {
    const { req, alertId } = await setupAlert()
    db.prepare('UPDATE aed_custodian_alerts SET sla_deadline_ms = ? WHERE id = ?').run(Date.now() - 1000, alertId)
    const res = await request(server)
      .get(`/api/aed/${AED_ID}/custodian-alerts/${alertId}`)
      .set(auth(req.token))
    expect(res.body.data.status).toBe('expired')
    const audit = db.prepare("SELECT COUNT(*) AS c FROM aed_audit_log WHERE event_type='custodian_unreachable'").get() as { c: number }
    expect(audit.c).toBeGreaterThanOrEqual(1)
  })

  it('状态回读：设备不匹配 → 404 + 4002', async () => {
    const { req, alertId } = await setupAlert()
    const res = await request(server)
      .get(`/api/aed/aed_other/custodian-alerts/${alertId}`)
      .set(auth(req.token))
    expect(res.status).toBe(404)
    expect(res.body.code).toBe(4002)
  })

  it('责任人收件箱：primary 与 backup 都能看到待处理求助', async () => {
    const { cp, cb } = await setupAlert()

    const asPrimary = await request(server)
      .get('/api/aed/custodian-alerts/pending')
      .set(auth(cp.token))
    expect(asPrimary.body.code).toBe(0)
    expect(asPrimary.body.data.length).toBe(1)

    const asBackup = await request(server)
      .get('/api/aed/custodian-alerts/pending')
      .set(auth(cb.token))
    expect(asBackup.body.code).toBe(0)
    expect(asBackup.body.data.length).toBe(1)
  })

  it('撤回同意：急救者本人可撤回', async () => {
    const { req, alertId } = await setupAlert()
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/custodian-alerts/${alertId}/revoke-consent`)
      .set(auth(req.token))
      .send({ reason: 'dev' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.consentGranted).toBe(false)
    expect(typeof res.body.data.revokedAtMs).toBe('number')

    const row = db.prepare('SELECT consent_granted, consent_revoked_at_ms FROM aed_custodian_alerts WHERE id = ?').get(alertId) as { consent_granted: number; consent_revoked_at_ms: number }
    expect(row.consent_granted).toBe(0)
    expect(row.consent_revoked_at_ms).toBeGreaterThan(0)
  })

  it('撤回同意：无关用户 → 403', async () => {
    const { alertId } = await setupAlert()
    const stranger = await login('stranger')
    const res = await request(server)
      .post(`/api/aed/${AED_ID}/custodian-alerts/${alertId}/revoke-consent`)
      .set(auth(stranger.token))
      .send({})
    expect(res.status).toBe(403)
    expect(res.body.code).toBe(4003)
  })
})
