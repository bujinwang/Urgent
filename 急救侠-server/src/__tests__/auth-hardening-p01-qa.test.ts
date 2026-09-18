/**
 * P0-1 鉴权加固 · **独立对抗性复核**（QA 第二双眼睛）。
 *
 * 刻意**不复用 / 不修改**实现方的 `auth-hardening-p01.test.ts`（那是实现方自测）；
 * 本文件另起夹具，按「攻击者视角」打 6 条不变量：
 *   §1 无 token / 垃圾 token / 过期 token / gov token ⇒ 401（**逐端点**，共 25 个）
 *   §2 冒充被阻断（body.userId / query.userId）⇒ **断言受害者侧零变化**（不看返回码）
 *   §3 ★ 自闭环伪造链被打断：提交者自助 verify ⇒ 403 且 status 不得变 verified
 *   §4 提权被阻断：非管理员审批动员不得自提 organizer；非组织者不得完结他人演习
 *   §5 跨用户管理操作**保能力 + 需授权**：org admin 给成员发证 ⇒ 200 且真建行；非成员 ⇒ 403 且零行
 *   §6 名单不再退化/无界：affiliation='' ⇒ 空花名册；251 行同队 ⇒ 恰好 200
 *
 * ⚠️ 每条断言均按「把对应源码改坏，它必须**精确**变红」设计（见文件末突变账）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { server, seedTestData, userToken, db, makeAdmin, addCustodian, seedGovViewer } from './setup'
import { JWT_SECRET } from '../config'

// ─────────────────────────────────────────────────────────────────────────────
// 夹具
// ─────────────────────────────────────────────────────────────────────────────

const A = 'u_a'         // 攻击者（普通用户，持合法 token）
const B = 'u_b'         // 受害者
const OTHER = 'u_other' // 第三方（构造「与 A 无关」的私信）

const tk = (id: string) => `Bearer ${userToken(id)}`

function addUser(id: string, o: { name?: string; leader?: boolean; affiliation?: string; points?: number } = {}): void {
  db.prepare('INSERT INTO users (id, name, is_leader, affiliation, points) VALUES (?,?,?,?,?)')
    .run(id, o.name ?? id, o.leader ? 1 : 0, o.affiliation ?? '', o.points ?? 0)
}

const rid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`

/** 直接插一条外部认证（绕过端点，用于给 verify 造靶子）。 */
function insertExtCert(userId: string, type: string): string {
  const id = rid('ec')
  db.prepare('INSERT INTO external_certifications (id, user_id, type, issue_date, expiry_date) VALUES (?,?,?,?,?)')
    .run(id, userId, type, '2026-01-01', '2027-01-01')
  return id
}

/** 走**端点**提交认证（用于「自闭环伪造链」用例）。提交后从库里取 id（端点不回 id）。 */
async function submitCert(caller: string): Promise<string> {
  const res = await request(server).post('/api/rescue/certification')
    .set('Authorization', tk(caller)).send({ type: 'cpr', issuer: '红会' })
  expect(res.status).toBe(200)
  const row = db.prepare('SELECT id FROM external_certifications WHERE user_id = ? ORDER BY rowid DESC LIMIT 1')
    .get(caller) as { id: string }
  return row.id
}

function insertMsg(from: string, to: string, content: string): string {
  const id = rid('msg')
  db.prepare('INSERT INTO messages (id, from_user_id, from_user_name, to_user_id, content) VALUES (?,?,?,?,?)')
    .run(id, from, '', to, content)
  return id
}

function insertVideo(userId: string): string {
  const id = rid('vp')
  db.prepare('INSERT INTO video_posts (id, user_id) VALUES (?,?)').run(id, userId)
  return id
}

function insertComment(videoId: string, userId: string, content: string): string {
  const id = rid('vc')
  db.prepare('INSERT INTO video_comments (id, video_id, user_id, content) VALUES (?,?,?,?)')
    .run(id, videoId, userId, content)
  return id
}

