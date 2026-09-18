/**
 * T05 · 机构侧服务时长汇总（机构隔离 T11）+ 政府看板 `serviceHours`（零 PII / 冷启动 null）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, seedGovViewer, db } from './setup'
import { recordService, purgeServiceLogs } from '../services/serviceLog'
import type { ActivityType } from '../types'

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
const BASE = 1_700_000_000_000

let refSeq = 0
function seedLog(userId: string, type: ActivityType, minutes: number): void {
  refSeq += 1
  recordService({
    userId, activityType: type, sourceRef: `govref_${refSeq}`,
    startedAtMs: BASE, endedAtMs: BASE + minutes * 60000, now: 1,
  })
}

function addUser(id: string, name = id): void {
  db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(id, name)
}
function addOrg(id: string, name: string, adminId: string): void {
  db.prepare("INSERT INTO organizations (id, name, type, admin_user_id) VALUES (?, ?, 'company', ?)").run(id, name, adminId)
}
function addMember(orgId: string, userId: string, role: 'admin' | 'manager' | 'member'): void {
  db.prepare('INSERT INTO organization_members (id, org_id, user_id, role) VALUES (?, ?, ?, ?)')
    .run(`om_${orgId}_${userId}`, orgId, userId, role)
}

/** org1: adminA(admin) + memberA(member)；org2: otherB(admin)。 */
function seedOrgs(): void {
  addUser('u_adminA', '管理员A'); addUser('u_memberA', '成员A'); addUser('u_otherB', '外机构B')
  addOrg('org1', '机构一', 'u_adminA'); addMember('org1', 'u_adminA', 'admin'); addMember('org1', 'u_memberA', 'member')
  addOrg('org2', '机构二', 'u_otherB'); addMember('org2', 'u_otherB', 'admin')
}

describe('T05 · 机构侧服务时长 GET /api/org/:id/service-hours', () => {
  beforeEach(() => { seedTestData(); seedOrgs() })

  it('未登录（无 token）⇒ 401', async () => {
    expect((await request(server).get('/api/org/org1/service-hours')).status).toBe(401)
  })

  it('机构不存在 ⇒ 404', async () => {
    const res = await request(server).get('/api/org/nope/service-hours').set(auth(userToken('u_adminA')))
    expect(res.status).toBe(404)
  })

  it('非 admin/manager（本机构普通成员）⇒ 403', async () => {
    const res = await request(server).get('/api/org/org1/service-hours').set(auth(userToken('u_memberA')))
    expect(res.status).toBe(403)
  })

  it('跨机构调用者 ⇒ 403（不报错、更不回全量）', async () => {
    const res = await request(server).get('/api/org/org1/service-hours').set(auth(userToken('u_otherB')))
    expect(res.status).toBe(403)
  })

  it('★ T11 机构隔离：只含本机构成员，绝不出现外机构成员', async () => {
    seedLog('u_adminA', 'rescue_task', 30)
    seedLog('u_memberA', 'rescue_task', 45)
    seedLog('u_otherB', 'rescue_task', 100) // 外机构：**不得**出现

    const res = await request(server).get('/api/org/org1/service-hours').set(auth(userToken('u_adminA')))
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.orgId).toBe('org1')
    expect(d.totalMinutes).toBe(75)
    expect(d.total).toBe(2)
    const ids = d.items.map((i: { userId: string }) => i.userId)
    expect(ids).toContain('u_adminA')
    expect(ids).toContain('u_memberA')
    expect(ids).not.toContain('u_otherB') // ★ 跨机构隔离（T11）
    // 分项之和恒等于总时长
    const sum = d.breakdown.reduce((s: number, b: { minutes: number }) => s + b.minutes, 0)
    expect(sum).toBe(d.totalMinutes)
  })

  it('本机构无计入时长 ⇒ 空集（不 0 兜底成假数据、不报错）', async () => {
    const res = await request(server).get('/api/org/org1/service-hours').set(auth(userToken('u_adminA')))
    expect(res.status).toBe(200)
    expect(res.body.data.totalMinutes).toBe(0)
    expect(res.body.data.items).toEqual([])
    expect(res.body.data.breakdown).toEqual([])
    expect(res.body.data.total).toBe(0)
  })
})

