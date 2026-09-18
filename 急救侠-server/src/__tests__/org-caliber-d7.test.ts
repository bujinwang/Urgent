/**
 * D-7 · 机构服务时长聚合「不重复」—— 端到端不变量与回填。
 *
 * 覆盖：
 *   1. `resolveUserOrgId` 三态（admin/manager 优先 / 最早加入 / 无机构 ⇒ ''）
 *   2. 写入路径：`closeServiceForUser()` 经 `recordService({ orgId: resolveUserOrgId })` 落库
 *      ⇒ 台账行 `org_id` = 确定性归属机构；无机构 ⇒ ''
 *   3. ★ 核心回归：用户两机构，仅归属机构计入、另一家 totalMinutes=0
 *      （旧 `JOIN organization_members` 实现下两家各 N ⇒ 必红，见文件末突变账）
 *   4. `backfillServiceLogOrgId` 历史回填（确定性机构 / 无机构不变 / changes 数）
 *
 * 设计依据：team-lead D-7 任务单。
 * ⚠️ 每条断言按「把对应实现改坏 ⇒ 精确变红」设计（文件末突变账）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'
import {
  resolveUserOrgId,
  backfillServiceLogOrgId,
  closeServiceForUser,
} from '../services/serviceLog'

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
const BASE = 1_700_000_000_000

function addUser(id: string, name = id): void {
  db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(id, name)
}
function addOrg(id: string, name: string, adminId: string): void {
  db.prepare("INSERT INTO organizations (id, name, type, admin_user_id) VALUES (?, ?, 'company', ?)").run(id, name, adminId)
}
/** 不加时间戳 ⇒ 用默认值（不可控），仅用于「角色/归属」无关的插入。 */
function addMember(orgId: string, userId: string, role: 'admin' | 'manager' | 'member'): void {
  db.prepare('INSERT INTO organization_members (id, org_id, user_id, role) VALUES (?, ?, ?, ?)')
    .run(`om_${orgId}_${userId}`, orgId, userId, role)
}
/** 可控制 `joined_at`（★ 测试「最早加入」分支需要确定性时序）。 */
function addMemberAt(orgId: string, userId: string, role: 'admin' | 'manager' | 'member', joinedAt: string): void {
  db.prepare("INSERT INTO organization_members (id, org_id, user_id, role, joined_at) VALUES (?, ?, ?, ?, ?)")
    .run(`om_${orgId}_${userId}`, orgId, userId, role, joinedAt)
}

/** 直接构造一条「已到达、未闭合」的参与行（= 真实 `/arrive` 落库后的状态，确定性起点）。 */
function insertArrived(userId: string, taskId: string, arrivedAtMs: number): void {
  db.prepare(
    `INSERT INTO task_volunteers (id, task_id, user_id, responded_at_ms, arrived_at_ms, status)
     VALUES (?, ?, ?, ?, ?, 'arrived')`
  ).run(`tv_${userId}_${taskId}`, taskId, userId, arrivedAtMs, arrivedAtMs)
}

/** 真实写入路径（`/complete` 端点的内部调用）：闭合 ⇒ 写台账，带确定性 `org_id`。 */
function completeRescue(userId: string, taskId: string, minutes: number): number {
  return closeServiceForUser({ taskId, userId, endedMs: BASE + minutes * 60000, now: 1 }).closed
}

