/**
 * 角色拆分回归：`is_leader`（队伍角色） vs `is_platform_admin`（平台管理员）
 *
 * 迁移 036 之前两者是同一个字段，导致任何队长都能进管理面（`/api/admin/*`、
 * `/api/gov/viewers*`、`/api/push/send`）。本文件按**每一处判定点**分别断言，
 * 防止某处漏改但整体测试仍绿。
 *
 * 依赖矩阵（拆分后）：
 * - 平台管理员 `is_platform_admin`：`/api/admin/*`、`/api/gov/viewers*`、`/api/push/send`
 * - 队伍角色 `is_leader`：`/api/rescue/mobilize`、`/api/rescue/team`、`/auth/reset-password` 队长分支
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import request from 'supertest'
import { server, db, userToken, makeAdmin, makeTeamLeader } from './setup'
import { backfillPlatformAdmins, initDb } from '../db'

const PHONE_ADMIN = '13911139111'
const PHONE_LEADER = '13922239222'
const PHONE_PLAIN = '13933339333'
const TEAM = '蓝天救援队'

async function register(phone: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await request(server)
    .post('/api/auth/register')
    .send({ phone, password: 'pw-123456', ...extra })
  expect(res.body.code).toBe(0)
  return res.body.data.token as string
}

/** 建立三种身份：平台管理员 / 队长 / 普通队员，均同队以便测队伍内行为。 */
async function seedIdentities(): Promise<{ admin: string; leader: string; plain: string }> {
  const admin = await register(PHONE_ADMIN, { affiliation: TEAM })
  const leader = await register(PHONE_LEADER, { affiliation: TEAM })
  const plain = await register(PHONE_PLAIN, { affiliation: TEAM })
  makeAdmin('u_' + PHONE_ADMIN)   // 仅平台管理员，非队长
  makeTeamLeader('u_' + PHONE_LEADER, TEAM) // 仅队长，非管理员
  return { admin, leader, plain }
}

describe('迁移 036：is_platform_admin 与 is_leader 正交', () => {
  beforeEach(() => {
    db.exec('DELETE FROM users')
  })

  it('users 表存在 is_platform_admin 列，且默认 0', () => {
    const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
    expect(cols.some((c) => c.name === 'is_platform_admin')).toBe(true)

    db.prepare(`INSERT INTO users (id, name) VALUES (?, ?)`).run('u_tmp', '临时')
    const row = db.prepare('SELECT is_leader, is_platform_admin FROM users WHERE id = ?').get('u_tmp') as {
      is_leader: number; is_platform_admin: number
    }
    expect(row.is_leader).toBe(0)
    expect(row.is_platform_admin).toBe(0)
  })

  it('升级路径：既有库（无该列）跑 initDb 后列被补上，且回填保权生效', () => {
    // 模拟「升级前」的库：没有该列，也没有 036 记录，且已有一位历史队长
    db.exec('ALTER TABLE users DROP COLUMN is_platform_admin')
    db.prepare('DELETE FROM _migrations WHERE id = ?').run('036_add_user_is_platform_admin')
    db.prepare(`INSERT INTO users (id, name, is_leader) VALUES (?, ?, 1)`).run('u_upgrade', '升级前队长')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      initDb({ silent: true })
    } finally {
      warn.mockRestore()
    }

    const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>
    expect(cols.some((c) => c.name === 'is_platform_admin')).toBe(true)
    const row = db.prepare('SELECT is_platform_admin FROM users WHERE id = ?').get('u_upgrade') as
      { is_platform_admin: number }
    expect(row.is_platform_admin).toBe(1) // 回填：既有队长权限不减少
    const applied = db.prepare('SELECT id FROM _migrations WHERE id = ?').get('036_add_user_is_platform_admin') as
      { id: string } | undefined
    expect(applied?.id).toBe('036_add_user_is_platform_admin')
  })

  it('回填把既有队长保权为平台管理员，并打 warn 日志（保权非授权）', () => {
    db.prepare(`INSERT INTO users (id, name, is_leader) VALUES (?, ?, 1)`).run('u_legacy1', '历史队长A')
    db.prepare(`INSERT INTO users (id, name, is_leader) VALUES (?, ?, 1)`).run('u_legacy2', '历史队长B')
    db.prepare(`INSERT INTO users (id, name, is_leader) VALUES (?, ?, 0)`).run('u_plain', '普通队员')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const count = backfillPlatformAdmins()
      expect(count).toBe(2)
      const granted = db.prepare('SELECT id FROM users WHERE is_platform_admin = 1 ORDER BY id').all() as Array<{ id: string }>
      expect(granted.map((r) => r.id)).toEqual(['u_legacy1', 'u_legacy2'])
      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn.mock.calls[0][0]).toContain('迁移 036 回填 is_platform_admin')
      expect(warn.mock.calls[0][0]).toContain('u_legacy1')
    } finally {
      warn.mockRestore()
    }

    // 幂等：再次回填不再产生变更与日志
    const warn2 = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(backfillPlatformAdmins()).toBe(0)
      expect(warn2).not.toHaveBeenCalled()
    } finally {
      warn2.mockRestore()
    }
  })
})

