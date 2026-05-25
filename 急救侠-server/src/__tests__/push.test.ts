import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData, db } from './setup'

describe('Push Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('POST /api/push/register', () => {
    it('requires auth', async () => {
      const res = await request(app)
        .post('/api/push/register')
        .send({ templateId: 'xxx', accepted: true })
      expect(res.status).toBe(401)
    })

    it('registers push with valid token', async () => {
      const login = await request(app)
        .post('/api/auth/wechat-login')
        .send({ code: 'push_test' })
      const token = login.body.data.token

      const res = await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ templateId: 'mission', accepted: true })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })

    it('upserts duplicate registration', async () => {
      const login = await request(app)
        .post('/api/auth/wechat-login')
        .send({ code: 'push_dup' })
      const token = login.body.data.token
      const openid = login.body.data.openid

      // Register twice with same template
      await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ templateId: 'mission', accepted: true })

      await request(app)
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
      const res = await request(app).post('/api/push/send')
      expect(res.status).toBe(401)
    })

    it('rejects non-admin user with 403', async () => {
      const login = await request(app)
        .post('/api/auth/wechat-login')
        .send({ code: 'push_nonadmin' })
      const token = login.body.data.token

      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(403)
      expect(res.body.message).toContain('仅管理员')
    })

    it('returns success for admin user', async () => {
      const login = await request(app)
        .post('/api/auth/wechat-login')
        .send({ code: 'push_admin' })
      const token = login.body.data.token
      const openid = login.body.data.openid

      // Grant admin
      db.prepare('UPDATE users SET is_leader = 1 WHERE id = ?').run(openid)

      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })
  })
})
