/**
 * F4 · T01 验收测试：台账地基 + 任务侧归因 / 闭合 / 入账。
 *
 * 设计：`volunteer-service-hours-design.md` §5.1（时序）/ §6 T01 / §8（测试与突变计划）。
 * 每条用例对应一个编号（T6/T18/T3/T2/T19/T23/T24/T12/T17/T5…），编号即设计中的不变量锚点。
 *
 * ⚠️ 这些用例的价值不在于「跑绿」，而在于**改坏源码必须精确变红**（§8 突变计划）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, clearAll, db } from './setup'
import { computeDurationMin, recordService, getUserHours, MAX_SINGLE_MINUTES } from '../services/serviceLog'
import type { TaskVolunteerRow, VolunteerServiceLogRow } from '../types/rows'

const token = () => userToken('user_001')

/** 带 token 接受 task_001。 */
const accept = (t = token()) =>
  request(server).post('/api/task/accept').set('Authorization', `Bearer ${t}`).send({ taskId: 'task_001' })

/** 带 token 完成 task_001（可附加额外 body 字段，用于验证其被忽略）。 */
const complete = (extra: Record<string, unknown> = {}) =>
  request(server)
    .post('/api/task/complete')
    .set('Authorization', `Bearer ${token()}`)
    .send({ taskId: 'task_001', ...extra })