function insertDrill(organizerId: string): string {
  const id = rid('dr')
  db.prepare('INSERT INTO drill_events (id, title, date, organizer_id, status, points_reward) VALUES (?,?,?,?,?,?)')
    .run(id, '演习', '2026-01-01', organizerId, 'upcoming', 50)
  return id
}

function insertParticipant(eventId: string, userId: string): void {
  db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id) VALUES (?,?,?)')
    .run(rid('dp'), eventId, userId)
}

function insertMobilization(leaderId: string): string {
  const id = rid('mob')
  db.prepare('INSERT INTO emergency_mobilizations (id, title, leader_id, status) VALUES (?,?,?,?)')
    .run(id, '动员', leaderId, 'pending')
  return id
}

function addOrg(id: string, name: string, adminUserId: string): void {
  db.prepare('INSERT INTO organizations (id, name, admin_user_id) VALUES (?,?,?)').run(id, name, adminUserId)
}

function addMember(orgId: string, userId: string, role: 'admin' | 'manager' | 'member'): void {
  db.prepare('INSERT INTO organization_members (id, org_id, user_id, role) VALUES (?,?,?,?)')
    .run(rid('om'), orgId, userId, role)
}

// ── 读取断言用 ──
const countOf = (sql: string, ...args: unknown[]): number =>
  (db.prepare(sql).get(...args) as { c: number }).c

const extCertCount = (userId: string) => countOf('SELECT COUNT(*) AS c FROM external_certifications WHERE user_id = ?', userId)
const extCertStatus = (id: string) =>
  (db.prepare('SELECT status FROM external_certifications WHERE id = ?').get(id) as { status: string }).status
const commentCount = (id: string) => countOf('SELECT COUNT(*) AS c FROM video_comments WHERE id = ?', id)
const drillStatus = (id: string) =>
  (db.prepare('SELECT status FROM drill_events WHERE id = ?').get(id) as { status: string }).status
const mobStatus = (id: string) =>
  (db.prepare('SELECT status FROM emergency_mobilizations WHERE id = ?').get(id) as { status: string }).status
const pointsOf = (id: string) => (db.prepare('SELECT points FROM users WHERE id = ?').get(id) as { points: number }).points
const organizerOf = (id: string) =>
  (db.prepare('SELECT is_organizer FROM users WHERE id = ?').get(id) as { is_organizer: number }).is_organizer
const trCount = () => countOf('SELECT COUNT(*) AS c FROM training_records')
const certificateCount = (userId: string) => countOf('SELECT COUNT(*) AS c FROM certificates WHERE user_id = ?', userId)
const mvCount = (userId: string) => countOf('SELECT COUNT(*) AS c FROM mobilization_volunteers WHERE user_id = ?', userId)
const liveCount = (userId: string) => countOf('SELECT COUNT(*) AS c FROM live_sessions WHERE user_id = ?', userId)
const mediaCount = (userId: string) => countOf('SELECT COUNT(*) AS c FROM task_media WHERE user_id = ?', userId)
const msgFromCount = (userId: string) => countOf('SELECT COUNT(*) AS c FROM messages WHERE from_user_id = ?', userId)
const drillOwnerOf = (id: string) =>
  (db.prepare('SELECT organizer_id FROM drill_events WHERE id = ?').get(id) as { organizer_id: string }).organizer_id
const videoOwnerOf = (id: string) =>
  (db.prepare('SELECT user_id FROM video_posts WHERE id = ?').get(id) as { user_id: string }).user_id
const dpCount = (userId: string) => countOf('SELECT COUNT(*) AS c FROM drill_participants WHERE user_id = ?', userId)

// ─────────────────────────────────────────────────────────────────────────────
// §1 守卫端点清单（P0-1 挂了 authMiddleware 的全部端点）
// ─────────────────────────────────────────────────────────────────────────────

type Method = 'get' | 'post' | 'put' | 'delete'

interface Endpoint { m: Method; p: string; body?: Record<string, unknown> }

