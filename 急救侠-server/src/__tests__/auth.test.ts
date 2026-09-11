import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData } from './setup'

describe('Auth Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('POST /api/auth/wechat-login', () => {
    it('returns token for valid code', async () => {
      const res = await request(server)
        .post('/api/auth/wechat-login')
        .send({ code: 'test_code_abc' })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data.token).toBeTruthy()
      expect(res.body.data.openid).toContain('dev_')
    })

    it('returns error for missing code', async () => {
      const res = await request(server)
        .post('/api/auth/wechat-login')
        .send({})
      expect(res.body.code).toBe(-1)
    })

    it('creates new user on first login', async () => {
      const res = await request(server)
        .post('/api/auth/wechat-login')
        .send({ code: 'new_user_code' })
      expect(res.body.data.user.name).toContain('急救侠')
    })
  })

  describe('GET /api/auth/me', () => {
    it('returns user with valid token', async () => {
      const login = await request(server)
        .post('/api/auth/wechat-login')
        .send({ code: 'test_me' })
      const token = login.body.data.token

      const res = await request(server)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data.name).toBeTruthy()
    })

    it('returns 401 without token', async () => {
      const res = await request(server).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const res = await request(server)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token')
      expect(res.status).toBe(401)
    })
  })

  describe('手机号登录 token 模型（回归：明文 token ⇒ 真 JWT）', () => {
    const PHONE = '13800138000'
    const PWD = 'pw123456'

    async function registerAndLogin(): Promise<string> {
      await request(server).post('/api/auth/register').send({ phone: PHONE, password: PWD, name: '手机用户' })
      const login = await request(server).post('/api/auth/login').send({ phone: PHONE, password: PWD })
      return login.body.data.token as string
    }

    it('注册返回的 token 可过 authMiddleware（/api/auth/me = 200）', async () => {
      const reg = await request(server).post('/api/auth/register').send({ phone: '13900139000', password: PWD })
      const token = reg.body.data.token as string
      expect(token).toBeTruthy()
      const me = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
      expect(me.status).toBe(200)
      expect(me.body.data.id).toBe('u_13900139000')
    })

    it('手机号登录 token 现可过 authMiddleware（/api/auth/me = 200，修复前 401）', async () => {
      const token = await registerAndLogin()
      const me = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${token}`)
      expect(me.status).toBe(200)
      expect(me.body.code).toBe(0)
      expect(me.body.data.id).toBe('u_' + PHONE)
    })

    it('token 不再是明文（JWT 三段式，无 token_ 前缀）', async () => {
      const token = await registerAndLogin()
      expect(token.startsWith('token_')).toBe(false)
      expect(token.split('.').length).toBe(3)
    })

    it('change-password：无 token ⇒ 401', async () => {
      await registerAndLogin()
      const res = await request(server)
        .post('/api/auth/change-password')
        .send({ phone: PHONE, oldPassword: PWD, newPassword: 'newpw123' })
      expect(res.status).toBe(401)
    })

    it('change-password：带本用户 token ⇒ 成功，且新密码可登录', async () => {
      const token = await registerAndLogin()
      const res = await request(server)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: PHONE, oldPassword: PWD, newPassword: 'newpw123' })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      const relogin = await request(server).post('/api/auth/login').send({ phone: PHONE, password: 'newpw123' })
      expect(relogin.body.code).toBe(0)
    })

    it('change-password：带 token 企图改他人密码 ⇒ 403（不再信任客户端 phone）', async () => {
      const token = await registerAndLogin()
      await request(server).post('/api/auth/register').send({ phone: '13700137000', password: 'otherpw1' })
      const res = await request(server)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '13700137000', oldPassword: 'whatever', newPassword: 'hacked123' })
      expect(res.status).toBe(403)
      // 他人密码未被篡改
      const other = await request(server).post('/api/auth/login').send({ phone: '13700137000', password: 'otherpw1' })
      expect(other.body.code).toBe(0)
    })

    it('/api/user/profile 身份取自令牌（手机号用户返回自己，而非首个用户）', async () => {
      const token = await registerAndLogin()
      const res = await request(server).get('/api/user/profile').set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe('u_' + PHONE)
    })
  })
})
