/**
 * F4 T41/T42 **独立对抗性验证**（QA · software-qa-engineer-3-3）。
 *
 * 与实现方文件（`service-hours-gov.test.ts`）**完全独立**：自带夹具/断言，只用来承载
 * 「改坏 gov 源码 ⇒ 本文件必须精确变红」的突变。
 *
 * 被攻击的不变量（设计 §4.5-③ / §4.5-④）：
 *  - T41：① gov 全局 `totalMinutes` = 台账之和（**不 ×2**）、`participantCount` = **1**（去重）；
 *         ② D-7 后机构聚合按台账 `l.org_id` 求和 ⇒ 一人同属 A、B 只计入其**确定性归属机构一次**
 *           （(a)：归属机构报含有其人、另一家不含、两报表相加=50，不再翻倍）。
 *  - T42：`null` 判据 = **「有无计数中的台账行」**（不是「分钟数是否为 0」）：
 *         **无行 ⇒ null**；**有行但 0 分钟 ⇒ 返回对象（totalMinutes: 0）**；且与 `/service-hours/me` **口径一致**。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, seedGovViewer, db } from './setup'
import { recordService } from '../services/serviceLog'
import type { ActivityType } from '../types'

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
const BASE = 1_700_000_000_000

let seq = 0
/**
 * 写入一条已闭合台账。
 *
 * ⚠️ D-7 后机构聚合改读台账 `l.org_id`（不再是按成员 JOIN），故本独立测试**显式**传入
 * `orgId`（= 用户的确定性归属机构），使 ledger 行的 `org_id` 与归属一致。这样 T41(a)
 * 只验证 org 端点 `WHERE l.org_id` 过滤这一**单一机制**——若变红，能精准定位到 org 聚合，
 * 而非 `resolveUserOrgId`（其归属推导由实现方的 `org-caliber-d7.test.ts` 独立覆盖）。
 */