describe('D-7 · 机构聚合不重复 + org_id 写入 + 回填', () => {
  beforeEach(() => { seedTestData() })

  // ── 1. resolveUserOrgId 三态 ──────────────────────────────────────────────
  describe('resolveUserOrgId 三态', () => {
    it('orgA(member, 早) + orgB(admin) ⇒ 返回 orgB（admin/manager 优先）', () => {
      addUser('u_dup', '双机构'); addUser('ownerA', 'A主'); addUser('ownerB', 'B主')
      addOrg('orgA', '机构A', 'ownerA'); addMember('orgA', 'u_dup', 'member')
      addOrg('orgB', '机构B', 'ownerB'); addMember('orgB', 'u_dup', 'admin')
      expect(resolveUserOrgId('u_dup')).toBe('orgB')
    })

    it('orgA(member, 早) + orgC(member, 晚) ⇒ 返回 orgA（最早加入）', () => {
      addUser('u_early', '早加入'); addUser('ownerA', 'A主'); addUser('ownerC', 'C主')
      addOrg('orgA', '机构A', 'ownerA'); addMemberAt('orgA', 'u_early', 'member', '2024-01-01T00:00:00Z')
      addOrg('orgC', '机构C', 'ownerC'); addMemberAt('orgC', 'u_early', 'member', '2024-06-01T00:00:00Z')
      expect(resolveUserOrgId('u_early')).toBe('orgA')
    })

    it('用户无机构 ⇒ 返回空串', () => {
      addUser('u_lone', '独行侠')
      expect(resolveUserOrgId('u_lone')).toBe('')
    })
  })

  // ── 2. 写入路径：closeServiceForUser ⇒ 台账 org_id ────────────────────────
  describe('写入路径：closed 后台账 org_id = 确定性归属机构', () => {
    it('两机构（一家 admin）完成 rescue_task ⇒ 台账 org_id = 归属机构（orgB）', () => {
      addUser('ownerA', 'A主'); addUser('ownerB', 'B主') // user_001 由 seedTestData 提供
      addOrg('orgA', '机构A', 'ownerA'); addMember('orgA', 'user_001', 'member')
      addOrg('orgB', '机构B', 'ownerB'); addMember('orgB', 'user_001', 'admin')
      insertArrived('user_001', 'task_001', BASE)
      expect(completeRescue('user_001', 'task_001', 60)).toBe(1)

      const row = db.prepare('SELECT * FROM volunteer_service_logs WHERE user_id=? AND source_ref=?')
        .get('user_001', 'task_001') as { org_id: string; duration_min: number }
      expect(row.org_id).toBe('orgB')     // 确定性归属（admin 优先）
      expect(row.duration_min).toBe(60)
    })

    it('用户无机构 ⇒ 台账 org_id = 空串（时长仍进政府全局）', () => {
      addUser('u_lone', '独行侠')
      insertArrived('u_lone', 'task_001', BASE)
      expect(completeRescue('u_lone', 'task_001', 30)).toBe(1)
      const row = db.prepare('SELECT org_id FROM volunteer_service_logs WHERE user_id=? AND source_ref=?')
        .get('u_lone', 'task_001') as { org_id: string }
      expect(row.org_id).toBe('')
    })
  })

  // ── 3. ★ 核心回归：两机构不重复计入 ──────────────────────────────────────
  it('★ 不变量：用户两机构，仅归属机构计入、另一家 totalMinutes=0（旧 JOIN 下两家各 N ⇒ 失败）', async () => {
    // user_001：orgA 普通成员 + orgB 管理员（⇒ 归属 orgB）
    addUser('ownerA', 'A主'); addUser('ownerB', 'B主')
    addOrg('orgA', '机构A', 'ownerA'); addMember('orgA', 'user_001', 'member'); addMember('orgA', 'ownerA', 'admin')
    addOrg('orgB', '机构B', 'ownerB'); addMember('orgB', 'user_001', 'admin')
    insertArrived('user_001', 'task_001', BASE)
    expect(completeRescue('user_001', 'task_001', 60)).toBe(1)

    // 归属机构 orgB（user_001 为 admin，可查看）：计入 60
    const b = await request(server).get('/api/org/orgB/service-hours').set(auth(userToken('user_001')))
    expect(b.status).toBe(200)
    expect(b.body.data.orgId).toBe('orgB')
    expect(b.body.data.totalMinutes).toBe(60)
    expect(b.body.data.total).toBe(1)
    expect(b.body.data.items.map((i: { userId: string }) => i.userId)).toContain('user_001')

    // 另一家 orgA（ownerA 为 admin，可查看）：**不**计入 ⇒ 0
    const a = await request(server).get('/api/org/orgA/service-hours').set(auth(userToken('ownerA')))
    expect(a.status).toBe(200)
    expect(a.body.data.totalMinutes).toBe(0)
    expect(a.body.data.total).toBe(0)
  })

  // ── 4. 历史回填 ──────────────────────────────────────────────────────────
  describe('backfillServiceLogOrgId 历史回填', () => {
    it('org_id 空旧行补确定性机构；无机构用户保持非机构；changes 数正确', () => {
      addUser('u_f1', '回填甲'); addOrg('orgF', '机构F', 'u_f1'); addMember('orgF', 'u_f1', 'member')
      addUser('u_f2', '回填乙') // 无机构

      db.prepare(
        `INSERT INTO volunteer_service_logs
           (id, user_id, activity_type, source_type, source_ref, started_at_ms, ended_at_ms, duration_min, is_drill, status, org_id, created_by, voided_at_ms, void_reason, created_at_ms)
         VALUES (?, ?, 'rescue_task', 'system', ?, ?, ?, ?, 0, 'confirmed', '', '', NULL, '', ?)`
      ).run('vsl_old1', 'u_f1', 'old1', BASE, BASE + 60000, 60, 1)
      db.prepare(
        `INSERT INTO volunteer_service_logs
           (id, user_id, activity_type, source_type, source_ref, started_at_ms, ended_at_ms, duration_min, is_drill, status, org_id, created_by, voided_at_ms, void_reason, created_at_ms)
         VALUES (?, ?, 'rescue_task', 'system', ?, ?, ?, ?, 0, 'confirmed', '', '', NULL, '', ?)`
      ).run('vsl_old2', 'u_f2', 'old2', BASE, BASE + 60000, 60, 1)

      // 两行 `org_id=''` 均被 UPDATE 命中（本 SQLite 构建下 ''→'' 也计入 changes）
      const changes = backfillServiceLogOrgId()
      expect(changes).toBe(2)
      expect((db.prepare('SELECT org_id FROM volunteer_service_logs WHERE id=?').get('vsl_old1') as { org_id: string }).org_id)
        .toBe('orgF')                                   // 有机构 ⇒ 填上
      // 无机构用户：COALESCE 让其 `org_id` **保持 ''**（≠ 任何真实机构；归集合计 `l.org_id = ?` 同样不匹配 ⇒ 不计入任何机构）。
      expect((db.prepare('SELECT org_id FROM volunteer_service_logs WHERE id=?').get('vsl_old2') as { org_id: string }).org_id)
        .toBe('')
    })
  })
})
