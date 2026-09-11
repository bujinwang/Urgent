import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, seedGovViewer, db } from './setup'
import { signToken } from '../middleware/auth'

const GOV = '/api/gov'

describe('Gov 鉴权与隔离（P2-8）', () => {
  beforeEach(() => { seedTestData() })

  it('登录成功 → 返回 gov token + viewer（不含 password_hash）', async () => {
    const v = seedGovViewer({ username: 'g1', password: 'pw123456' })
    const res = await request(server).post(`${GOV}/login`).send({ username: 'g1', password: 'pw123456' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(typeof res.body.data.token).toBe('string')
    expect(res.body.data.viewer).toMatchObject({ id: v.id, scopeAll: false })
    expect(res.body.data.viewer.password_hash).toBeUndefined()
    expect(res.body.data.viewer.passwordHash).toBeUndefined()
  })

  it('密码错误 → 401', async () => {
    seedGovViewer({ username: 'g2', password: 'rightpass' })
    const res = await request(server).post(`${GOV}/login`).send({ username: 'g2', password: 'wrongpass' })
    expect(res.status).toBe(401)
  })

  it('停用账号登录 → 403', async () => {
    seedGovViewer({ username: 'g3', password: 'pw123456', active: false })
    const res = await request(server).post(`${GOV}/login`).send({ username: 'g3', password: 'pw123456' })
    expect(res.status).toBe(403)
  })

  it('无令牌访问 gov 受保护路由 → 401', async () => {
    const res = await request(server).get(`${GOV}/dashboard`)
    expect(res.status).toBe(401)
  })

  it('业务 jwt_token 不能访问 gov 路由（无 gov 声明）', async () => {
    seedGovViewer({ username: 'g4' })
    const bizToken = signToken({ openid: 'dev_x', userId: 'u_1' })
    const res = await request(server).get(`${GOV}/dashboard`).set('Authorization', `Bearer ${bizToken}`)
    expect(res.status).toBe(401)
  })

  it('gov_token 在令牌层即被业务鉴权拒绝（/api/auth/me ⇒ 401）', async () => {
    const v = seedGovViewer({ username: 'g5' })
    // 仅挂 authMiddleware 的路由：必须 401（而非依赖 adminMiddleware 的 is_leader 403）
    const me = await request(server).get('/api/auth/me').set('Authorization', `Bearer ${v.token}`)
    expect(me.status).toBe(401)
    // 任何业务受保护路由同样在令牌层即被拒
    const admin = await request(server).get('/api/admin/dashboard').set('Authorization', `Bearer ${v.token}`)
    expect(admin.status).toBe(401)
  })

  it('停用后 token 立即失效（每次回查 active）', async () => {
    const v = seedGovViewer({ username: 'g6' })
    db.prepare('UPDATE gov_viewers SET active = 0 WHERE id = ?').run(v.id)
    const res = await request(server).get(`${GOV}/me`).set('Authorization', `Bearer ${v.token}`)
    expect(res.status).toBe(403)
  })

  it('/me 返回可见范围（供区域选择器）', async () => {
    const v = seedGovViewer({ username: 'g7', scopeAll: false, scopeDistricts: ['南山区', '福田区'] })
    const res = await request(server).get(`${GOV}/me`).set('Authorization', `Bearer ${v.token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({ viewerId: v.id, scopeAll: false, districts: ['南山区', '福田区'] })
  })

  it('/viewers 管理仅 is_leader 可访问', async () => {
    const v = seedGovViewer({ username: 'g8' })
    // 无业务 token
    const noAuth = await request(server).get(`${GOV}/viewers`)
    expect(noAuth.status).toBe(401)
    // 有 gov token 也不行：业务鉴权在令牌层即拒绝（401，不再是 is_leader 的 403）
    const withGov = await request(server).get(`${GOV}/viewers`).set('Authorization', `Bearer ${v.token}`)
    expect(withGov.status).toBe(401)
  })
})
