/**
 * 鉴权边界回归（安全收敛 F1/F2/F3）
 *
 * - F1：`POST /auth/reset-password` 此前**无鉴权** → 知道手机号即可接管任意账号；
 * - F2：`users.password` 为空时 `login` 放行任意口令 → 空口令账号可被任意口令登录；
 * - F3：`POST /api/user/points` 此前无鉴权且身份取 `LIMIT 1` → 匿名给首个用户加积分。
 *
 * 这些用例断言的是**越权必须被拒**，不是「接口能跑通」，因此全部走真实 HTTP + 真实 DB 校验。
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, db, userToken, makeTeamLeader } from './setup'

const PHONE_A = '13911139111'
const PHONE_B = '13922239222'
const PHONE_C = '13933339333'
const PWD_A = 'orig-pw-aaa'
const TEAM = '蓝天救援队'

/** 注册一个手机账号，返回其令牌（extra 用于传递 affiliation / isLeader 等字段）。 */
async function registerAndLogin(
  phone: string,
  password: string,
  extra: Record<string, unknown> = {}
): Promise<string> {
  const reg = await request(server).post('/api/auth/register').send({ phone, password, ...extra })
  expect(reg.body.code).toBe(0)
  return reg.body.data.token as string
}

/** 直接插入一个**未设置口令**的账号（模拟微信/种子账号）。 */
function insertPasswordlessUser(userId: string, phone: string): void {
  db.prepare(`INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    userId, '无口令用户', '无', 'bronze', 0, '', 'PH-0000', '[]', 0
  )
  void phone
}

describe('F1 — reset-password 必须鉴权', () => {
  beforeEach(() => { seedTestData() })

  it('匿名请求重置任意账号密码 ⇒ 401，且原密码未被改', async () => {
    await registerAndLogin(PHONE_A, PWD_A)

    const res = await request(server)
      .post('/api/auth/reset-password')
      .send({ phone: PHONE_A, newPassword: 'attacker-pw' })
    expect(res.status).toBe(401)

    // 攻击者口令无效 + 原口令仍然有效 ⇒ 账号未被接管
    const bad = await request(server).post('/api/auth/login').send({ phone: PHONE_A, password: 'attacker-pw' })
    expect(bad.body.code).toBe(-1)
    const good = await request(server).post('/api/auth/login').send({ phone: PHONE_A, password: PWD_A })
    expect(good.body.code).toBe(0)
  })

  it('已登录可重置本人密码，新密码可登录', async () => {
    const token = await registerAndLogin(PHONE_A, PWD_A)

    const res = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: PHONE_A, newPassword: 'reset-pw-1' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const old = await request(server).post('/api/auth/login').send({ phone: PHONE_A, password: PWD_A })
    expect(old.body.code).toBe(-1)
    const now = await request(server).post('/api/auth/login').send({ phone: PHONE_A, password: 'reset-pw-1' })
    expect(now.body.code).toBe(0)
  })

  it('重置他人密码 ⇒ 403，受害者密码不变', async () => {
    const tokenA = await registerAndLogin(PHONE_A, PWD_A)
    await registerAndLogin(PHONE_B, 'orig-pw-bbb')

    const res = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ phone: PHONE_B, newPassword: 'attacker-pw' })
    expect(res.status).toBe(403)

    const victim = await request(server).post('/api/auth/login').send({ phone: PHONE_B, password: 'orig-pw-bbb' })
    expect(victim.body.code).toBe(0)
  })

  it('队长只能重置**同队**队员密码（非空 affiliation 相同）', async () => {
    const tokenA = await registerAndLogin(PHONE_A, PWD_A, { affiliation: TEAM })
    await registerAndLogin(PHONE_B, 'orig-pw-bbb', { affiliation: TEAM })
    // 队长身份由管理操作授予（非注册自封）
    makeTeamLeader('u_' + PHONE_A, TEAM)

    const res = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ phone: PHONE_B, newPassword: 'leader-reset-1' })
    expect(res.status).toBe(200)

    const now = await request(server).post('/api/auth/login').send({ phone: PHONE_B, password: 'leader-reset-1' })
    expect(now.body.code).toBe(0)
  })

  it('队长不得重置队外用户 / 无队伍用户', async () => {
    const tokenA = await registerAndLogin(PHONE_A, PWD_A, { affiliation: TEAM })
    await registerAndLogin(PHONE_B, 'orig-pw-bbb', { affiliation: '其他救援队' })
    await registerAndLogin(PHONE_C, 'orig-pw-ccc') // 无 affiliation
    makeTeamLeader('u_' + PHONE_A, TEAM)

    const other = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ phone: PHONE_B, newPassword: 'attacker-pw' })
    expect(other.status).toBe(403)

    const noTeam = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ phone: PHONE_C, newPassword: 'attacker-pw' })
    expect(noTeam.status).toBe(403)

    // 两名受害者原口令均仍有效
    expect((await request(server).post('/api/auth/login').send({ phone: PHONE_B, password: 'orig-pw-bbb' })).body.code).toBe(0)
    expect((await request(server).post('/api/auth/login').send({ phone: PHONE_C, password: 'orig-pw-ccc' })).body.code).toBe(0)
  })
})

describe('NEW-1 — 注册不得自封队长（is_leader 即管理面权限）', () => {
  beforeEach(() => { seedTestData() })

  it('注册时传 isLeader:true ⇒ 落库 is_leader=0', async () => {
    await registerAndLogin(PHONE_A, PWD_A, { isLeader: true })
    const row = db.prepare('SELECT is_leader FROM users WHERE id = ?').get('u_' + PHONE_A) as { is_leader: number }
    expect(row.is_leader).toBe(0)
  })

  it('自封队长不成立 ⇒ 进不了管理面 /api/admin/*', async () => {
    const token = await registerAndLogin(PHONE_A, PWD_A, { isLeader: true })
    const res = await request(server).get('/api/admin/dashboard').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('自封队长不成立 ⇒ 无法重置他人密码（F1 不被绕过）', async () => {
    const tokenA = await registerAndLogin(PHONE_A, PWD_A, { isLeader: true })
    await registerAndLogin(PHONE_B, 'orig-pw-bbb')

    const res = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ phone: PHONE_B, newPassword: 'attacker-pw' })
    expect(res.status).toBe(403)

    const victim = await request(server).post('/api/auth/login').send({ phone: PHONE_B, password: 'orig-pw-bbb' })
    expect(victim.body.code).toBe(0)
    const pwned = await request(server).post('/api/auth/login').send({ phone: PHONE_B, password: 'attacker-pw' })
    expect(pwned.body.code).toBe(-1)
  })
})

describe('F2 — 空口令账号不得用任意口令登录', () => {
  beforeEach(() => { seedTestData() })

  it('password 为空的账号：任意口令登录 ⇒ 拒绝', async () => {
    insertPasswordlessUser('u_' + PHONE_B, PHONE_B)

    const res = await request(server)
      .post('/api/auth/login')
      .send({ phone: PHONE_B, password: 'anything-i-made-up' })
    expect(res.body.code).toBe(-1)
    expect(res.body.message).toContain('未设置密码')
  })

  it('空口令账号凭本人令牌首次设置口令后即可登录', async () => {
    insertPasswordlessUser('u_' + PHONE_B, PHONE_B)
    const token = userToken('u_' + PHONE_B)

    const set = await request(server)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: PHONE_B, oldPassword: 'irrelevant', newPassword: 'brand-new-pw' })
    expect(set.body.code).toBe(0)

    const login = await request(server).post('/api/auth/login').send({ phone: PHONE_B, password: 'brand-new-pw' })
    expect(login.body.code).toBe(0)
    const wrong = await request(server).post('/api/auth/login').send({ phone: PHONE_B, password: 'nope' })
    expect(wrong.body.code).toBe(-1)
  })

  it('对照组：已设置口令的账号错误口令仍被拒', async () => {
    await registerAndLogin(PHONE_A, PWD_A)
    const res = await request(server).post('/api/auth/login').send({ phone: PHONE_A, password: 'wrong-pw' })
    expect(res.body.code).toBe(-1)
  })
})

describe('F3 — /api/user/points 必须鉴权且只作用于本人', () => {
  beforeEach(() => { seedTestData() })

  it('匿名加积分 ⇒ 401', async () => {
    const res = await request(server).post('/api/user/points').send({ amount: 999999 })
    expect(res.status).toBe(401)

    const row = db.prepare('SELECT points FROM users WHERE id = ?').get('user_001') as { points: number }
    expect(row.points).toBe(2340)
  })

  it('本人令牌加积分 ⇒ 只改本人', async () => {
    db.prepare(`INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count)
      VALUES (?,?,?,?,?,?,?,?,?)`).run('user_002', '他人', '他', 'bronze', 10, '', 'PH-0002', '[]', 0)

    const res = await request(server)
      .post('/api/user/points')
      .set('Authorization', `Bearer ${userToken('user_001')}`)
      .send({ amount: 100, reason: '本人奖励' })
    expect(res.status).toBe(200)
    expect(res.body.data.points).toBe(2440)

    const other = db.prepare('SELECT points FROM users WHERE id = ?').get('user_002') as { points: number }
    expect(other.points).toBe(10)
  })

  it('令牌指向不存在的用户 ⇒ code -1', async () => {
    const res = await request(server)
      .post('/api/user/points')
      .set('Authorization', `Bearer ${userToken('ghost_user')}`)
      .send({ amount: 100 })
    expect(res.body.code).toBe(-1)
  })
})
