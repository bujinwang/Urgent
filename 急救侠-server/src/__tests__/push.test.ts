import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

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
  })

  describe('POST /api/push/send', () => {
    it('requires auth for send', async () => {
      const res = await request(app)
        .post('/api/push/send')
      expect(res.status).toBe(401)
    })
  })
})
