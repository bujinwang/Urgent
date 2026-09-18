/**
 * T05 独立对抗性验证（QA 第二双眼睛）—— 机构聚合 / 政府看板 / 不变量。
 *
 * 与实现方 `service-hours-gov.test.ts` **完全独立**：本文件用**反事实夹具**
 * （每个受测机制都是**唯一防线**）主动攻击，不复跑实现方的用例。
 *
 * 覆盖清单（对应派单「优先攻击清单」）：
 *  1. ★ 机构隔离（T11）—— 三人都有闭合台账，外机构成员的分钟数**绝不**混进
 *     `items` / `breakdown` / `totalMinutes` / `total`（**四路同时咬**）。
 *  2. ★ 权限 / 状态码矩阵（注意「调用者权限」与「数据范围」是两个维度）。
 *  3. ★ gov 零 PII **递归深扫**（扫器自带自检，防「扫器坏了却全绿」）。
 *  4. ★ 冷启动 / 全被过滤 ⇒ `serviceHours` 为 `null`（不是 0、不是 ''）。
 *  5. 不变量 `Σ breakdown ≡ totalMinutes`（含空集 `0 ≡ 0`）。
 *  6. 口径一致性：`gov.serviceHours` 与 `/service-hours/me` 必须**相等**。
 *  7. org 分页 / `activityType` 过滤边界 + 注入式取值。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, seedGovViewer, db } from './setup'
import { recordService } from '../services/serviceLog'
import type { ActivityType } from '../types'

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
const BASE = 1_700_000_000_000

let refSeq = 0
/** 写一条**已闭合、confirmed**的台账（默认计入）。`orgId` 显式归属（D-7：机构聚合按 `l.org_id` 求和）。 */
function seedLog(userId: string, type: ActivityType, minutes: number, orgId = '', opts: { isDrill?: boolean } = {}): void {
  refSeq += 1
  recordService({
    userId, activityType: type, sourceRef: `qa_ref_${refSeq}`, orgId,
    startedAtMs: BASE, endedAtMs: BASE + minutes * 60000, now: 1, isDrill: opts.isDrill,
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

const ORG1 = '/api/org/org1/service-hours'

// ---------------------------------------------------------------------------
// ★ 攻击 1：机构隔离（T11）—— 反事实夹具：外机构成员用**不同 activity_type**，
//    这样「隔离失败」会同时在 breakdown / totalMinutes / items / total 四处现形。
// ---------------------------------------------------------------------------
describe('T05-QA · ★ T11 机构隔离（反事实夹具，四路同时咬）', () => {
  beforeEach(() => {
    seedTestData()
    addUser('u_adminA', '管理员A'); addUser('u_memberA', '成员A'); addUser('u_otherB', '外机构B')
    addOrg('org1', '机构一', 'u_adminA'); addMember('org1', 'u_adminA', 'admin'); addMember('org1', 'u_memberA', 'member')
    addOrg('org2', '机构二', 'u_otherB'); addMember('org2', 'u_otherB', 'admin')
    // 三人**都有已闭合台账**；外机构者用独立类型 + 独特分钟数（★ 必须 ≤480，
    // 否则会被 MAX_SINGLE_MINUTES 封顶成 pending ⇒ 无论隔离是否生效都被排除 ⇒ 突变不可见）。
    // D-7：台账按 `l.org_id` 归属机构；org1 成员归属 org1、外机构者归属 org2。
    seedLog('u_adminA', 'rescue_task', 30, 'org1')
    seedLog('u_memberA', 'rescue_task', 45, 'org1')
    seedLog('u_otherB', 'training', 100, 'org2') // ← 外机构：绝不得出现
  })

  it('外机构成员绝不出现在 items / breakdown / totalMinutes / total（四路）', async () => {
    const res = await request(server).get(ORG1).set(auth(userToken('u_adminA')))
    expect(res.status).toBe(200)
    const d = res.body.data

    // ① items：只含两名本机构成员
    const ids = d.items.map((i: { userId: string }) => i.userId).sort()
    expect(ids).toEqual(['u_adminA', 'u_memberA'])
    expect(ids).not.toContain('u_otherB')

    // ② breakdown：不得含外机构者贡献的类型 'training'
    const types = d.breakdown.map((b: { activityType: string }) => b.activityType)
    expect(types).toEqual(['rescue_task'])
    expect(types).not.toContain('training')

    // ③ totalMinutes：**分子里不得含 100**
    expect(d.totalMinutes).toBe(75)
    expect(d.totalMinutes).not.toBe(175) // 75 + 100

    // ④ total（去重人数）也不得把他算进去
    expect(d.total).toBe(2)

    // ⑤ 原始报文级：外机构 userId 不得以任何形式出现
    expect(JSON.stringify(res.body)).not.toContain('u_otherB')
  })

  it('即使 pageSize 开到极大，跨机构成员也不泄漏', async () => {
    const res = await request(server).get(`${ORG1}?pageSize=1000`).set(auth(userToken('u_adminA')))
    expect(res.status).toBe(200)
    expect(res.body.data.total).toBe(2)
    expect(res.body.data.totalMinutes).toBe(75)
    expect(res.body.data.totalMinutes).not.toBe(175)
    expect(JSON.stringify(res.body)).not.toContain('training')
    expect(JSON.stringify(res.body)).not.toContain('u_otherB')
  })
})

/* ───────────────────────── ★ D-7：单机构归属（不跨机构翻倍） ───────────────────────── */
describe('T05-QA · ★ D-7 单机构归属：单条机构台账只计入归属机构，不跨机构翻倍/泄漏', () => {
  beforeEach(() => {
    seedTestData()
    addUser('u_adminA'); addUser('u_memberA'); addUser('u_otherB'); addUser('u_both')
    addOrg('org1', '机构一', 'u_adminA')
    addMember('org1', 'u_adminA', 'admin'); addMember('org1', 'u_memberA', 'member'); addMember('org1', 'u_both', 'member')
    addOrg('org2', '机构二', 'u_otherB'); addMember('org2', 'u_otherB', 'admin'); addMember('org2', 'u_both', 'member')
    // u_both 是 org1 与 org2 的**双重成员**，但其一条台账仅归属 org1
    seedLog('u_adminA', 'rescue_task', 30, 'org1')
    seedLog('u_memberA', 'rescue_task', 45, 'org1')
    seedLog('u_otherB', 'rescue_task', 99, 'org2')
    seedLog('u_both', 'rescue_task', 30, 'org1')
  })

  it('单条机构台账只计入归属机构；双重成员不使其在另一机构翻倍', async () => {
    const r1 = await request(server).get(ORG1).set(auth(userToken('u_adminA')))
    expect(r1.status).toBe(200)
    expect(r1.body.data.totalMinutes).toBe(105) // 30 + 45 + 30（u_both 只算 org1 这条）
    expect(r1.body.data.total).toBe(3)
    expect(r1.body.data.items.map((i: { userId: string }) => i.userId).sort()).toEqual(['u_adminA', 'u_both', 'u_memberA'])

    const r2 = await request(server).get('/api/org/org2/service-hours').set(auth(userToken('u_otherB')))
    expect(r2.status).toBe(200)
    expect(r2.body.data.totalMinutes).toBe(99) // 只 u_otherB 的 org2 台账；u_both 的 org1 台账**不**跨机构翻倍
    expect(r2.body.data.total).toBe(1)
    expect(r2.body.data.items.map((i: { userId: string }) => i.userId)).toEqual(['u_otherB'])
  })
})

// ---------------------------------------------------------------------------
// ★ 攻击 2：权限 / 状态码矩阵
// ---------------------------------------------------------------------------
describe('T05-QA · ★ 权限与状态码矩阵', () => {
  beforeEach(() => {
    seedTestData()
    addUser('u_adminA'); addUser('u_memberA'); addUser('u_mgrA'); addUser('u_otherB'); addUser('u_stranger')
    addOrg('org1', '机构一', 'u_adminA')
    addMember('org1', 'u_adminA', 'admin')
    addMember('org1', 'u_memberA', 'member')
    addMember('org1', 'u_mgrA', 'manager')
    addOrg('org2', '机构二', 'u_otherB'); addMember('org2', 'u_otherB', 'admin')
    // 三个机构都有数据，确保「403」不是因为「没数据」
    seedLog('u_adminA', 'rescue_task', 30)
    seedLog('u_otherB', 'rescue_task', 99)
  })

  const cases: Array<[string, () => Promise<number>, number]> = [
    ['无 token ⇒ 401', () => request(server).get(ORG1).then((r) => r.status), 401],
    ['未知机构 id（有效 token）⇒ 404', () => request(server).get('/api/org/nope/service-hours').set(auth(userToken('u_adminA'))).then((r) => r.status), 404],
    ['未知机构 id + 无 token ⇒ 401（鉴权先于存在性）', () => request(server).get('/api/org/nope/service-hours').then((r) => r.status), 401],
    ['本机构 admin ⇒ 200', () => request(server).get(ORG1).set(auth(userToken('u_adminA'))).then((r) => r.status), 200],
    ['本机构 manager ⇒ 200', () => request(server).get(ORG1).set(auth(userToken('u_mgrA'))).then((r) => r.status), 200],
    ['本机构普通成员 ⇒ 403', () => request(server).get(ORG1).set(auth(userToken('u_memberA'))).then((r) => r.status), 403],
    ['完全非成员 ⇒ 403', () => request(server).get(ORG1).set(auth(userToken('u_stranger'))).then((r) => r.status), 403],
    ['★ A 机构 admin 查 B 机构 ⇒ 403（不是 200+空集）', () => request(server).get('/api/org/org2/service-hours').set(auth(userToken('u_adminA'))).then((r) => r.status), 403],
    ['★ B 机构 admin 查 A 机构 ⇒ 403（不是 200+空集）', () => request(server).get(ORG1).set(auth(userToken('u_otherB'))).then((r) => r.status), 403],
  ]

  for (const [name, run, expected] of cases) {
    it(name, async () => { expect(await run()).toBe(expected) })
  }

  it('机构存在但无计入时长 ⇒ 200 + 空集（不是 404 / 不是 403）', async () => {
    addUser('u_empty_admin'); addOrg('org3', '空机构', 'u_empty_admin'); addMember('org3', 'u_empty_admin', 'admin')
    const res = await request(server).get('/api/org/org3/service-hours').set(auth(userToken('u_empty_admin')))
    expect(res.status).toBe(200)
    expect(res.body.data.items).toEqual([])
    expect(res.body.data.breakdown).toEqual([])
    expect(res.body.data.totalMinutes).toBe(0)
    expect(res.body.data.total).toBe(0)
  })

  it('注入式 org id（含引号）⇒ 404，绝不泄漏全量', async () => {
    const res = await request(server).get("/api/org/org1'%20OR%20'1'='1/service-hours").set(auth(userToken('u_adminA')))
    expect(res.status).toBe(404)
    expect(JSON.stringify(res.body)).not.toContain('u_otherB')
  })
})

// ---------------------------------------------------------------------------
// ★ 攻击 3：gov 零 PII 递归深扫（扫器自带自检，防「扫器坏了却全绿」）
// ---------------------------------------------------------------------------
const PII_KEYS = new Set(['userId', 'user_id', 'name', 'phone', 'userName', 'realName', 'phoneNumber', 'custodianName'])

/** 递归收集所有键名与所有字符串值。 */
function scan(node: unknown, keys: string[] = [], strings: string[] = []): { keys: string[]; strings: string[] } {
  if (Array.isArray(node)) { for (const v of node) scan(v, keys, strings); return { keys, strings } }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      keys.push(k)
      if (typeof v === 'string') strings.push(v)
      else scan(v, keys, strings)
    }
  }
  return { keys, strings }
}
const piiViolations = (node: unknown): string[] => {
  const { keys, strings } = scan(node)
  const bad: string[] = []
  for (const k of keys) if (PII_KEYS.has(k)) bad.push(`key:${k}`)
  for (const s of strings) if (s === '陆远' || s.includes('陆远') || s.includes('user_001')) bad.push(`value:${s}`)
  return bad
}

describe('T05-QA · ★ gov 零 PII 递归深扫', () => {
  beforeEach(() => { seedTestData() })

  it('扫器自检：埋入 PII 必须被检出（否则深扫是装饰品）', () => {
    expect(piiViolations({ a: { b: [{ userId: 'x' }] } })).toContain('key:userId')
    expect(piiViolations({ a: { b: { name: '陆远' } } })).toContain('key:name')
    expect(piiViolations({ a: { b: 'user_001' } })).toContain('value:user_001')
  })

  it('/dashboard 全响应体（含 serviceHours）深扫无 userId / name / phone', async () => {
    seedLog('user_001', 'rescue_task', 30)
    seedLog('user_001', 'drill', 20)
    const { token } = seedGovViewer()
    const res = await request(server).get('/api/gov/dashboard').set(auth(token))
    expect(res.status).toBe(200)

    // 先确认扫器**真的扫到了大量节点**（防空转假绿）
    const { keys } = scan(res.body)
    expect(keys.length).toBeGreaterThan(20)

    expect(piiViolations(res.body)).toEqual([])

    // serviceHours 自身的键必须恰好是三个聚合字段
    expect(Object.keys(res.body.data.serviceHours).sort())
      .toEqual(['byActivityType', 'participantCount', 'totalMinutes'].sort())
  })
})

// ---------------------------------------------------------------------------
// ★ 攻击 4：冷启动 / 全被过滤 ⇒ null
// ---------------------------------------------------------------------------
describe('T05-QA · ★ gov serviceHours 冷启动 ⇒ null（不是 0 / 不是 ""）', () => {
  beforeEach(() => { seedTestData() })

  it('完全无台账 ⇒ null', async () => {
    const { token } = seedGovViewer()
    const sh = (await request(server).get('/api/gov/dashboard').set(auth(token))).body.data.serviceHours
    expect(sh).toBeNull()
    expect(sh).not.toBe(0)
    expect(sh).not.toBe('')
    expect(sh).not.toEqual({})
  })

  it('有台账但全被过滤（演习 + 未闭合）⇒ 仍为 null（绝不 0 兜底）', async () => {
    seedLog('user_001', 'drill', 20, '', { isDrill: true }) // 演习 ⇒ 排除
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: 'qa_open', startedAtMs: BASE, endedAtMs: null, now: 1 }) // 未闭合 ⇒ 排除
    const { token } = seedGovViewer()
    const sh = (await request(server).get('/api/gov/dashboard').set(auth(token))).body.data.serviceHours
    expect(sh).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// ★ 攻击 5/6：不变量 + 口径一致性
// ---------------------------------------------------------------------------
describe('T05-QA · ★ 不变量 Σbreakdown ≡ totalMinutes + gov vs /me 口径一致', () => {
  beforeEach(() => { seedTestData() })

  it('空集：breakdown=[] 且 totalMinutes=0（0≡0）', async () => {
    addUser('u_e'); addOrg('orgE', '空机构', 'u_e'); addMember('orgE', 'u_e', 'admin')
    const d = (await request(server).get('/api/org/orgE/service-hours').set(auth(userToken('u_e')))).body.data
    expect(d.breakdown).toEqual([])
    expect(d.totalMinutes).toBe(0)
    expect(d.breakdown.reduce((s: number, b: { minutes: number }) => s + b.minutes, 0)).toBe(d.totalMinutes)
  })

  it('gov 与 /me 对同一份数据必须相等（含演习/未闭合/封顶干扰项）', async () => {
    seedLog('user_001', 'rescue_task', 30) // 计入
    seedLog('user_001', 'drill', 20, '', { isDrill: true }) // 演习 ⇒ 两处都排除
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: 'qa_open', startedAtMs: BASE, endedAtMs: null, now: 1 }) // 未闭合
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: 'qa_cap', startedAtMs: BASE, endedAtMs: BASE + 600 * 60000, now: 1 }) // 600 分 ⇒ 封顶 pending

    const me = (await request(server).get('/api/volunteer/service-hours/me').set(auth(userToken('user_001')))).body.data
    const { token } = seedGovViewer()
    const sh = (await request(server).get('/api/gov/dashboard').set(auth(token))).body.data.serviceHours

    expect(me.totalMinutes).toBe(30)
    expect(sh.totalMinutes).toBe(30)
    expect(sh.totalMinutes).toBe(me.totalMinutes) // ★ 口径一致（唯一事实源 COUNTING_WHERE）
    expect(sh.participantCount).toBe(1)

    const meSum = me.breakdown.reduce((s: number, b: { minutes: number }) => s + b.minutes, 0)
    const govSum = sh.byActivityType.reduce((s: number, b: { minutes: number }) => s + b.minutes, 0)
    expect(meSum).toBe(me.totalMinutes)
    expect(govSum).toBe(sh.totalMinutes)
  })
})