/** rescue 15 + community 3 + drill 3 + video 3 + org 1 = 25。 */
const GUARDED: Endpoint[] = [
  // ---- rescue（15）----
  { m: 'post', p: '/api/rescue/certification', body: { type: 'cpr' } },
  { m: 'get', p: '/api/rescue/certifications' },
  { m: 'put', p: '/api/rescue/certification/ec_x/verify' },
  { m: 'post', p: '/api/rescue/mobilize', body: { title: 'x' } },
  { m: 'get', p: '/api/rescue/mobilizations' },
  { m: 'put', p: '/api/rescue/mobilizations/mob_x/approve' },
  { m: 'put', p: '/api/rescue/mobilizations/mob_x/complete' },
  { m: 'post', p: '/api/rescue/mobilizations/mob_x/respond', body: {} },
  { m: 'get', p: '/api/rescue/mobilizations/mob_x/volunteers' },
  { m: 'get', p: '/api/rescue/team' },
  { m: 'get', p: '/api/rescue/mobilizations/task_x/media' },
  { m: 'get', p: '/api/rescue/live/task_x' },
  { m: 'post', p: '/api/rescue/live/task_x/start', body: {} },
  { m: 'post', p: '/api/rescue/live/end/live_x', body: {} },
  { m: 'post', p: '/api/rescue/mobilizations/task_x/media', body: { content: 'x' } },
  // ---- community（3）----
  { m: 'get', p: '/api/community/messages' },
  { m: 'post', p: '/api/community/messages', body: { toUserId: B, content: 'x' } },
  { m: 'post', p: '/api/community/contact-aed/aed_001', body: { content: 'x' } },
  // ---- drill（3）----
  { m: 'post', p: '/api/drill/events', body: { title: 'x', date: '2026-01-01' } },
  { m: 'post', p: '/api/drill/events/dr_x/join', body: {} },
  { m: 'put', p: '/api/drill/events/dr_x/complete' },
  // ---- video（3）----
  { m: 'post', p: '/api/video/', body: { title: 'x' } },
  { m: 'post', p: '/api/video/vp_x/comment', body: { content: 'x' } },
  { m: 'delete', p: '/api/video/vp_x/comment/vc_x' },
  // ---- org（1）----
  { m: 'post', p: '/api/org/org_x/certificates', body: { userId: B, type: 'cpr', issueDate: '2026-01-01', expiryDate: '2027-01-01' } },
]

function call(e: Endpoint) {
  switch (e.m) {
    case 'get': return request(server).get(e.p)
    case 'post': return request(server).post(e.p)
    case 'put': return request(server).put(e.p)
    case 'delete': return request(server).delete(e.p)
  }
}

/** 发一次请求；`header` 为 `undefined` ⇒ 完全不带 Authorization。 */
function hit(e: Endpoint, header: string | undefined) {
  let r = call(e)
  if (header !== undefined) r = r.set('Authorization', header)
  if (e.m !== 'get') r = r.send(e.body ?? {})
  return r
}

