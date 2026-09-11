import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, db, makeAdmin } from './setup'
import { sendPushToUser, PUSH_TEMPLATES } from '../services/pushService'

describe('Push Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('POST /api/push/register', () => {
    it('requires auth', async () => {
      const res = await request(server)
        .post('/api/push/register')
        .send({ templateId: 'xxx', accepted: true })
      expect(res.status).toBe(401)
    })

    it('registers push with valid token', async () => {
      const login = await request(server)
        .post('/api/auth/wechat-login')
        .send({ code: 'push_test' })
      const token = login.body.data.token

      const res = await request(server)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ templateId: 'mission', accepted: true })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })

    it('upserts duplicate registration', async () => {
      const login = await request(server)
        .post('/api/auth/wechat-login')
        .send({ code: 'push_dup' })
      const token = login.body.data.token
      const openid = login.body.data.openid

      // Register twice with same template
      await request(server)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ templateId: 'mission', accepted: true })

      await request(server)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ templateId: 'mission', accepted: false })

      // Verify only one row, accepted=0
      const rows = db.prepare('SELECT accepted FROM push_subscriptions WHERE user_id=? AND template_id=?').all(openid, 'mission') as any[]
      expect(rows.length).toBe(1)
      expect(rows[0].accepted).toBe(0)
    })
  })

  describe('POST /api/push/send', () => {
    it('requires auth', async () => {
      const res = await request(server).post('/api/push/send')
      expect(res.status).toBe(401)
    })

    it('rejects non-admin user with 403', async () => {
      const login = await request(server)
        .post('/api/auth/wechat-login')
        .send({ code: 'push_nonadmin' })
      const token = login.body.data.token

      const res = await request(server)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(403)
      expect(res.body.message).toContain('仅管理员')
    })

    it('returns success for admin user', async () => {
      const login = await request(server)
        .post('/api/auth/wechat-login')
        .send({ code: 'push_admin' })
      const token = login.body.data.token
      const openid = login.body.data.openid

      // Grant admin
      makeAdmin(openid)

      const res = await request(server)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })
  })
})

describe('sendPushToUser（定向推送）', () => {
  beforeEach(() => { seedTestData() })

  it('无订阅 → { ok:false, reason:no_subscription }', async () => {
    const r = await sendPushToUser('user_without_sub', {
      templateId: PUSH_TEMPLATES.aedCustodianRequest,
      data: { thing1: { value: 'AED 求助' } },
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('no_subscription')
  })

  it('dev 模式有订阅 → 发送成功', async () => {
    const login = await request(server).post('/api/auth/wechat-login').send({ code: 'push_to_user' })
    const id = login.body.data.openid as string
    db.prepare('INSERT INTO push_subscriptions (id, user_id, template_id, accepted) VALUES (?,?,?,?)').run(
      'ps_to_user', id, PUSH_TEMPLATES.aedCustodianRequest, 1
    )
    const r = await sendPushToUser(id, {
      templateId: PUSH_TEMPLATES.aedCustodianRequest,
      data: { thing1: { value: 'AED 求助' }, thing2: { value: '深圳湾公园 AED' } },
    })
    expect(r.ok).toBe(true)
  })

  it('订阅 accepted=0 视为无订阅', async () => {
    const login = await request(server).post('/api/auth/wechat-login').send({ code: 'push_to_user_off' })
    const id = login.body.data.openid as string
    db.prepare('INSERT INTO push_subscriptions (id, user_id, template_id, accepted) VALUES (?,?,?,?)').run(
      'ps_to_user_off', id, PUSH_TEMPLATES.aedCustodianRequest, 0
    )
    const r = await sendPushToUser(id, {
      templateId: PUSH_TEMPLATES.aedCustodianRequest,
      data: { thing1: { value: 'AED 求助' } },
    })
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('no_subscription')
  })
})