const countOf = (table: string, where = ''): number =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}${where}`).get() as { c: number }).c

describe('F4 T01 · 任务侧归因与闭合', () => {
  beforeEach(() => { seedTestData() })

  // -------------------------------------------------------------------------
  // 归因写路径
  // -------------------------------------------------------------------------

  it('T6：同一用户对同一任务 accept 两次 ⇒ task_volunteers 仅 1 行', async () => {
    await accept()
    await accept()
    const rows = db.prepare('SELECT * FROM task_volunteers WHERE task_id = ?').all('task_001') as TaskVolunteerRow[]
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe('user_001')
    expect(rows[0].status).toBe('responded')
  })

  it('T2：body 传 userId:"victim" 被忽略 ⇒ user_id 恒等于 token 身份', async () => {
    await request(server)
      .post('/api/task/accept')
      .set('Authorization', `Bearer ${token()}`)
      .send({ taskId: 'task_001', userId: 'victim' })
    const row = db.prepare('SELECT user_id FROM task_volunteers WHERE task_id = ?').get('task_001') as { user_id: string }
    expect(row.user_id).toBe('user_001')
    expect(row.user_id).not.toBe('victim')
  })

  it('T19（后端证据）：带 token accept ⇒ 库中出现该用户的参与行、attributed=true', async () => {
    const res = await accept()
    expect(res.status).toBe(200)
    expect(res.body.data.attributed).toBe(true)
    expect(countOf('task_volunteers', " WHERE user_id = 'user_001' AND task_id = 'task_001'")).toBe(1)
  })

  it('T19（重复 accept）：第二次 attributed=false 且不新增行', async () => {
    const first = await accept()
    const second = await accept()
    expect(first.body.data.attributed).toBe(true)
    expect(second.body.data.attributed).toBe(false)
    expect(countOf('task_volunteers')).toBe(1)
  })

  it('T23：游客（无 token）accept/complete ⇒ 无参与行、无台账行，且返回 200（非 401）', async () => {
    const a = await request(server).post('/api/task/accept').send({ taskId: 'task_001' })
    const c = await request(server).post('/api/task/complete').send({ taskId: 'task_001' })
    expect(a.status).toBe(200)
    expect(c.status).toBe(200)
    expect(a.body.data.attributed).toBe(false)
    expect(c.body.data.closed).toBe(0)
    expect(countOf('task_volunteers')).toBe(0)
    expect(countOf('volunteer_service_logs')).toBe(0)
  })

  // -------------------------------------------------------------------------
  // 闭合 + 入账（幂等）
  // -------------------------------------------------------------------------

  it('T3：时长服务端算，body 传 duration_min:9999 被忽略', async () => {
    await accept()
    // 把接受时刻回拨 90 分钟，使「服务端算」得到可断言的非零时长
    db.prepare('UPDATE task_volunteers SET responded_at_ms = ? WHERE task_id = ?').run(Date.now() - 90 * 60000, 'task_001')

    const res = await complete({ duration_min: 9999, durationMin: 9999 })
    const log = db.prepare('SELECT * FROM volunteer_service_logs WHERE user_id = ?').get('user_001') as VolunteerServiceLogRow
    expect(log.duration_min).toBe(90)
    expect(log.duration_min).not.toBe(9999)
    expect(res.body.data.minutes).toBe(90)
  })

  it('T18：/complete 幂等 —— 重复调用仍 1 行、ended_at_ms 不被覆盖、时长不翻倍', async () => {
    await accept()
    db.prepare('UPDATE task_volunteers SET responded_at_ms = ? WHERE task_id = ?').run(Date.now() - 30 * 60000, 'task_001')

    const first = await complete()
    expect(first.body.data.closed).toBe(1)
    expect(first.body.data.minutes).toBe(30)

    const row1 = db.prepare('SELECT ended_at_ms, status FROM task_volunteers WHERE task_id = ?').get('task_001') as TaskVolunteerRow
    expect(row1.ended_at_ms).toBeGreaterThan(0)
    expect(row1.status).toBe('closed')
    const logsBefore = countOf('volunteer_service_logs')
    const sumBefore = (db.prepare('SELECT COALESCE(SUM(duration_min),0) AS s FROM volunteer_service_logs').get() as { s: number }).s

    const second = await complete()
    expect(second.body.data.closed).toBe(0)
    expect(second.body.data.minutes).toBe(0)

    const row2 = db.prepare('SELECT ended_at_ms FROM task_volunteers WHERE task_id = ?').get('task_001') as { ended_at_ms: number }
    expect(row2.ended_at_ms).toBe(row1.ended_at_ms)          // 未被第二次覆盖
    expect(countOf('task_volunteers')).toBe(1)               // 仍 1 行
    expect(countOf('volunteer_service_logs')).toBe(logsBefore) // 不新增台账行
    const sumAfter = (db.prepare('SELECT COALESCE(SUM(duration_min),0) AS s FROM volunteer_service_logs').get() as { s: number }).s
    expect(sumAfter).toBe(sumBefore)                         // 时长不翻倍
    expect(sumAfter).toBe(30)
  })

  it('T24：volunteers_responded 的既有「非幂等」行为被固定', async () => {
    // ⚠️ KNOWN-BUG / 行为固定型用例（设计 §10-Q2 / D-3）：
    // `/accept` 的 `volunteers_responded = volunteers_responded + 1` **本就非幂等** ——
    // 重复 accept 会反复 +1，**不是可靠真值**。本用例**刻意断言当前（错误）行为**，
    // 目的是**防止后人误以为它可靠**、或把「把它改成幂等重算」当成无痛重构。
    // 若日后要修它（需另开工单，属行为变更）：**必须同步把这里的期望改成幂等后的值**（3→+1 次）。
    const before = (db.prepare('SELECT volunteers_responded AS v FROM tasks WHERE id = ?').get('task_001') as { v: number }).v
    await accept()
    await accept()
    const after = (db.prepare('SELECT volunteers_responded AS v FROM tasks WHERE id = ?').get('task_001') as { v: number }).v
    expect(after).toBe(before + 2) // KNOWN-BUG：两次 accept ⇒ +2（非幂等）
  })

  // -------------------------------------------------------------------------
  // schema / 隔离
  // -------------------------------------------------------------------------

  it('T12：3 张新表均无任何位置列', () => {
    const tables = ['volunteer_service_logs', 'service_certificates', 'task_volunteers']
    const forbidden = ['lat', 'lng', 'location', 'address', 'latitude', 'longitude', 'geo', 'coords']
    for (const t of tables) {
      const cols = (db.prepare(`PRAGMA table_info(${t})`).all() as Array<{ name: string }>).map((c) => c.name)
      expect(cols.length, `${t} 应有列`).toBeGreaterThan(0)
      for (const f of forbidden) {
        expect(cols, `${t} 不得含位置列 ${f}`).not.toContain(f)
      }
    }
  })

  it('T17：clearAll() 后 3 张新表为空', async () => {
    await accept()
    await complete()
    db.prepare(
      `INSERT INTO service_certificates (id, user_id, cert_no, period_from_ms, period_to_ms, total_minutes, issued_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('sc_test_1', 'user_001', 'VS-TEST-1', 0, 1, 0, Date.now())
    expect(countOf('volunteer_service_logs')).toBe(1)
    expect(countOf('service_certificates')).toBe(1)
    expect(countOf('task_volunteers')).toBe(1)

    clearAll()

    expect(countOf('volunteer_service_logs')).toBe(0)
    expect(countOf('service_certificates')).toBe(0)
    expect(countOf('task_volunteers')).toBe(0)
  })

  // -------------------------------------------------------------------------
  // 权威 helper 单测（T02/T05 复用面）
  // -------------------------------------------------------------------------

  it('computeDurationMin：未闭合 ⇒ null；取整；时钟回拨归零', () => {
    expect(computeDurationMin(1_000_000, null)).toBeNull()
    expect(computeDurationMin(0, 60_000)).toBe(1)
    expect(computeDurationMin(0, 90_000)).toBe(2) // round(1.5) = 2
    expect(computeDurationMin(60_000, 0)).toBe(0) // 时钟回拨 ⇒ 0
  })

  it('recordService：超单次封顶 ⇒ duration_min=480 且 status=pending（Q5/D2）', () => {
    const res = recordService({
      userId: 'user_001',
      activityType: 'manual',
      startedAtMs: 0,
      endedAtMs: 600 * 60_000, // 600 分钟
      now: 1,
    })
    expect(res.durationMin).toBe(MAX_SINGLE_MINUTES)
    expect(res.status).toBe('pending')
  })

  it('recordService + getUserHours：分项之和恒等于总时长，且 pending/is_drill/未闭合均不计入（T4/T5/T7/T8 聚合口径）', () => {
    const base = 1_000_000
    // 计入：两条 rescue_task（30 + 45 = 75）
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: 'r1', startedAtMs: base, endedAtMs: base + 30 * 60_000, now: 1 })
    recordService({ userId: 'user_001', activityType: 'drill', sourceRef: 'r1b', startedAtMs: base, endedAtMs: base + 45 * 60_000, now: 1 })
    // 不计入：pending（人工待确认）
    recordService({ userId: 'user_001', activityType: 'manual', sourceRef: 'm1', startedAtMs: base, endedAtMs: base + 10 * 60_000, status: 'pending', now: 1 })
    // 不计入：演习污染
    recordService({ userId: 'user_001', activityType: 'drill', sourceRef: 'd1', startedAtMs: base, endedAtMs: base + 20 * 60_000, isDrill: true, now: 1 })
    // 不计入：未闭合
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: 'r2', startedAtMs: base, endedAtMs: null, now: 1 })

    const view = getUserHours('user_001')
    expect(view.totalMinutes).toBe(75)
    const sum = view.breakdown.reduce((s, b) => s + b.minutes, 0)
    expect(sum).toBe(view.totalMinutes) // 分项之和恒等于总时长（T5）
    expect(view.breakdown).toHaveLength(2) // rescue_task + drill（数据驱动，不写死）
    expect(view.items.every((i) => i.endedAtMs != null && !i.isDrill)).toBe(true)
  })
})