describe('判定点 1-3：管理面只认平台管理员', () => {
  let tokens: { admin: string; leader: string; plain: string }
  beforeEach(async () => {
    db.exec('DELETE FROM users')
    tokens = await seedIdentities()
  })

  it('① /api/admin/*：平台管理员 200，队长 403，普通用户 403', async () => {
    const ok = await request(server).get('/api/admin/dashboard').set('Authorization', `Bearer ${tokens.admin}`)
    expect(ok.status).toBe(200)
    expect(ok.body.code).toBe(0)

    const leader = await request(server).get('/api/admin/dashboard').set('Authorization', `Bearer ${tokens.leader}`)
    expect(leader.status).toBe(403)

    const plain = await request(server).get('/api/admin/dashboard').set('Authorization', `Bearer ${tokens.plain}`)
    expect(plain.status).toBe(403)
  })

  it('② /api/gov/viewers：平台管理员 200，队长 403', async () => {
    const ok = await request(server).get('/api/gov/viewers').set('Authorization', `Bearer ${tokens.admin}`)
    expect(ok.status).toBe(200)
    expect(ok.body.code).toBe(0)

    const leader = await request(server).get('/api/gov/viewers').set('Authorization', `Bearer ${tokens.leader}`)
    expect(leader.status).toBe(403)
  })

  it('③ /api/push/send：平台管理员可通过鉴权（无订阅时 200），队长 403', async () => {
    const ok = await request(server)
      .post('/api/push/send')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ title: 't', templateId: 'tp_1' })
    expect(ok.status).toBe(200)
    expect(ok.body.code).toBe(0)

    const leader = await request(server)
      .post('/api/push/send')
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ title: 't', templateId: 'tp_1' })
    expect(leader.status).toBe(403)
  })
})

describe('判定点 4-5：队伍能力只认队伍角色', () => {
  let tokens: { admin: string; leader: string; plain: string }
  beforeEach(async () => {
    db.exec('DELETE FROM users')
    tokens = await seedIdentities()
  })

  it('④ /api/rescue/mobilize：队长可发起，平台管理员（非队长）不行', async () => {
    const byLeader = await request(server)
      .post('/api/rescue/mobilize')
      .send({ title: '演练动员', leaderId: 'u_' + PHONE_LEADER, volunteersNeeded: 2 })
    expect(byLeader.body.code).toBe(0)

    const byAdmin = await request(server)
      .post('/api/rescue/mobilize')
      .send({ title: '非法动员', leaderId: 'u_' + PHONE_ADMIN, volunteersNeeded: 2 })
    expect(byAdmin.body.code).toBe(-1)
    expect(byAdmin.body.message).toContain('只有认证救援领导者')
  })

  it('⑤ /api/rescue/team：按队长（队伍角色）取队伍，平台管理员（非队长）取不到', async () => {
    const byLeader = await request(server).get('/api/rescue/team').query({ leaderId: 'u_' + PHONE_LEADER })
    expect(byLeader.body.code).toBe(0)

    const byAdmin = await request(server).get('/api/rescue/team').query({ leaderId: 'u_' + PHONE_ADMIN })
    expect(byAdmin.body.code).toBe(-1)
  })
})

