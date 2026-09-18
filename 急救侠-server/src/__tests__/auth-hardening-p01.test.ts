/**
 * P0-1 鉴权加固 · 后端守卫（对应团队指派「Top-5 + rescue.ts 全文件」）。
 *
 * 覆盖目标（逐条对应任务要求）：
 * 1. 无 token ⇒ 401（逐端点，含 rescue 全文件 15 个端点）
 * 2. **冒充被阻断**：A 持合法 token，却在 body 传 `userId=B` / query 传 `?userId=B`
 *    ⇒ 不得改动 B 的数据、不得读到 B 的私信；并断言 **B 侧确实无变化**
 * 3. **跨用户管理操作保能力 + 需授权**：org admin 给成员发证 ⇒ 200；非本机构成员 ⇒ 403 且证书未生成
 * 4. **自闭环伪造链被打断**：提交者自行 PUT /certification/:id/verify ⇒ 403 且 status 未变 verified
 * 5. **队伍名单不再退化为全表**：GET /team 在调用者 `affiliation=''` 时不得返回全表用户
 * 6. **本人自助正常路径仍通过**（没把正常功能改坏）
 *
 * ⚠️ 纪律：不得为了让这些用例变绿而放松任何鉴权。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, makeAdmin, makeTeamLeader, db } from './setup'

/** 建一个用户（列的写法对齐 `seedTestData`，避免 NOT NULL 缺失）。 */
function addUser(id: string, name: string, affiliation = ''): void {
  db.prepare(
    `INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count, affiliation)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(id, name, name.slice(0, 1), 'bronze', 0, '深圳', 'VID-' + id, '[]', 0, affiliation)
}

/** 建一个机构（`admin_user_id` 是 FK，用户必须先存在）。 */
function addOrg(id: string, name: string, adminUserId: string): void {
  db.prepare('INSERT INTO organizations (id, name, type, admin_user_id) VALUES (?,?,?,?)')
    .run(id, name, 'company', adminUserId)
}

/** 把用户加进机构并赋予角色。 */
function addMember(orgId: string, userId: string, role: string): void {
  db.prepare('INSERT INTO organization_members (id, org_id, user_id, role) VALUES (?,?,?,?)')
    .run('om_' + orgId + '_' + userId, orgId, userId, role)
}

/** 直接落一条外部认证（绕过接口，用于构造"他人数据"）。 */
function insertExtCert(id: string, userId: string, status = 'pending'): void {
  db.prepare(
    `INSERT INTO external_certifications (id, user_id, type, issuer, cert_number, issue_date, expiry_date, file_url, status)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(id, userId, 'CPR', '红十字会', 'CN-1', '2025-01-01', '2027-01-01', '', status)
}

/** 直接落一条私信（绕过接口，用于构造"他人私信"）。 */
function insertMessage(id: string, fromUserId: string, toUserId: string, content: string): void {
  db.prepare('INSERT INTO messages (id, from_user_id, from_user_name, to_user_id, content) VALUES (?,?,?,?,?)')
    .run(id, fromUserId, fromUserId, toUserId, content)
}

/**
 * ★ P0-2 夹具补登记：把 `userId` 登记为某救援任务的参与者（`task_volunteers`）。
 *
 * P0-2 起 rescue 的**写侧**（开直播 / 发现场动态）也要求参与者身份 —— 非参与者一律 403。
 * 用例 ⑨/⑩/⑪/⑫ 的**断言意图**是「冒名被阻断 / 归属校验」，与「A 是不是参与者」无关
 * ⇒ 这里只补一条参与行让 A 具备发布资格，断言一字不改。
 */
function enrollTaskVolunteer(taskId: string, userId: string): void {
  db.prepare('INSERT OR IGNORE INTO task_volunteers (id, task_id, user_id, responded_at_ms, status) VALUES (?,?,?,?,?)')
    .run('tv_' + taskId + '_' + userId, taskId, userId, Date.now(), 'responded')
}

/** 直接落一条视频评论（绕过接口，用于构造"他人评论"）。 */
function insertComment(id: string, videoId: string, userId: string, content = '评论内容'): void {
  db.prepare('INSERT INTO video_comments (id, video_id, user_id, user_name, user_avatar, content) VALUES (?,?,?,?,?,?)')
    .run(id, videoId, userId, userId, '', content)
}

/** 统计某表的行数（用于"目标侧未变化"断言）。 */
function count(sql: string, ...args: unknown[]): number {
  return (db.prepare(sql).get(...(args as never[])) as { c: number }).c
}

/** 取某用户的最新一条外部认证的 status。 */
function extCertStatus(userId: string): string | undefined {
  return (db.prepare('SELECT status FROM external_certifications WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(userId) as { status: string } | undefined)?.status
}

beforeEach(() => {
  seedTestData()
  addUser('u_alice', 'Alice')
  addUser('u_bob', 'Bob')
})

/* ═══════════════════ 1. 无 token ⇒ 401（逐端点） ═══════════════════ */

describe('P0-1 · 无 token ⇒ 401', () => {
  const CASES: Array<{ method: 'get' | 'post' | 'put' | 'delete'; path: string; label: string }> = [
    // ---- rescue.ts 全文件（15 个端点）----
    { method: 'post',   path: '/api/rescue/certification',                      label: 'rescue 提交外部认证' },
    { method: 'get',    path: '/api/rescue/certifications',                     label: 'rescue 我的外部认证列表' },
    { method: 'put',    path: '/api/rescue/certification/ec_exists/verify',     label: 'rescue 核实外部认证' },
    { method: 'post',   path: '/api/rescue/mobilize',                           label: 'rescue 发起动员' },
    { method: 'get',    path: '/api/rescue/mobilizations',                      label: 'rescue 动员列表' },
    { method: 'put',    path: '/api/rescue/mobilizations/mob_exists/approve',   label: 'rescue 批准动员（提权写）' },
    { method: 'put',    path: '/api/rescue/mobilizations/mob_exists/complete',  label: 'rescue 结束动员' },
    { method: 'post',   path: '/api/rescue/mobilizations/mob_exists/respond',   label: 'rescue 响应动员' },
    { method: 'get',    path: '/api/rescue/mobilizations/mob_exists/volunteers',label: 'rescue 动员志愿者列表' },
    { method: 'get',    path: '/api/rescue/team',                               label: 'rescue 队伍花名册' },
    { method: 'get',    path: '/api/rescue/mobilizations/task_001/media',       label: 'rescue 任务媒体列表' },
    { method: 'get',    path: '/api/rescue/live/task_001',                      label: 'rescue 直播信息' },
    { method: 'post',   path: '/api/rescue/live/task_001/start',                label: 'rescue 开始直播' },
    { method: 'post',   path: '/api/rescue/live/end/live_exists',               label: 'rescue 结束直播' },
    { method: 'post',   path: '/api/rescue/mobilizations/task_001/media',       label: 'rescue 发布任务媒体' },
    // ---- 其余四文件本批涉及的端点 ----
    { method: 'post',   path: '/api/org/org_exists/certificates',               label: 'org 机构发证' },
    { method: 'get',    path: '/api/community/messages',                        label: 'community 私信列表（Top3 隐私）' },
    { method: 'post',   path: '/api/community/messages',                        label: 'community 发私信' },
    { method: 'post',   path: '/api/community/contact-aed/aed_001',             label: 'community 联系 AED 维护者' },
    { method: 'post',   path: '/api/drill/events',                              label: 'drill 创建演习' },
    { method: 'post',   path: '/api/drill/events/dr_exists/join',               label: 'drill 报名演习' },
    { method: 'put',    path: '/api/drill/events/dr_exists/complete',           label: 'drill 结束演习（发权益）' },
    { method: 'post',   path: '/api/video',                                     label: 'video 发布视频' },
    { method: 'post',   path: '/api/video/vp_exists/comment',                   label: 'video 发表评论' },
    { method: 'delete', path: '/api/video/vp_exists/comment/vc_exists',         label: 'video 删除评论' },
  ]

  it.each(CASES)('$label ⇒ 401（$path）', async ({ method, path }) => {
    const res = await request(server)[method](path)
    expect(res.status).toBe(401)
  })

  it('无效 token 同样被拒（401）', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations')
      .set('Authorization', 'Bearer not-a-real-jwt')
    expect(res.status).toBe(401)
  })
})

/* ═══════════════════ 2. 冒充被阻断 ═══════════════════ */

describe('P0-1 · 冒充被阻断：持 A 的 token 却传 B 的身份', () => {
  it('① rescue POST /certification：body 传 userId=B ⇒ 记录在 A 名下，B 侧无变化', async () => {
    const res = await request(server)
      .post('/api/rescue/certification')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', type: 'CPR', issuer: '红十字会' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    // ★ B 侧确实无变化
    expect(count('SELECT COUNT(*) AS c FROM external_certifications WHERE user_id=?', 'u_bob')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM external_certifications WHERE user_id=?', 'u_alice')).toBe(1)
  })

  it('② rescue GET /certifications：query 带 userId=B ⇒ 读不到 B 的认证', async () => {
    insertExtCert('ec_bob_1', 'u_bob')
    const res = await request(server)
      .get('/api/rescue/certifications')
      .query({ userId: 'u_bob' })
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    // 返回的是 A 自己的（空），绝不含 B 的 ec_bob_1
    expect(res.body.data.map((c: { id: string }) => c.id)).not.toContain('ec_bob_1')
    expect(res.body.data).toHaveLength(0)
  })

  it('③ community GET /messages：query 带 userId=B ⇒ 读不到 B 的私信正文', async () => {
    addUser('u_carol', 'Carol')
    insertMessage('msg_bob_1', 'u_carol', 'u_bob', 'B 的隐私私信')

    const res = await request(server)
      .get('/api/community/messages')
      .query({ userId: 'u_bob' })
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    const texts: string = JSON.stringify(res.body.data)
    expect(texts).not.toContain('B 的隐私私信')
    expect(res.body.data).toHaveLength(0)
  })

  it('④ community POST /messages：body 传 fromUserId=B ⇒ 落库仍是 A', async () => {
    const res = await request(server)
      .post('/api/community/messages')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ fromUserId: 'u_bob', toUserId: 'u_bob', content: '冒名私信' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const row = db.prepare('SELECT from_user_id FROM messages WHERE content=?').get('冒名私信') as { from_user_id: string }
    expect(row.from_user_id).toBe('u_alice') // ★ 冒名未生效
  })

  it('⑤ drill POST /events：body 传 organizerId=B ⇒ 组织者仍是 A', async () => {
    const res = await request(server)
      .post('/api/drill/events')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ title: '冒名演习', date: '2025-06-01', organizerId: 'u_bob' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const row = db.prepare('SELECT organizer_id FROM drill_events WHERE title=?').get('冒名演习') as { organizer_id: string }
    expect(row.organizer_id).toBe('u_alice')
  })

  it('⑥ drill POST /events/:id/join：body 传 userId=B ⇒ 报名者仍是 A（B 侧无变化）', async () => {
    await request(server)
      .post('/api/drill/events')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ title: 'A 的演习', date: '2025-06-01' })
    const ev = db.prepare('SELECT id FROM drill_events WHERE title=?').get('A 的演习') as { id: string }

    const res = await request(server)
      .post(`/api/drill/events/${ev.id}/join`)
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob' })
    expect(res.status).toBe(200)

    const parts = db.prepare('SELECT user_id FROM drill_participants WHERE event_id=?').all(ev.id) as Array<{ user_id: string }>
    expect(parts.map((p) => p.user_id)).toEqual(['u_alice'])
    expect(count('SELECT COUNT(*) AS c FROM drill_participants WHERE user_id=?', 'u_bob')).toBe(0)
  })

  it('⑦ video POST /：body 传 userId=B ⇒ 作者仍是 A', async () => {
    const res = await request(server)
      .post('/api/video')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', title: '冒名视频', videoUrl: '/x.mp4' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const row = db.prepare('SELECT user_id FROM video_posts WHERE title=?').get('冒名视频') as { user_id: string }
    expect(row.user_id).toBe('u_alice')
  })

  it('⑧ video POST /:id/comment：body 传 userId=B ⇒ 评论者仍是 A', async () => {
    const res = await request(server)
      .post('/api/video/vp_1/comment')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', content: '冒名评论' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const row = db.prepare('SELECT user_id FROM video_comments WHERE content=?').get('冒名评论') as { user_id: string }
    expect(row.user_id).toBe('u_alice')
  })

  it('⑨ rescue POST /mobilize：body 传 leaderId=B ⇒ 发起人仍是 A（须为队长）', async () => {
    makeTeamLeader('u_alice', '腾飞救援队')
    const res = await request(server)
      .post('/api/rescue/mobilize')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ title: '冒名动员', leaderId: 'u_bob' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const row = db.prepare('SELECT leader_id FROM emergency_mobilizations WHERE title=?').get('冒名动员') as { leader_id: string }
    expect(row.leader_id).toBe('u_alice')
  })

  it('⑩ rescue POST /mobilizations/:id/respond：body 传 userId=B ⇒ 响应者仍是 A', async () => {
    db.prepare(`INSERT INTO emergency_mobilizations (id, title, leader_id, status) VALUES (?,?,?,?)`)
      .run('mob_1', '某动员', 'u_alice', 'active')
    const res = await request(server)
      .post('/api/rescue/mobilizations/mob_1/respond')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob' })
    expect(res.status).toBe(200)

    const vols = db.prepare('SELECT user_id FROM mobilization_volunteers WHERE mobilization_id=?').all('mob_1') as Array<{ user_id: string }>
    expect(vols.map((v) => v.user_id)).toEqual(['u_alice'])
    expect(count('SELECT COUNT(*) AS c FROM mobilization_volunteers WHERE user_id=?', 'u_bob')).toBe(0)
  })

  it('⑪ rescue POST /live/:taskId/start：body 传 userId=B ⇒ 主播仍是 A', async () => {
    enrollTaskVolunteer('task_001', 'u_alice') // ★ P0-2：写侧需参与者身份，A 取得发布资格
    const res = await request(server)
      .post('/api/rescue/live/task_001/start')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', userName: 'Bob' })
    expect(res.status).toBe(200)

    const row = db.prepare('SELECT user_id FROM live_sessions WHERE task_id=?').get('task_001') as { user_id: string }
    expect(row.user_id).toBe('u_alice')
  })

  it('⑫ rescue POST /mobilizations/:taskId/media：body 传 userId=B ⇒ 作者仍是 A（含 GPS）', async () => {
    enrollTaskVolunteer('task_001', 'u_alice') // ★ P0-2：写侧需参与者身份，A 取得发布资格
    const res = await request(server)
      .post('/api/rescue/mobilizations/task_001/media')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', content: '现场', lat: 22.5, lng: 113.9 })
    expect(res.status).toBe(200)

    const row = db.prepare('SELECT user_id FROM task_media WHERE task_id=?').get('task_001') as { user_id: string }
    expect(row.user_id).toBe('u_alice')
  })
})

/* ═══════════════════ 3. 跨用户管理：保能力 + 需授权 ═══════════════════ */

describe('P0-1 · org 发证：机构给成员发证（跨用户能力保留），但调用者必须被授权', () => {
  beforeEach(() => {
    addOrg('org_1', '第一救援队', 'u_alice')
    addMember('org_1', 'u_alice', 'admin')
    addMember('org_1', 'u_bob', 'member')
  })

  it('① 机构 admin 给成员发证 ⇒ 200，证书记在该成员名下（能力保留）', async () => {
    const res = await request(server)
      .post('/api/org/org_1/certificates')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', type: 'CPR', issuer: '红十字会', issueDate: '2025-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM certificates WHERE user_id=?', 'u_bob')).toBe(1)
  })

  it('② 机构 manager 同样可发证 ⇒ 200', async () => {
    addUser('u_carol', 'Carol')
    addMember('org_1', 'u_carol', 'manager')
    const res = await request(server)
      .post('/api/org/org_1/certificates')
      .set('Authorization', `Bearer ${userToken('u_carol')}`)
      .send({ userId: 'u_bob', type: 'AED', issueDate: '2025-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('③ 非本机构成员 ⇒ 403，且**证书未生成**', async () => {
    addUser('u_dave', 'Dave')
    const res = await request(server)
      .post('/api/org/org_1/certificates')
      .set('Authorization', `Bearer ${userToken('u_dave')}`)
      .send({ userId: 'u_bob', type: 'CPR', issueDate: '2025-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(403)
    // ★ 目标侧确实无变化
    expect(count('SELECT COUNT(*) AS c FROM certificates WHERE user_id=?', 'u_bob')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM certificates')).toBe(0)
  })

  it('④ 本机构普通 member ⇒ 403（不是 admin/manager 就不行）', async () => {
    const res = await request(server)
      .post('/api/org/org_1/certificates')
      .set('Authorization', `Bearer ${userToken('u_bob')}`)
      .send({ userId: 'u_bob', type: 'CPR', issueDate: '2025-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(403)
    expect(count('SELECT COUNT(*) AS c FROM certificates')).toBe(0)
  })

  it('⑤ 机构不存在 ⇒ 404', async () => {
    const res = await request(server)
      .post('/api/org/org_nope/certificates')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', type: 'CPR', issueDate: '2025-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(404)
  })
})

/* ═══════════════════ 4. 自闭环伪造链被打断 ═══════════════════ */

describe('P0-1 · 外部认证「自闭环伪造链」被打断', () => {
  it('① 提交者自行核实 ⇒ 403，且 status 仍未 verified', async () => {
    const created = await request(server)
      .post('/api/rescue/certification')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ type: 'CPR', issuer: '红十字会' })
    expect(created.status).toBe(200)
    const certId = (db.prepare('SELECT id FROM external_certifications WHERE user_id=?').get('u_alice') as { id: string }).id

    const verify = await request(server)
      .put(`/api/rescue/certification/${certId}/verify`)
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(verify.status).toBe(403)
    // ★ 状态确实没被改动
    expect(extCertStatus('u_alice')).toBe('pending')
  })

  it('② 普通用户核实**他人**认证 ⇒ 403', async () => {
    insertExtCert('ec_target', 'u_bob')
    const res = await request(server)
      .put('/api/rescue/certification/ec_target/verify')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(403)
    expect(extCertStatus('u_bob')).toBe('pending')
  })

  it('③ 平台管理员核实 ⇒ 200，status 变 verified（正当能力保留）', async () => {
    insertExtCert('ec_ok', 'u_alice')
    addUser('u_dave', 'Dave')
    makeAdmin('u_dave')
    const res = await request(server)
      .put('/api/rescue/certification/ec_ok/verify')
      .set('Authorization', `Bearer ${userToken('u_dave')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(extCertStatus('u_alice')).toBe('verified')
  })

  it('④ 机构 admin 核实**本机构成员**的认证 ⇒ 200，status 变 verified', async () => {
    insertExtCert('ec_org', 'u_alice')
    addOrg('org_2', '第二救援队', 'u_alice')
    addUser('u_dave', 'Dave')
    addMember('org_2', 'u_dave', 'admin')
    // ★ P0-1 收窄后：被认证者也必须是该机构成员（否则 403，见下方新 describe 的用例 ④）
    addMember('org_2', 'u_alice', 'member')
    const res = await request(server)
      .put('/api/rescue/certification/ec_org/verify')
      .set('Authorization', `Bearer ${userToken('u_dave')}`)
    expect(res.status).toBe(200)
    expect(extCertStatus('u_alice')).toBe('verified')
  })

  it('⑤ 核实不存在的认证 ⇒ 404', async () => {
    addUser('u_dave', 'Dave')
    makeAdmin('u_dave')
    const res = await request(server)
      .put('/api/rescue/certification/ec_ghost/verify')
      .set('Authorization', `Bearer ${userToken('u_dave')}`)
    expect(res.status).toBe(404)
  })
})

/* ═══════════════════ 5. 队伍名单不再退化为全表 ═══════════════════ */

describe('P0-1 · rescue GET /team：`affiliation` 为空时不得退化为全表', () => {
  it('① 队长 affiliation 为空 ⇒ 返回空花名册（而不是"所有空 affiliation 的用户"）', async () => {
    // 队长本人 affiliation 为空；另有若干用户 affiliation 同样为空
    makeTeamLeader('u_alice')
    addUser('u_e1', 'E1')
    addUser('u_e2', 'E2')
    addUser('u_e3', 'E3')

    const res = await request(server)
      .get('/api/rescue/team')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    // ★ 关键：不得返回全表。此前 SQL 退化为 `WHERE affiliation=''` ⇒ 会把这些用户全拉出来。
    expect(res.body.data).toHaveLength(0)
    const totalUsers = count('SELECT COUNT(*) AS c FROM users')
    expect(res.body.data.length).toBeLessThan(totalUsers)
    expect(JSON.stringify(res.body.data)).not.toContain('u_e1')
  })

  it('② 有隶属队伍 ⇒ 只返回同队成员（正常能力保留）', async () => {
    makeTeamLeader('u_alice', '腾飞救援队')
    addUser('u_t1', 'T1', '腾飞救援队')
    addUser('u_other', 'Other', '别的队')

    const res = await request(server)
      .get('/api/rescue/team')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    const ids: string[] = (res.body.data as Array<{ id: string }>).map((u) => u.id)
    expect(ids).toContain('u_t1')
    expect(ids).not.toContain('u_other')
  })

  it('③ 非队长 ⇒ 取不到花名册（code = -1）', async () => {
    const res = await request(server)
      .get('/api/rescue/team')
      .set('Authorization', `Bearer ${userToken('u_bob')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(-1)
  })

  it('④ 超大队伍 ⇒ 受上限约束（LIMIT 200），不得无界返回全队', async () => {
    makeTeamLeader('u_alice', 'BigTeam')
    // 250 名同队成员 + 队长本人 = 251 行；上限 200 ⇒ 只应回 200 条
    for (let i = 0; i < 250; i++) addUser(`u_big_${i}`, `B${i}`, 'BigTeam')

    const res = await request(server)
      .get('/api/rescue/team')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    // ★ 断言"确实被截断"：库里有 251 行，但只返回 200
    expect(count('SELECT COUNT(*) AS c FROM users WHERE affiliation=?', 'BigTeam')).toBe(251)
    expect(res.body.data).toHaveLength(200)
  })
})

/* ═══════════════════ 6. 本人自助正常路径仍通过 ═══════════════════ */

describe('P0-1 · 本人自助正常路径仍通过（不能改坏正常功能）', () => {
  it('① video DELETE 自己的评论 ⇒ 200 且评论被删', async () => {
    insertComment('vc_mine', 'vp_1', 'u_alice')
    const res = await request(server)
      .delete('/api/video/vp_1/comment/vc_mine')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM video_comments WHERE id=?', 'vc_mine')).toBe(0)
  })

  it('② video DELETE 他人评论（body 传对方 userId 冒名）⇒ 403 且评论仍在', async () => {
    insertComment('vc_alice', 'vp_1', 'u_alice')
    const res = await request(server)
      .delete('/api/video/vp_1/comment/vc_alice')
      .set('Authorization', `Bearer ${userToken('u_bob')}`)
      .send({ userId: 'u_alice' }) // ★ 旧实现会据此放行；现必须被拒
    expect(res.status).toBe(403)
    expect(count('SELECT COUNT(*) AS c FROM video_comments WHERE id=?', 'vc_alice')).toBe(1)
  })

  it('③ drill PUT /events/:id/complete：组织者本人 ⇒ 200，参与者加积分/训练记录', async () => {
    await request(server)
      .post('/api/drill/events')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ title: '正常演习', date: '2025-06-01' })
    const ev = db.prepare('SELECT id FROM drill_events WHERE title=?').get('正常演习') as { id: string }
    await request(server)
      .post(`/api/drill/events/${ev.id}/join`)
      .set('Authorization', `Bearer ${userToken('u_bob')}`)

    const res = await request(server)
      .put(`/api/drill/events/${ev.id}/complete`)
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM training_records WHERE drill_id=?', ev.id)).toBe(1)
  })

  it('④ drill complete：非组织者非管理员 ⇒ 403（不得刷权益）', async () => {
    await request(server)
      .post('/api/drill/events')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ title: '他人演习', date: '2025-06-01' })
    const ev = db.prepare('SELECT id FROM drill_events WHERE title=?').get('他人演习') as { id: string }

    const res = await request(server)
      .put(`/api/drill/events/${ev.id}/complete`)
      .set('Authorization', `Bearer ${userToken('u_bob')}`)
    expect(res.status).toBe(403)
    // 权益未被刷
    expect(count('SELECT COUNT(*) AS c FROM training_records WHERE drill_id=?', ev.id)).toBe(0)
    const row = db.prepare("SELECT status FROM drill_events WHERE id=?").get(ev.id) as { status: string }
    expect(row.status).toBe('upcoming')
  })

  it('⑤ rescue PUT /mobilizations/:id/complete：发起人本人 ⇒ 200', async () => {
    db.prepare('INSERT INTO emergency_mobilizations (id, title, leader_id, status) VALUES (?,?,?,?)')
      .run('mob_2', '我的动员', 'u_alice', 'active')
    const res = await request(server)
      .put('/api/rescue/mobilizations/mob_2/complete')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect((db.prepare('SELECT status FROM emergency_mobilizations WHERE id=?').get('mob_2') as { status: string }).status)
      .toBe('completed')
  })

  it('⑥ rescue complete：非发起人非管理员 ⇒ 403，状态未变', async () => {
    db.prepare('INSERT INTO emergency_mobilizations (id, title, leader_id, status) VALUES (?,?,?,?)')
      .run('mob_3', '他人动员', 'u_alice', 'active')
    const res = await request(server)
      .put('/api/rescue/mobilizations/mob_3/complete')
      .set('Authorization', `Bearer ${userToken('u_bob')}`)
    expect(res.status).toBe(403)
    expect((db.prepare('SELECT status FROM emergency_mobilizations WHERE id=?').get('mob_3') as { status: string }).status)
      .toBe('active')
  })

  it('⑦ rescue approve：普通用户 ⇒ 403（不得自提 is_organizer）', async () => {
    makeTeamLeader('u_alice', '腾飞救援队')
    await request(server)
      .post('/api/rescue/mobilize')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ title: '待审批动员' })
    const mob = db.prepare('SELECT id FROM emergency_mobilizations WHERE title=?').get('待审批动员') as { id: string }

    const res = await request(server)
      .put(`/api/rescue/mobilizations/${mob.id}/approve`)
      .set('Authorization', `Bearer ${userToken('u_bob')}`)
    expect(res.status).toBe(403)
    // ★ 提权写未生效
    expect((db.prepare('SELECT is_organizer FROM users WHERE id=?').get('u_alice') as { is_organizer: number }).is_organizer).toBe(0)
  })

  it('⑧ rescue approve：平台管理员 ⇒ 200（正当能力保留）', async () => {
    makeTeamLeader('u_alice', '腾飞救援队')
    await request(server)
      .post('/api/rescue/mobilize')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ title: '待审批动员2' })
    const mob = db.prepare('SELECT id FROM emergency_mobilizations WHERE title=?').get('待审批动员2') as { id: string }

    addUser('u_dave', 'Dave')
    makeAdmin('u_dave')
    const res = await request(server)
      .put(`/api/rescue/mobilizations/${mob.id}/approve`)
      .set('Authorization', `Bearer ${userToken('u_dave')}`)
    expect(res.status).toBe(200)
    expect((db.prepare('SELECT is_organizer FROM users WHERE id=?').get('u_alice') as { is_organizer: number }).is_organizer).toBe(1)
  })

  it('⑨ rescue POST /live/end/:sessionId：主播本人 ⇒ 200', async () => {
    enrollTaskVolunteer('task_001', 'u_alice') // ★ P0-2：开直播需参与者身份
    await request(server)
      .post('/api/rescue/live/task_001/start')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    const s = db.prepare('SELECT id FROM live_sessions WHERE task_id=?').get('task_001') as { id: string }

    const res = await request(server)
      .post(`/api/rescue/live/end/${s.id}`)
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect((db.prepare('SELECT ended_at FROM live_sessions WHERE id=?').get(s.id) as { ended_at: string | null }).ended_at).not.toBeNull()
  })

  it('⑩ rescue live/end：他人 ⇒ 403，直播未结束', async () => {
    enrollTaskVolunteer('task_001', 'u_alice') // ★ P0-2：开直播需参与者身份（u_bob 不登记 ⇒ 仍 403）
    await request(server)
      .post('/api/rescue/live/task_001/start')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    const s = db.prepare('SELECT id FROM live_sessions WHERE task_id=?').get('task_001') as { id: string }

    const res = await request(server)
      .post(`/api/rescue/live/end/${s.id}`)
      .set('Authorization', `Bearer ${userToken('u_bob')}`)
    expect(res.status).toBe(403)
    expect((db.prepare('SELECT ended_at FROM live_sessions WHERE id=?').get(s.id) as { ended_at: string | null }).ended_at).toBeNull()
  })
})

