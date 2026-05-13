import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('Auth Middleware', () => {
  beforeEach(() => { seedTestData() })

  it('rejects missing Authorization header', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.code).toBe(-1)
  })

  it('rejects malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'NotBearer token')
    expect(res.status).toBe(401)
  })

  it('rejects expired/invalid JWT', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJvcGVuaWQiOiJ0ZXN0In0.invalid')
    expect(res.status).toBe(401)
  })

  it('allows access with valid token', async () => {
    const login = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'test_middleware' })
    const token = login.body.data.token

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('push register requires valid auth', async () => {
    const login = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'push_auth_test' })
    const token = login.body.data.token

    const res = await request(app)
      .post('/api/push/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId: 'test', accepted: true })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('push send requires valid auth', async () => {
    const login = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'push_send_auth' })
    const token = login.body.data.token

    const res = await request(app)
      .post('/api/push/send')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })
})