describe('交叉断言：两种权限互不通兑', () => {
  let tokens: { admin: string; leader: string; plain: string }
  beforeEach(async () => {
    db.exec('DELETE FROM users')
    tokens = await seedIdentities()
  })

  it('平台管理员可进管理面，但不能凭此重置**队外**用户口令', async () => {
    const dash = await request(server).get('/api/admin/dashboard').set('Authorization', `Bearer ${tokens.admin}`)
    expect(dash.status).toBe(200)

    // 队外用户：不同 affiliation
    await register('13944449444', { affiliation: '其他救援队' })
    const reset = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ phone: '13944449444', newPassword: 'attacker-pw' })
    expect(reset.status).toBe(403)
  })

  it('队长可重置同队队员，但进不了管理面', async () => {
    const reset = await request(server)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${tokens.leader}`)
      .send({ phone: PHONE_PLAIN, newPassword: 'leader-reset-1' })
    expect(reset.status).toBe(200)

    const dash = await request(server).get('/api/admin/dashboard').set('Authorization', `Bearer ${tokens.leader}`)
    expect(dash.status).toBe(403)
  })
})

describe('不可自授：注册传特权字段一律落库 0', () => {
  beforeEach(() => { db.exec('DELETE FROM users') })

  it.each([
    ['isLeader', 'is_leader'],
    ['isPlatformAdmin', 'is_platform_admin'],
  ])('注册传 %s ⇒ 落库 %s = 0', async (field, column) => {
    await register('13955559555', { [field]: true })
    const row = db.prepare(`SELECT ${column} FROM users WHERE id = ?`).get('u_13955559555') as Record<string, number>
    expect(row[column]).toBe(0)
  })
})

describe('公开接口不得泄漏管理员标志', () => {
  beforeEach(async () => {
    db.exec('DELETE FROM users')
    await register('13966669666', { affiliation: TEAM })
    makeAdmin('u_13966669666')
    db.prepare('UPDATE users SET is_public = 1 WHERE id = ?').run('u_13966669666')
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('/api/public/verify/:publicId 响应不含 is_platform_admin / isPlatformAdmin', async () => {
    const publicId = (db.prepare('SELECT public_id FROM users WHERE id = ?').get('u_13966669666') as { public_id: string }).public_id
    const res = await request(server).get(`/api/public/verify/${publicId}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    // 确认扫的是**真实档案负载**，而不是「未开启公开档案」之类的错误响应体
    // （该接口刻意不返回姓名等 PII，故用 tierLabel / affiliation 作为正向标记）
    expect(res.body.data.tierLabel).toBeTruthy()
    expect(res.body.data.affiliation).toBe(TEAM)
    const body = JSON.stringify(res.body)
    expect(body).not.toContain('is_platform_admin')
    expect(body).not.toContain('isPlatformAdmin')
    expect(body).not.toContain('platformAdmin')
    expect(body).not.toContain('platform_admin')
    // 队伍角色仍可公开（非敏感）
    expect(res.body.data.isLeader).toBe(false)
  })
})

describe('未登录访问管理面仍为 401（鉴权层未被绕过）', () => {
  it('无 token ⇒ 401', async () => {
    const res = await request(server).get('/api/admin/dashboard')
    expect(res.status).toBe(401)
  })

  it('无效 token ⇒ 401', async () => {
    const res = await request(server).get('/api/admin/dashboard').set('Authorization', 'Bearer not-a-jwt')
    expect(res.status).toBe(401)
  })

  it('令牌指向不存在用户 ⇒ 403', async () => {
    const res = await request(server)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${userToken('ghost_user')}`)
    expect(res.status).toBe(403)
  })
})