describe('T05 · 政府看板 serviceHours（零 PII / 冷启动 null）', () => {
  beforeEach(() => { seedTestData() })

  it('冷启动（无计数台账）⇒ serviceHours 为 null（绝不 0 兜底）', async () => {
    const { token } = seedGovViewer()
    const res = await request(server).get('/api/gov/dashboard').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.serviceHours).toBeNull()
  })

  it('有数据 ⇒ 聚合正确、零 PII（深扫不含 userId/name/phone）', async () => {
    seedLog('user_001', 'rescue_task', 30)
    seedLog('user_001', 'drill', 20)

    const { token } = seedGovViewer()
    const res = await request(server).get('/api/gov/dashboard').set(auth(token))
    expect(res.status).toBe(200)

    const sh = res.body.data.serviceHours
    expect(sh).not.toBeNull()
    expect(Object.keys(sh).sort()).toEqual(['byActivityType', 'participantCount', 'totalMinutes'].sort())
    expect(sh.totalMinutes).toBe(50)
    expect(sh.participantCount).toBe(1)
    const sum = sh.byActivityType.reduce((s: number, b: { minutes: number }) => s + b.minutes, 0)
    expect(sum).toBe(50)

    // 深扫：整份响应体不得出现身份字段（键名或本次种子用户的值）
    const blob = JSON.stringify(res.body)
    expect(blob).not.toContain('userId')
    expect(blob).not.toContain('user_001')
    expect(blob).not.toContain('陆远') // seedTestData 的 user_001 姓名
    expect(blob).not.toContain('phone')
  })
})

describe('T05 · 台账保留期清理：只碰台账，★绝不碰证明（D7 权益凭证）', () => {
  beforeEach(() => { seedTestData() })

  it('purgeServiceLogs 清理旧台账，但证明记录仍在', () => {
    recordService({
      userId: 'user_001', activityType: 'rescue_task', sourceRef: 'old_ref',
      startedAtMs: 1, endedAtMs: 1 + 30 * 60000, now: 1, // created_at_ms = 1（很久以前）
    })
    db.prepare(
      `INSERT INTO service_certificates
         (id, user_id, cert_no, period_from_ms, period_to_ms, total_minutes, breakdown_json, issued_at_ms, issued_by, status, revoked_at_ms, revoke_reason)
       VALUES ('sc_keep','user_001','VS-KEEP',0,1,30,'[]',1,'self','active',NULL,'')`
    ).run()

    const affected = purgeServiceLogs(Date.now(), false) // cutoff = now ⇒ 旧台账应被清理
    expect(affected).toBeGreaterThanOrEqual(1)
    expect((db.prepare('SELECT COUNT(*) AS c FROM volunteer_service_logs').get() as { c: number }).c).toBe(0)
    // ★ 证明记录**永不**被清理（权益凭证 D7）
    expect((db.prepare("SELECT COUNT(*) AS c FROM service_certificates WHERE cert_no = 'VS-KEEP'").get() as { c: number }).c).toBe(1)
  })

  it('dryRun=true ⇒ 只报数、不删', () => {
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: 'old_ref2', startedAtMs: 1, endedAtMs: 1 + 10 * 60000, now: 1 })
    const would = purgeServiceLogs(Date.now(), true)
    expect(would).toBeGreaterThanOrEqual(1)
    expect((db.prepare('SELECT COUNT(*) AS c FROM volunteer_service_logs').get() as { c: number }).c).toBe(1) // 未删
  })
})

