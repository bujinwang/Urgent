import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('Auth Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('POST /api/auth/wechat-login', () => {
    it('returns token for valid code', async () => {
      const res = await request(app)
        .post('/api/auth/wechat-login')
        .send({ code: 'test_code_abc' })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data.token).toBeTruthy()
      expect(res.body.data.openid).toContain('dev_')
    })

    it('returns error for missing code', async () => {
      const res = await request(app)
        .post('/api/auth/wechat-login')
        .send({})
      expect(res.body.code).toBe(-1)
    })

    it('creates new user on first login', async () => {
      const res = await request(app)
        .post('/api/auth/wechat-login')
        .send({ code: 'new_user_code' })
      expect(res.body.data.user.name).toContain('急救侠')
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns user with valid token', async () => {
      const login = await request(app)
        .post('/api/auth/wechat-login')
        .send({ code: 'test_me' })
      const token = login.body.data.token

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data.name).toBeTruthy()
    })

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token')
      expect(res.status).toBe(401)
    })
  })
})