describe('P0-1 鉴权加固 · 独立对抗性复核', () => {
  beforeEach(() => {
    seedTestData()
    addUser(A)
    addUser(B)
    addUser(OTHER)
  })

  // ===========================================================================
  // §1 无 token / 无效 token ⇒ 401（逐端点）
  // ===========================================================================
  it('S1：25 个守卫端点在「无 / 空 / 垃圾 / 错签名 / 过期 / gov」令牌下**全部** 401', async () => {
    // 守卫自检：清单不得为空转（若有人删条目，此断言先红）
    expect(GUARDED.length, '守卫端点清单数量').toBe(25)

    const govToken = seedGovViewer().token
    const expired = jwt.sign({ userId: A }, JWT_SECRET, { expiresIn: '-10s' })
    const wrongSig = jwt.sign({ userId: A }, 'a-totally-different-secret')

    const variants: Array<{ label: string; header: string | undefined }> = [
      { label: '无 Authorization', header: undefined },
      { label: '空串', header: '' },
      { label: 'Bearer + 空', header: 'Bearer ' },
      { label: '垃圾串', header: 'not-a-jwt' },
      { label: '错签名', header: `Bearer ${wrongSig}` },
      { label: '已过期', header: `Bearer ${expired}` },
      { label: 'gov 令牌', header: `Bearer ${govToken}` },
    ]

    for (const v of variants) {
      for (const e of GUARDED) {
        const res = await hit(e, v.header)
        expect(res.status, `${v.label} ⇒ ${e.m.toUpperCase()} ${e.p} 期望 401，实得 ${res.status}`).toBe(401)
      }
    }
  })

  // ===========================================================================
  // §2 冒充被阻断 —— 一律**断言受害者侧零变化**
  // ===========================================================================
  it('S2a：A 提交外部认证塞 body.userId=B ⇒ 记在 A 名下，B 零行', async () => {
    const res = await request(server).post('/api/rescue/certification')
      .set('Authorization', tk(A)).send({ type: 'cpr', issuer: '红会', userId: B })
    expect(res.status).toBe(200)
    expect(extCertCount(A)).toBe(1) // ★ 落在调用者
    expect(extCertCount(B)).toBe(0) // ★ B 侧零变化
  })

  it('S2b：A 读认证塞 query.userId=B ⇒ 仍只读到 A 的，B 的认证不被读到', async () => {
    insertExtCert(A, 'cert-A')
    insertExtCert(B, 'cert-B')
    const res = await request(server).get(`/api/rescue/certifications?userId=${B}`)
      .set('Authorization', tk(A))
    expect(res.status).toBe(200)
    const types: string[] = res.body.data.map((r: { type: string }) => r.type)
    expect(types).toContain('cert-A')
    expect(types).not.toContain('cert-B') // ★ B 的数据未被读到
  })

  it('S2c：A 读私信塞 query.userId=B ⇒ 仍只返回涉及 A 的；B↔第三方的私信不被读到', async () => {
    insertMsg(B, OTHER, 'B→O 私密')   // 与 A 完全无关
    insertMsg(A, B, 'A→B 正常')       // A 自己的，应当可见
    const res = await request(server).get(`/api/community/messages?userId=${B}`)
      .set('Authorization', tk(A))
    expect(res.status).toBe(200)
    const contents: string[] = res.body.data.map((m: { content: string }) => m.content)
    expect(contents).toContain('A→B 正常')
    expect(contents).not.toContain('B→O 私密') // ★ 隐私未泄露
  })

  it('S2d：A 删 B 的评论并在 body 塞 userId=B ⇒ 403，且评论仍在库里', async () => {
    const vid = insertVideo(B)
    const cid = insertComment(vid, B, 'B 的评论')
    const res = await request(server).delete(`/api/video/${vid}/comment/${cid}`)
      .set('Authorization', tk(A)).send({ userId: B }) // ★ 旧失效校验会认这个
    expect(res.status).toBe(403)
    expect(commentCount(cid)).toBe(1) // ★ B 侧零变化
  })

  it('S2e：非组织者 A 完结 B 的演习 ⇒ 403，且 status/积分/训练记录全无变化', async () => {
    const evId = insertDrill(B)
    insertParticipant(evId, A)
    const before = { status: drillStatus(evId), points: pointsOf(A), tr: trCount() }

    const res = await request(server).put(`/api/drill/events/${evId}/complete`)
      .set('Authorization', tk(A)).send({ userId: B })
    expect(res.status).toBe(403)
    expect(drillStatus(evId)).toBe(before.status) // 仍 upcoming
    expect(pointsOf(A)).toBe(before.points)       // ★ 没刷到积分
    expect(trCount()).toBe(before.tr)             // ★ 没写训练记录
  })

  it('S2f：A 发布视频塞 body.userId=B ⇒ 归属 A，B 名下零视频', async () => {
    const res = await request(server).post('/api/video/')
      .set('Authorization', tk(A)).send({ title: 't', userId: B })
    expect(res.status).toBe(200)
    const vid = res.body.data.id as string
    expect(videoOwnerOf(vid)).toBe(A)
    expect(countOf('SELECT COUNT(*) AS c FROM video_posts WHERE user_id = ?', B)).toBe(0)
  })

  it('S2g：A 创建演习塞 body.organizerId=B ⇒ 组织者恒为 A，B 名下零演习', async () => {
    const res = await request(server).post('/api/drill/events')
      .set('Authorization', tk(A)).send({ title: 't', date: '2026-01-01', organizerId: B })
    expect(res.status).toBe(200)
    expect(drillOwnerOf(res.body.data.id as string)).toBe(A)
    expect(countOf('SELECT COUNT(*) AS c FROM drill_events WHERE organizer_id = ?', B)).toBe(0)
  })

  it('S2h：A 报名演习塞 body.userId=B ⇒ 报名记在 A 名下，B 未被报名', async () => {
    const evId = insertDrill(B)
    const res = await request(server).post(`/api/drill/events/${evId}/join`)
      .set('Authorization', tk(A)).send({ userId: B })
    expect(res.status).toBe(200)
    expect(dpCount(A)).toBe(1)
    expect(dpCount(B)).toBe(0) // ★ B 侧零变化
  })

  it('S2i：A 响应动员塞 body.userId=B ⇒ 响应记在 A 名下，B 零响应行', async () => {
    const mobId = insertMobilization(B)
    const res = await request(server).post(`/api/rescue/mobilizations/${mobId}/respond`)
      .set('Authorization', tk(A)).send({ userId: B })
    expect(res.status).toBe(200)
    expect(mvCount(A)).toBe(1)
    expect(mvCount(B)).toBe(0) // ★ B 侧零变化
  })

  it('S2j：A 开直播塞 body.userId=B ⇒ 主播记在 A 名下，B 零直播行', async () => {
    const res = await request(server).post('/api/rescue/live/task_x/start')
      .set('Authorization', tk(A)).send({ userId: B })
    expect(res.status).toBe(200)
    expect(liveCount(A)).toBe(1)
    expect(liveCount(B)).toBe(0) // ★ B 侧零变化
  })

  it('S2k：A 发现场动态塞 body.userId=B ⇒ 记在 A 名下，B 零动态', async () => {
    const res = await request(server).post('/api/rescue/mobilizations/task_x/media')
      .set('Authorization', tk(A)).send({ content: 'x', userId: B })
    expect(res.status).toBe(200)
    expect(mediaCount(A)).toBeGreaterThan(0)
    expect(mediaCount(B)).toBe(0) // ★ B 侧零变化
  })

  it('S2l：A 发私信塞 body.fromUserId=B ⇒ 发件人恒为 A，B 名下零发出', async () => {
    const res = await request(server).post('/api/community/messages')
      .set('Authorization', tk(A)).send({ fromUserId: B, toUserId: OTHER, content: 'x' })
    expect(res.status).toBe(200)
    expect(msgFromCount(A)).toBe(1)
    expect(msgFromCount(B)).toBe(0) // ★ B 侧零变化
  })

  it('S2m：A 联系 AED 维护者塞 body.fromUserId=B ⇒ 发件人恒为 A，B 零发出', async () => {
    addCustodian('aed_001', B, '维护者B', 'primary')
    const res = await request(server).post('/api/community/contact-aed/aed_001')
      .set('Authorization', tk(A)).send({ fromUserId: B, content: 'x' })
    expect(res.status).toBe(200)
    expect(msgFromCount(A)).toBe(1)
    expect(msgFromCount(B)).toBe(0) // ★ B 侧零变化
  })

  // ===========================================================================
  // §3 ★ 自闭环伪造链被打断
  // ===========================================================================
  it('S3a（★ 最高价值）：A 提交认证后**自行** verify ⇒ 403，且 status **仍 pending**', async () => {
    const certId = await submitCert(A)
    expect(extCertStatus(certId)).toBe('pending')

    const res = await request(server).put(`/api/rescue/certification/${certId}/verify`)
      .set('Authorization', tk(A))
    expect(res.status).toBe(403)
    expect(extCertStatus(certId)).toBe('pending') // ★★ 不得变成 verified
  })

  it('S3b：换另一个普通用户 C 来 verify A 的认证 ⇒ 403，仍 pending', async () => {
    addUser('u_c')
    const certId = insertExtCert(A, 'cpr')
    const res = await request(server).put(`/api/rescue/certification/${certId}/verify`)
      .set('Authorization', tk('u_c'))
    expect(res.status).toBe(403)
    expect(extCertStatus(certId)).toBe('pending')
  })

  it('S3c（能力保留）：平台管理员 verify ⇒ 200 且 status=verified', async () => {
    addUser('u_admin')
    makeAdmin('u_admin')
    const certId = insertExtCert(A, 'cpr')
    const res = await request(server).put(`/api/rescue/certification/${certId}/verify`)
      .set('Authorization', tk('u_admin'))
    expect(res.status).toBe(200)
    expect(extCertStatus(certId)).toBe('verified')
  })

  it('S3d（能力保留）：机构 admin/manager 核实**本机构成员** ⇒ 200 且 status=verified', async () => {
    addUser('u_mgr')
    addOrg('org_1', '救援队', 'u_mgr')
    addMember('org_1', 'u_mgr', 'admin')
    addMember('org_1', A, 'member') // ★ 被认证者须属于该机构（P0-1 收窄：机构维度操作限本机构成员）
    const certId = insertExtCert(A, 'cpr')
    const res = await request(server).put(`/api/rescue/certification/${certId}/verify`)
      .set('Authorization', tk('u_mgr'))
    expect(res.status).toBe(200)
    expect(extCertStatus(certId)).toBe('verified')
  })

  /**
   * ★ 隔离**第二道**闸门（`isOrgManagerOf(caller, 被认证者)`）的对抗性夹具。
   *
   * 刻意比「目标不属于任何机构」更隐蔽：调用者 `u_mgr` **确实**是 org_1 的 admin，
   * 能通过**第一道**粗粒度闸门 `isPlatformOrOrgManager`；唯一能拦住它的是第二道
   * 「双方须同机构」。⇒ 若把判据退回宽的 `isOrgManager`（任一机构 admin 即可），
   * 本用例必红（而 S3d 不会红 —— 它本就是同机构，宽/窄口径下都放行）。
   */
  it('S3e（★ 隔离 stage-2）：机构 admin 核实**别的机构**成员的认证 ⇒ 403，且仍 pending', async () => {
    addUser('u_mgr')
    addUser('u_x_admin')
    addUser('u_x') // 被认证者：属于 **org_2**（不是 u_mgr 所在的 org_1）
    addOrg('org_1', '救援队1', 'u_mgr')
    addOrg('org_2', '救援队2', 'u_x_admin')
    addMember('org_1', 'u_mgr', 'admin')
    addMember('org_2', 'u_x', 'member')

    const certId = insertExtCert('u_x', 'cpr')
    const res = await request(server).put(`/api/rescue/certification/${certId}/verify`)
      .set('Authorization', tk('u_mgr'))
    expect(res.status).toBe(403)
    expect(extCertStatus(certId)).toBe('pending') // ★ 不得被置 verified
  })

  // ===========================================================================
  // §4 提权被阻断
  // ===========================================================================
  it('S4a：非管理员 A 审批**自己**的动员 ⇒ 403，A.is_organizer 仍 0、动员仍 pending', async () => {
    addUser('u_lead', { leader: true })
    const mobId = insertMobilization('u_lead')
    expect(organizerOf('u_lead')).toBe(0)

    const res = await request(server).put(`/api/rescue/mobilizations/${mobId}/approve`)
      .set('Authorization', tk('u_lead'))
    expect(res.status).toBe(403)
    expect(organizerOf('u_lead')).toBe(0)   // ★ 没能自提组织者
    expect(mobStatus(mobId)).toBe('pending') // ★ 状态未变
  })

  it('S4b（能力保留）：平台管理员审批 ⇒ 200，动员 active 且发起人 is_organizer=1', async () => {
    addUser('u_lead2', { leader: true })
    addUser('u_admin2')
    makeAdmin('u_admin2')
    const mobId = insertMobilization('u_lead2')

    const res = await request(server).put(`/api/rescue/mobilizations/${mobId}/approve`)
      .set('Authorization', tk('u_admin2'))
    expect(res.status).toBe(200)
    expect(mobStatus(mobId)).toBe('active')
    expect(organizerOf('u_lead2')).toBe(1)
  })

  it('S4c：非发起者 A 结束他人动员 ⇒ 403，且状态仍 pending', async () => {
    const mobId = insertMobilization(B)
    const res = await request(server).put(`/api/rescue/mobilizations/${mobId}/complete`)
      .set('Authorization', tk(A))
    expect(res.status).toBe(403)
    expect(mobStatus(mobId)).toBe('pending')
  })

  // ===========================================================================
  // §5 跨用户管理操作：保能力 + 需授权
  // ===========================================================================
  it('S5a（能力保留）：机构 admin 给**本机构成员**发证 ⇒ 200，且证书行**真的创建**', async () => {
    addUser('u_mgr')
    addUser('u_mem')
    addOrg('org_1', '救援队', 'u_mgr')
    addMember('org_1', 'u_mgr', 'admin')
    addMember('org_1', 'u_mem', 'member')

    const res = await request(server).post('/api/org/org_1/certificates')
      .set('Authorization', tk('u_mgr'))
      .send({ userId: 'u_mem', type: 'cpr', issueDate: '2026-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(200)
    expect(certificateCount('u_mem')).toBe(1) // ★ 真建行
  })

  it('S5b：manager（非 admin）同样可发证 ⇒ 200 且建行', async () => {
    addUser('u_mgr')
    addUser('u_mem')
    addOrg('org_1', '救援队', 'u_mgr')
    addMember('org_1', 'u_mgr', 'manager')
    addMember('org_1', 'u_mem', 'member')

    const res = await request(server).post('/api/org/org_1/certificates')
      .set('Authorization', tk('u_mgr'))
      .send({ userId: 'u_mem', type: 'cpr', issueDate: '2026-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(200)
    expect(certificateCount('u_mem')).toBe(1)
  })

  it('S5c：非本机构成员的 A ⇒ 403，且证书行**未被创建**', async () => {
    addUser('u_mgr')
    addUser('u_mem')
    addOrg('org_1', '救援队', 'u_mgr')
    addMember('org_1', 'u_mgr', 'admin')
    addMember('org_1', 'u_mem', 'member')

    const res = await request(server).post('/api/org/org_1/certificates')
      .set('Authorization', tk(A)) // A 不在 org_1
      .send({ userId: 'u_mem', type: 'cpr', issueDate: '2026-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(403)
    expect(certificateCount('u_mem')).toBe(0) // ★ 受害者侧零变化
  })

  it('S5d：本机构**普通 member** ⇒ 403，且证书行未被创建', async () => {
    addUser('u_mgr')
    addUser('u_mem')
    addOrg('org_1', '救援队', 'u_mgr')
    addMember('org_1', 'u_mgr', 'admin')
    addMember('org_1', 'u_mem', 'member')

    const res = await request(server).post('/api/org/org_1/certificates')
      .set('Authorization', tk('u_mem')) // role=member，无授权
      .send({ userId: 'u_mem', type: 'cpr', issueDate: '2026-01-01', expiryDate: '2027-01-01' })
    expect(res.status).toBe(403)
    expect(certificateCount('u_mem')).toBe(0)
  })

  // ===========================================================================
  // §6 名单不再退化 / 无界
  // ===========================================================================
  it('S6a：队长 affiliation="" ⇒ /team 返回**空花名册**（不得退化为全表）', async () => {
    addUser('u_lead', { leader: true, affiliation: '' })
    for (let i = 0; i < 5; i++) addUser(`u_e${i}`, { affiliation: '' }) // 5 个空 affiliation 用户

    const res = await request(server).get('/api/rescue/team').set('Authorization', tk('u_lead'))
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([]) // ★ 空，而不是 5~6 条
  })

  it('S6b：251 行同队数据 ⇒ /team **恰好**返回 200（LIMIT 生效）', async () => {
    addUser('u_lead', { leader: true, affiliation: 'T1' })
    for (let i = 0; i < 251; i++) addUser(`u_t${i}`, { affiliation: 'T1' })

    const res = await request(server).get('/api/rescue/team').set('Authorization', tk('u_lead'))
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(200) // ★ 恰好 200（无上限会是 252）
  })
})