// ---------------------------------------------------------------------------
// ★★ T41（v1.6，§4.5-③）gov 全局口径「跨机构不翻倍」
//
// 口径（设计写死，防两套算法漂移）：
//   - gov 总时长 = `SUM(duration_min)` **直接对台账、只算一次**（**不得**经「各机构汇总相加」）；
//   - gov 人次   = `COUNT(DISTINCT user_id)`（**去重**）。
//
// 反事实夹具：`u_multi` 同时属于 `orgA`、`orgB`，且有两份已闭合台账（30 + 20 = 50 分钟）。
// 按 (a)「按成员」口径，他的时长会在**两个机构报表里各出现一次**（视图重复，非重复计），
// 所以「把各机构相加」会得到 50 + 50 = 100 ⇒ gov 数字**翻倍**。本用例专咬这条路。
// ---------------------------------------------------------------------------
describe('★★ T41 · gov 全局口径：一人同属 A、B 两机构 ⇒ 不翻倍（v1.6 §4.5-③）', () => {
  beforeEach(() => {
    seedTestData()
    addUser('u_adminA', '管理员A'); addUser('u_adminB', '管理员B'); addUser('u_multi', '跨机构者')
    addOrg('orgA', '机构A', 'u_adminA'); addMember('orgA', 'u_adminA', 'admin'); addMember('orgA', 'u_multi', 'member')
    addOrg('orgB', '机构B', 'u_adminB'); addMember('orgB', 'u_adminB', 'admin'); addMember('orgB', 'u_multi', 'member')
    // u_multi 的**两份**台账（30 + 20 = 50 分钟）；两个 admin 无台账（保证差异只来自 u_multi）。
    seedLog('u_multi', 'rescue_task', 30)
    seedLog('u_multi', 'drill', 20)
  })

  it('gov.totalMinutes = 台账之和（50，**不 ×2**）；participantCount = 1（**去重**）', async () => {
    const { token } = seedGovViewer()
    const sh = (await request(server).get('/api/gov/dashboard').set(auth(token))).body.data.serviceHours

    expect(sh).not.toBeNull()
    expect(sh.totalMinutes).toBe(50)
    expect(sh.totalMinutes).not.toBe(100) // ★ 按「各机构相加」会得 100（A、B 都含该人）
    expect(sh.participantCount).toBe(1)
    expect(sh.participantCount).not.toBe(2) // ★ 不去重的「按成员」会得 2
  })

  it('(a) 按成员口径的预期重复：A、B 两机构各自报表**都含**该人（各 50 分钟）', async () => {
    const a = (await request(server).get('/api/org/orgA/service-hours').set(auth(userToken('u_adminA')))).body.data
    const b = (await request(server).get('/api/org/orgB/service-hours').set(auth(userToken('u_adminB')))).body.data

    for (const d of [a, b]) {
      expect(d.totalMinutes).toBe(50)
      expect(d.total).toBe(1) // 该机构内**去重**人数
      expect(d.items.map((i: { userId: string }) => i.userId)).toContain('u_multi')
    }
    // 两机构报表相加 = 100（视图重复）—— 与 gov 全局 50 的对比，正是「不经机构相加」的理由。
    expect(a.totalMinutes + b.totalMinutes).toBe(100)
    expect(a.totalMinutes + b.totalMinutes).not.toBe(0) // 防止上方 50+50 因两侧都空而"碰巧"成立
  })
})

// ---------------------------------------------------------------------------
// ★★ T42（v1.6，§4.5-④）gov `null` 判据 = 「**有无台账行**」，不是「分钟数是否为 0」
//
// 问题：`started_at_ms == ended_at_ms`（已确认但零时长）的行 ⇒ `/me` 返回 total=0 且 breakdown 有 1 项，
// 而 gov 曾因 `totalMinutes <= 0` 返回 `null` ⇒ **同一份数据、两端点结论相反**。
// 统一后：**无计数行 ⇒ `null`；有行 ⇒ 返回对象（`totalMinutes` 可为 0）**。
// ---------------------------------------------------------------------------
describe('★★ T42 · gov serviceHours 零时长行判据统一（v1.6 §4.5-④）', () => {
  beforeEach(() => { seedTestData() })

  it('仅一条**零时长**（started==ended）已确认行 ⇒ 返回对象而非 null（totalMinutes:0, participantCount:1）', async () => {
    recordService({
      userId: 'user_001', activityType: 'rescue_task', sourceRef: 'gov_zero',
      startedAtMs: BASE, endedAtMs: BASE, now: 1, // ★ 0 分钟（事实：他确实参与过）
    })
    const { token } = seedGovViewer()
    const sh = (await request(server).get('/api/gov/dashboard').set(auth(token))).body.data.serviceHours

    expect(sh).not.toBeNull() // ★ 判据 = 「有无台账行」，不是「分钟数是否为 0」
    expect(sh.totalMinutes).toBe(0) // 0 分钟是一个事实，不得折成 null
    expect(sh.participantCount).toBe(1)
    // 零时长行**仍可见于分项**（count=1），与 `/me` 的 breakdown 口径一致
    expect(sh.byActivityType).toEqual([
      { activityType: 'rescue_task', minutes: 0, count: 1 },
    ])
  })

  it('无任何计数台账 ⇒ null（与上一条互为反方向，证明判据真的看「有无行」）', async () => {
    const { token } = seedGovViewer()
    const sh = (await request(server).get('/api/gov/dashboard').set(auth(token))).body.data.serviceHours
    expect(sh).toBeNull()
  })
})