/* ═══════════════════ 7. P0-1 补漏：机构操作必须限定在本机构成员范围内 ═══════════════════ */

/**
 * **独立 QA 复核**挖出的越权 + 团队据此裁决的收窄。统一原则：
 * > **机构维度**的操作必须限定在**本机构成员**范围内（不能只校验调用者、不校验目标）。
 *
 * - **缺陷 1（越权）**：`POST /api/org/:id/certificates` 只校验了调用者是本机构 admin/manager，
 *   没校验目标 `userId` 属于本机构 ⇒ 机构 admin 可给**任意用户**发证（实测 200 且建行），
 *   而证书会出现在**公开验真页** `public/verify/:publicId` ⇒ 仍是一条伪造链路。
 * - **缺陷 2（收窄）**：`PUT /api/rescue/certification/:id/verify` 的判据是宽口径
 *   `isOrgManager`（**任一**机构的 admin/manager）⇒ A 机构 admin 可核实与 A 无关用户的认证。
 *
 * ⚠️ 纪律：这些用例断言的是"越权被拒 + **目标侧零变化**"，不得为变绿而放松判据。
 */
describe('P0-1 补漏 · 机构操作必须限定在本机构成员范围内', () => {
  /** 发证请求体（缺 `userId`，各用例自行带上）。 */
  const CERT_BODY = { type: 'CPR', issuer: '红十字会', issueDate: '2025-01-01', expiryDate: '2027-01-01' }

  /** 按 id 取外部认证 status（不按 user 维度，避免多条认证互相混淆）。 */
  function certStatusById(id: string): string | undefined {
    return (db.prepare('SELECT status FROM external_certifications WHERE id=?').get(id) as { status: string } | undefined)?.status
  }

  /** 某个用户名下的证书行数（用于"受害者侧零变化"断言）。 */
  function certCount(userId: string): number {
    return count('SELECT COUNT(*) AS c FROM certificates WHERE user_id=?', userId)
  }

  /** 证书总行数（含"整个库一张都没多"这种更强断言）。 */
  function certTotal(): number {
    return count('SELECT COUNT(*) AS c FROM certificates')
  }

  // ───────── 缺陷 1：org 发证的目标归属 ─────────

  it('① 机构 admin 给**非本机构成员**发证 ⇒ 403，且**证书行未被创建**', async () => {
    addOrg('org_a', 'A 救援队', 'u_alice')
    addMember('org_a', 'u_alice', 'admin')
    addUser('u_eve', 'Eve') // 与 org_a 毫无关系

    const res = await request(server)
      .post('/api/org/org_a/certificates')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_eve', ...CERT_BODY })

    expect(res.status).toBe(403)
    // ★ 去库里断言：不是只看返回码
    expect(certCount('u_eve')).toBe(0)
    expect(certTotal()).toBe(0)
  })

  it('② 机构 admin 给**本机构成员**发证 ⇒ 200 且行已创建（能力必须保留）', async () => {
    addOrg('org_a', 'A 救援队', 'u_alice')
    addMember('org_a', 'u_alice', 'admin')
    addMember('org_a', 'u_bob', 'member')

    const res = await request(server)
      .post('/api/org/org_a/certificates')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', ...CERT_BODY })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(certCount('u_bob')).toBe(1)
  })

  it('③ 非本机构成员的**调用者** ⇒ 仍 403（既有守卫不得回退）', async () => {
    addOrg('org_a', 'A 救援队', 'u_alice')
    addMember('org_a', 'u_alice', 'admin')
    addMember('org_a', 'u_bob', 'member')
    addUser('u_eve', 'Eve') // 既不是本机构成员，也不是任何机构 admin

    const res = await request(server)
      .post('/api/org/org_a/certificates')
      .set('Authorization', `Bearer ${userToken('u_eve')}`)
      .send({ userId: 'u_bob', ...CERT_BODY })

    expect(res.status).toBe(403)
    expect(certTotal()).toBe(0)
  })

  it('④ 目标是**其它机构**的成员（不在本机构）⇒ 403 且未建行', async () => {
    addOrg('org_a', 'A 救援队', 'u_alice')
    addMember('org_a', 'u_alice', 'admin')
    addUser('u_carol', 'Carol')
    addOrg('org_b', 'B 救援队', 'u_carol')
    addMember('org_b', 'u_carol', 'member') // 在 B、不在 A

    const res = await request(server)
      .post('/api/org/org_a/certificates')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_carol', ...CERT_BODY })

    expect(res.status).toBe(403)
    expect(certCount('u_carol')).toBe(0)
    expect(certTotal()).toBe(0)
  })

  // ───────── 缺陷 2：外部认证核实的机构范围收窄 ─────────

  it('⑤ 与认证者**无关机构**的 admin verify ⇒ 403，且 status **未**变成 verified', async () => {
    insertExtCert('ec_stranger', 'u_bob')
    addUser('u_dave', 'Dave')
    addOrg('org_x', 'X 救援队', 'u_dave')
    addMember('org_x', 'u_dave', 'admin') // Dave 是 X 的 admin，但 u_bob 不在 X

    const res = await request(server)
      .put('/api/rescue/certification/ec_stranger/verify')
      .set('Authorization', `Bearer ${userToken('u_dave')}`)

    expect(res.status).toBe(403)
    // ★ 状态确实没被改动（不是只看返回码）
    expect(certStatusById('ec_stranger')).toBe('pending')
  })

  it('⑥ 认证者**所属机构**的 admin verify ⇒ 200 且 status 变 verified（能力保留）', async () => {
    insertExtCert('ec_member', 'u_bob')
    addUser('u_dave', 'Dave')
    addOrg('org_y', 'Y 救援队', 'u_dave')
    addMember('org_y', 'u_dave', 'admin')
    addMember('org_y', 'u_bob', 'member') // ★ 被认证者与调用者同机构

    const res = await request(server)
      .put('/api/rescue/certification/ec_member/verify')
      .set('Authorization', `Bearer ${userToken('u_dave')}`)

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(certStatusById('ec_member')).toBe('verified')
  })

  it('⑦ 平台管理员 verify ⇒ 200 且 status 变 verified（收窄不得误伤）', async () => {
    insertExtCert('ec_admin', 'u_bob')
    addUser('u_dave', 'Dave')
    makeAdmin('u_dave') // 平台管理员：不受机构范围约束

    const res = await request(server)
      .put('/api/rescue/certification/ec_admin/verify')
      .set('Authorization', `Bearer ${userToken('u_dave')}`)

    expect(res.status).toBe(200)
    expect(certStatusById('ec_admin')).toBe('verified')
  })

  it('⑧ 收窄后：普通用户核实**自己的**认证仍 403（自闭环伪造链未回退）', async () => {
    insertExtCert('ec_self', 'u_bob')
    const res = await request(server)
      .put('/api/rescue/certification/ec_self/verify')
      .set('Authorization', `Bearer ${userToken('u_bob')}`)
    expect(res.status).toBe(403)
    expect(certStatusById('ec_self')).toBe('pending')
  })
})