function seedLog(userId: string, type: ActivityType, minutes: number, orgId: string = ''): void {
  seq += 1
  recordService({
    userId, activityType: type, sourceRef: `qa_ref_${seq}`,
    orgId,
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

async function govServiceHours(): Promise<unknown> {
  const { token } = seedGovViewer()
  const res = await request(server).get('/api/gov/dashboard').set(auth(token))
  expect(res.status).toBe(200)
  return res.body.data.serviceHours
}

// ---------------------------------------------------------------------------
// ★★ T41：一人同属 A、B 两机构 ⇒ gov 不翻倍
// ---------------------------------------------------------------------------
describe('★★ T41 独立验证 · gov 全局口径「跨机构不翻倍」', () => {
  beforeEach(() => {
    seedTestData()
    // 该人同属 A、B；但 D-7 后确定性归属 qaOrgA（admin 优先）。两个 admin 均无台账（保证差异只来自 u_multi）。
    addUser('u_a_admin', 'A管理员'); addUser('u_b_admin', 'B管理员'); addUser('u_multi', '跨机构者')
    addOrg('qaOrgA', '机构A', 'u_a_admin'); addMember('qaOrgA', 'u_a_admin', 'admin'); addMember('qaOrgA', 'u_multi', 'admin')
    addOrg('qaOrgB', '机构B', 'u_b_admin'); addMember('qaOrgB', 'u_b_admin', 'admin'); addMember('qaOrgB', 'u_multi', 'member')
    // 两份已闭合台账：30 + 20 = 50 分钟；**显式**归属 qaOrgA（与生产 resolveUserOrgId 推导一致）。
    seedLog('u_multi', 'rescue_task', 30, 'qaOrgA')
    seedLog('u_multi', 'drill', 20, 'qaOrgA')
  })

  it('★ gov.totalMinutes = 台账之和（50，**不 ×2**）、participantCount = 1（**去重**）', async () => {
    const sh = (await govServiceHours()) as {
      totalMinutes: number; participantCount: number; byActivityType: Array<{ minutes: number }>
    }
    expect(sh).not.toBeNull()
    expect(sh.totalMinutes).toBe(50)      // 按「各机构相加」会得 100（A、B 都含该人）
    expect(sh.totalMinutes).not.toBe(100)
    expect(sh.participantCount).toBe(1)   // 不去重会得 2
    expect(sh.participantCount).not.toBe(2)
    // 分项之和恒等于总时长
    expect(sh.byActivityType.reduce((s, b) => s + b.minutes, 0)).toBe(50)
  })

  // ★ D-7 后：机构聚合按台账 `l.org_id` 求和（不再 JOIN 翻倍）。u_multi 确定性归属 qaOrgA，
  // 故只在 qaOrgA 报表出现；qaOrgB 报表**不含**他（即使他是 qaOrgB 成员）。两报表相加 = 50，与 gov 全局一致。
  it('★ (a) D-7 后：u_multi 仅归属机构（qaOrgA）报表含他（50min,total 1），另一家（qaOrgB）不含（0min,total 0），不再翻倍', async () => {
    const a = (await request(server).get('/api/org/qaOrgA/service-hours').set(auth(userToken('u_a_admin')))).body.data
    const b = (await request(server).get('/api/org/qaOrgB/service-hours').set(auth(userToken('u_b_admin')))).body.data

    // 归属机构 qaOrgA：含 u_multi（50 分钟，机构内去重 1 人）
    expect(a.totalMinutes).toBe(50)
    expect(a.total).toBe(1)
    expect(a.items.map((i: { userId: string }) => i.userId)).toContain('u_multi')
    // 另一家 qaOrgB：u_multi 虽是其成员，但台账归属 qaOrgA ⇒ 不含（0 分钟、0 人）
    expect(b.totalMinutes).toBe(0)
    expect(b.total).toBe(0)
    expect(b.items.map((i: { userId: string }) => i.userId)).not.toContain('u_multi')
    // 两机构报表相加 = 50（无重复），与 gov 全局 50 一致 —— 双端口径统一、不翻倍
    expect(a.totalMinutes + b.totalMinutes).toBe(50)
    // 防"两侧都空 ⇒ 0+0 碰巧成立"：确认归属机构非空
    expect(a.totalMinutes).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// ★★ T42：null 判据双向 + 与 /me 口径一致
// ---------------------------------------------------------------------------
describe('★★ T42 独立验证 · gov `null` 判据 = 「有无台账行」', () => {
  beforeEach(() => { seedTestData() })

  it('★ 无任何计数台账 ⇒ gov 为 null（无数据 ≠ 0）', async () => {
    expect(await govServiceHours()).toBeNull()
  })

  it('★ 仅一条**零时长**（started==ended）已确认行 ⇒ 返回对象（totalMinutes:0），**不是** null', async () => {
    recordService({
      userId: 'user_001', activityType: 'rescue_task', sourceRef: 'qa_zero',
      startedAtMs: BASE, endedAtMs: BASE, now: 1, // 0 分钟
    })
    const sh = (await govServiceHours()) as {
      totalMinutes: number; participantCount: number; byActivityType: Array<unknown>
    }
    expect(sh).not.toBeNull()          // 判据 = 有无行，不是分钟数
    expect(sh.totalMinutes).toBe(0)    // 0 分钟是事实，不得折成 null
    expect(sh.participantCount).toBe(1)
    expect(sh.byActivityType).toEqual([{ activityType: 'rescue_task', minutes: 0, count: 1 }])
  })

  it('★ 两端点口径一致：同一条零时长行 ⇒ /me 与 gov 结论一致（均为对象、totalMinutes=0）', async () => {
    recordService({
      userId: 'user_001', activityType: 'rescue_task', sourceRef: 'qa_zero_me',
      startedAtMs: BASE, endedAtMs: BASE, now: 1,
    })
    // /me：始终返回对象；totalMinutes 0 且 breakdown 有 1 项
    const me = (await request(server).get('/api/volunteer/service-hours/me').set(auth(userToken('user_001')))).body.data
    expect(me.totalMinutes).toBe(0)
    expect(me.breakdown.length).toBe(1)
    expect(me.breakdown[0].minutes).toBe(0)
    expect(me.breakdown[0].count).toBe(1)

    // gov：同一条数据**不得**返回 null（口径统一）
    const sh = (await govServiceHours()) as { totalMinutes: number }
    expect(sh).not.toBeNull()
    expect(sh.totalMinutes).toBe(me.totalMinutes) // 0 === 0
  })

  it('★ /me 冷启动（无台账）仍是对象（totalMinutes 0 / 空 breakdown），与 gov 的 null 不冲突', async () => {
    const me = (await request(server).get('/api/volunteer/service-hours/me').set(auth(userToken('user_001')))).body.data
    expect(me.totalMinutes).toBe(0)
    expect(me.breakdown).toEqual([])
    expect(me.items).toEqual([])
    // gov 侧为 null（"无数据"语义）
    expect(await govServiceHours()).toBeNull()
  })

  it('★ 非计数行（未闭合 pending）不算"有行" ⇒ gov 仍为 null', async () => {
    // endedAtMs 缺省 ⇒ status='pending' ⇒ COUNTING_WHERE 排除
    recordService({
      userId: 'user_001', activityType: 'rescue_task', sourceRef: 'qa_open',
      startedAtMs: BASE, now: 1,
    })
    expect(await govServiceHours()).toBeNull()
  })
})