// ---------------------------------------------------------------------------
// ★ 攻击 7：org 分页 / activityType 过滤 / 注入
// ---------------------------------------------------------------------------
describe('T05-QA · org 分页与 activityType 边界', () => {
  beforeEach(() => {
    seedTestData()
    addUser('u_boss'); addOrg('orgP', '大机构', 'u_boss'); addMember('orgP', 'u_boss', 'admin')
    for (let i = 0; i < 5; i++) {
      addUser(`u_m${i}`); addMember('orgP', `u_m${i}`, 'member')
      seedLog(`u_m${i}`, 'rescue_task', 10 * (i + 1), 'orgP')
    }
  })
  const get = (q = '', u = 'u_boss') => request(server).get(`/api/org/orgP/service-hours${q}`).set(auth(userToken(u)))

  it('page/pageSize 分页边界', async () => {
    const p1 = await get('?pageSize=2&page=1')
    expect(p1.body.data.items.length).toBe(2)
    expect(p1.body.data.total).toBe(5)
    const p3 = await get('?pageSize=2&page=3')
    expect(p3.body.data.items.length).toBe(1)
    const p10 = await get('?pageSize=2&page=10')
    expect(p10.body.data.items.length).toBe(0)
    expect(p10.body.data.total).toBe(5) // 越界页不改 total
  })

  it('非法分页值被夹紧，不崩', async () => {
    expect((await get('?pageSize=-1')).body.data.items.length).toBe(1)
    expect((await get('?page=0')).status).toBe(200)
    expect((await get('?page=abc&pageSize=xyz')).status).toBe(200)
    expect((await get('?pageSize=1000')).body.data.total).toBe(5)
  })

  it('activityType：合法过滤生效，注入式取值被忽略（不注入、不报错）', async () => {
    const filtered = await get('?activityType=rescue_task')
    expect(filtered.body.data.total).toBe(5)
    const none = await get('?activityType=training')
    expect(none.body.data.total).toBe(0)
    expect(none.body.data.totalMinutes).toBe(0)
    const injected = await get("?activityType='%20OR%201=1%20--")
    expect(injected.status).toBe(200)
    expect(injected.body.data.total).toBe(5) // 白名单外 ⇒ 视为无过滤（而非注入生效）
  })
})
