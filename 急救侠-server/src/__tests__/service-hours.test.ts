/**
 * F4 · T01 验收测试（★ v1.2 增量）：台账地基 + 任务侧归因 / 到达 / 离开 / 放弃。
 *
 * 设计：`volunteer-service-hours-design.md` §5.1（v1.2 时序）/ §6 T01 / §8（T26–T31）/
 * §11（时长区间 = 「到达 → 离开」，赶路不计入）。
 *
 * ⚠️ 这些用例的价值不在于「跑绿」，而在于**改坏源码必须精确变红**（§8 突变计划）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, clearAll, db } from './setup'
import { computeDurationMin, recordService, getUserHours, MAX_SINGLE_MINUTES } from '../services/serviceLog'
import type { TaskVolunteerRow, VolunteerServiceLogRow } from '../types/rows'

const tokenA = () => userToken('user_001')
const tokenB = () => userToken('user_002')
const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

/** 带 token 接受 task_001。 */
const accept = (t = tokenA()) =>
  request(server).post('/api/task/accept').set(auth(t)).send({ taskId: 'task_001' })

/** 带 token 上报到达。 */
const arrive = (t = tokenA()) =>
  request(server).post('/api/task/arrive').set(auth(t)).send({ taskId: 'task_001' })

/** 带 token 结束服务（离开）。 */
const complete = (t = tokenA(), extra: Record<string, unknown> = {}) =>
  request(server).post('/api/task/complete').set(auth(t)).send({ taskId: 'task_001', ...extra })

/** 带 token 放弃。 */
const abandon = (t = tokenA(), reason?: string) =>
  request(server).post('/api/task/abandon').set(auth(t)).send({ taskId: 'task_001', ...(reason ? { reason } : {}) })

const countOf = (table: string, where = ''): number =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}${where}`).get() as { c: number }).c

/** 第二个用户（B），用于「按人闭合」用例。 */
function addUserB(): void {
  db.prepare("INSERT INTO users (id, name) VALUES ('user_002', '志愿者B')").run()
}

/** 把某用户在该任务的到达/报名时刻回拨，制造可断言的确定时长。 */
function backdate(userId: string, opts: { respondedMin?: number; arrivedMin?: number }): void {
  const now = Date.now()
  if (opts.respondedMin !== undefined) {
    db.prepare('UPDATE task_volunteers SET responded_at_ms = ? WHERE task_id = ? AND user_id = ?')
      .run(now - opts.respondedMin * 60000, 'task_001', userId)
  }
  if (opts.arrivedMin !== undefined) {
    db.prepare('UPDATE task_volunteers SET arrived_at_ms = ? WHERE task_id = ? AND user_id = ?')
      .run(now - opts.arrivedMin * 60000, 'task_001', userId)
  }
}

const tvRow = (userId: string) =>
  db.prepare('SELECT * FROM task_volunteers WHERE task_id = ? AND user_id = ?').get('task_001', userId) as TaskVolunteerRow

describe('F4 T01 · 任务侧归因 / 到达 / 离开 / 放弃（v1.2）', () => {
  beforeEach(() => { seedTestData() })

  // -------------------------------------------------------------------------
  // 归因写路径
  // -------------------------------------------------------------------------

  it('T6：同一用户对同一任务 accept 两次 ⇒ task_volunteers 仅 1 行', async () => {
    await accept()
    await accept()
    expect(countOf('task_volunteers', " WHERE task_id = 'task_001'")).toBe(1)
    expect(tvRow('user_001').status).toBe('responded')
  })

  it('T2：body 传 userId:"victim" 被忽略 ⇒ user_id 恒等于 token 身份', async () => {
    await request(server)
      .post('/api/task/accept').set(auth(tokenA()))
      .send({ taskId: 'task_001', userId: 'victim' })
    expect(tvRow('user_001').user_id).toBe('user_001')
    expect(countOf('task_volunteers', " WHERE user_id = 'victim'")).toBe(0)
  })

  it('T19（后端证据）：带 token accept ⇒ 库中出现该用户的参与行、attributed=true', async () => {
    const res = await accept()
    expect(res.status).toBe(200)
    expect(res.body.data.attributed).toBe(true)
    expect(countOf('task_volunteers', " WHERE user_id = 'user_001' AND task_id = 'task_001'")).toBe(1)
  })

  it('T19（重复 accept）：第二次 attributed=false 且不新增行', async () => {
    expect((await accept()).body.data.attributed).toBe(true)
    expect((await accept()).body.data.attributed).toBe(false)
    expect(countOf('task_volunteers')).toBe(1)
  })

  it('T23：游客（无 token）accept/arrive/complete/abandon ⇒ 无参与行、无台账行，且均返回 200', async () => {
    const ra = await request(server).post('/api/task/accept').send({ taskId: 'task_001' })
    const rr = await request(server).post('/api/task/arrive').send({ taskId: 'task_001' })
    const rc = await request(server).post('/api/task/complete').send({ taskId: 'task_001' })
    const rx = await request(server).post('/api/task/abandon').send({ taskId: 'task_001' })
    for (const r of [ra, rr, rc, rx]) expect(r.status).toBe(200)
    expect(ra.body.data.attributed).toBe(false)
    expect(rr.body.data.arrived).toBe(false)
    expect(rc.body.data.closed).toBe(0)
    expect(rx.body.data.voided).toBe(false)
    expect(countOf('task_volunteers')).toBe(0)
    expect(countOf('volunteer_service_logs')).toBe(0)
  })

  // -------------------------------------------------------------------------
  // ★ v1.2 时长口径：到达 → 离开
  // -------------------------------------------------------------------------

  it('★ T26（主守卫）：时长 = round((ended − arrived)/60000)，与 responded_at_ms 无关', async () => {
    await accept()
    await arrive()
    // 报名回拨 300 分钟、到达回拨 30 分钟：若实现误用 responded ⇒ 会得到 300 而非 30
    backdate('user_001', { respondedMin: 300, arrivedMin: 30 })

    const res = await complete()
    expect(res.body.data.closed).toBe(1)
    expect(res.body.data.minutes).toBe(30)

    const log = db.prepare('SELECT * FROM volunteer_service_logs WHERE user_id = ?').get('user_001') as VolunteerServiceLogRow
    expect(log.duration_min).toBe(30)
    expect(log.status).toBe('confirmed')
    // 台账起点必须等于到达时刻（不是报名时刻）
    expect(log.started_at_ms).toBe(tvRow('user_001').arrived_at_ms)
  })

  it('★ T26：未到场（只 accept、未 arrive）⇒ /complete 无台账、0 分钟', async () => {
    await accept()
    backdate('user_001', { respondedMin: 120 }) // 报名很久，但从未到达
    const res = await complete()
    expect(res.body.data.closed).toBe(0)
    expect(res.body.data.minutes).toBe(0)
    expect(countOf('volunteer_service_logs')).toBe(0)
    expect(tvRow('user_001').ended_at_ms).toBeNull() // 未闭合（不自动作废）
    expect(tvRow('user_001').status).toBe('responded')
  })

  it('T3：时长服务端算，body 传 duration_min:9999 被忽略', async () => {
    await accept()
    await arrive()
    backdate('user_001', { arrivedMin: 90 })
    const res = await complete(tokenA(), { duration_min: 9999, durationMin: 9999 })
    const log = db.prepare('SELECT * FROM volunteer_service_logs WHERE user_id = ?').get('user_001') as VolunteerServiceLogRow
    expect(log.duration_min).toBe(90)
    expect(log.duration_min).not.toBe(9999)
    expect(res.body.data.minutes).toBe(90)
  })

  // -------------------------------------------------------------------------
  // ★ v1.2 到达 / 放弃 / 幂等
  // -------------------------------------------------------------------------

  it('★ T27：/arrive 幂等 —— 重复上报不覆盖 arrived_at_ms', async () => {
    await accept()
    const first = await arrive()
    expect(first.body.data.arrived).toBe(true)
    // 人为把到达时刻改到哨兵值；第二次 arrive 不得覆盖它
    db.prepare('UPDATE task_volunteers SET arrived_at_ms = ? WHERE task_id = ? AND user_id = ?')
      .run(111111, 'task_001', 'user_001')
    const second = await arrive()
    expect(second.body.data.arrived).toBe(false)
    expect(tvRow('user_001').arrived_at_ms).toBe(111111)
    expect(tvRow('user_001').status).toBe('arrived')
  })

  it('★ T28：/abandon ⇒ void_reason 留痕 + voided_at_ms 非空 + 无台账（0 分钟）', async () => {
    await accept()
    const res = await abandon(tokenA(), '路程过远')
    expect(res.body.data.voided).toBe(true)
    const row = tvRow('user_001')
    expect(row.status).toBe('voided')
    expect(row.void_reason).toBe('路程过远')
    expect(row.voided_at_ms).toBeGreaterThan(0)
    expect(countOf('volunteer_service_logs')).toBe(0) // 绝不写台账
  })

  it('★ T28（反向）：/abandon 后再 /complete 也不得入账', async () => {
    await accept()
    await arrive()
    await abandon(tokenA())
    const res = await complete()
    expect(res.body.data.closed).toBe(0)
    expect(countOf('volunteer_service_logs')).toBe(0)
  })

  it('★ T29：按人闭合 —— A 到达、B 仅报名；A /complete ⇒ 仅 A 入账，B 无台账（堵搭便车）', async () => {
    addUserB()
    await accept(tokenA())
    await accept(tokenB())
    await arrive(tokenA()) // 只有 A 到达
    backdate('user_001', { arrivedMin: 20 })

    const res = await complete(tokenA())
    expect(res.body.data.closed).toBe(1)
    expect(res.body.data.minutes).toBe(20)

    // A 入账
    expect(countOf('volunteer_service_logs', " WHERE user_id = 'user_001'")).toBe(1)
    // B 完全不受 A 的动作影响
    expect(countOf('volunteer_service_logs', " WHERE user_id = 'user_002'")).toBe(0)
    const b = tvRow('user_002')
    expect(b.arrived_at_ms).toBeNull()
    expect(b.ended_at_ms).toBeNull()
    expect(b.status).toBe('responded')
  })

  it('★ T29b：按人闭合的**隔离守卫** —— A、B 都到达；A /complete ⇒ 仅 A 闭合，B 保持 arrived、无台账', async () => {
    // 与 T29 的区别：T29 里 B「仅报名」是被 `arrived_at_ms IS NULL ⇒ no-op` 挡住的；
    // 本用例让 B **也到达**，从而**只**由 `WHERE user_id = ?`（按人）这一机制挡住 B ——
    // 这样「后人误删 user_id 过滤」这个缺陷才会被测出来（否则 T29 全绿而 bug 真实存在）。
    addUserB()
    await accept(tokenA())
    await accept(tokenB())
    await arrive(tokenA())
    await arrive(tokenB())
    backdate('user_001', { arrivedMin: 20 })
    backdate('user_002', { arrivedMin: 15 })

    const res = await complete(tokenA())
    expect(res.body.data.closed).toBe(1)
    expect(res.body.data.minutes).toBe(20)

    // A：已闭合 + 已入账
    const a = tvRow('user_001')
    expect(a.ended_at_ms).toBeGreaterThan(0)
    expect(a.status).toBe('left')
    expect(countOf('volunteer_service_logs', " WHERE user_id = 'user_001'")).toBe(1)

    // ★ B：必须**完全**不受 A 的动作影响 —— 仍 arrived、仍未闭合、无台账
    const b = tvRow('user_002')
    expect(b.ended_at_ms).toBeNull()
    expect(b.status).toBe('arrived')
    expect(countOf('volunteer_service_logs', " WHERE user_id = 'user_002'")).toBe(0)
  })

  it('★ T31：按人闭合幂等 —— 同一人 /complete 两次 ⇒ ended 不被覆盖、时长不翻倍', async () => {
    await accept()
    await arrive()
    backdate('user_001', { arrivedMin: 30 })

    const first = await complete()
    expect(first.body.data.closed).toBe(1)
    expect(first.body.data.minutes).toBe(30)
    const row1 = tvRow('user_001')
    expect(row1.ended_at_ms).toBeGreaterThan(0)
    expect(row1.status).toBe('left')
    const sumBefore = (db.prepare('SELECT COALESCE(SUM(duration_min),0) AS s FROM volunteer_service_logs').get() as { s: number }).s

    const second = await complete()
    expect(second.body.data.closed).toBe(0)
    expect(second.body.data.minutes).toBe(0)
    expect(tvRow('user_001').ended_at_ms).toBe(row1.ended_at_ms) // 未被覆盖
    expect(countOf('task_volunteers')).toBe(1)
    expect(countOf('volunteer_service_logs')).toBe(1)
    const sumAfter = (db.prepare('SELECT COALESCE(SUM(duration_min),0) AS s FROM volunteer_service_logs').get() as { s: number }).s
    expect(sumAfter).toBe(sumBefore)
    expect(sumAfter).toBe(30)
  })

  it('T24：volunteers_responded 的既有「非幂等」行为被固定', async () => {
    // ⚠️ KNOWN-BUG / 行为固定型用例（设计 §10-Q2 / D-3）：
    // `/accept` 的 `volunteers_responded = volunteers_responded + 1` **本就非幂等** ——
    // 重复 accept 会反复 +1，**不是可靠真值**。本用例**刻意断言当前（错误）行为**，
    // 目的是**防止后人误以为它可靠**、或把「把它改成幂等重算」当成无痛重构。
    // 若日后要修它（需另开工单，属行为变更）：**必须同步把这里的期望改成幂等后的值**。
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
    await arrive()
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
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: 'r1', startedAtMs: base, endedAtMs: base + 30 * 60_000, now: 1 })
    recordService({ userId: 'user_001', activityType: 'drill', sourceRef: 'r1b', startedAtMs: base, endedAtMs: base + 45 * 60_000, now: 1 })
    recordService({ userId: 'user_001', activityType: 'manual', sourceRef: 'm1', startedAtMs: base, endedAtMs: base + 10 * 60_000, status: 'pending', now: 1 })
    recordService({ userId: 'user_001', activityType: 'drill', sourceRef: 'd1', startedAtMs: base, endedAtMs: base + 20 * 60_000, isDrill: true, now: 1 })
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: 'r2', startedAtMs: base, endedAtMs: null, now: 1 })

    const view = getUserHours('user_001')
    expect(view.totalMinutes).toBe(75)
    const sum = view.breakdown.reduce((s, b) => s + b.minutes, 0)
    expect(sum).toBe(view.totalMinutes) // 分项之和恒等于总时长（T5）
    expect(view.breakdown).toHaveLength(2) // rescue_task + drill（数据驱动，不写死）
    expect(view.items.every((i) => i.endedAtMs != null && !i.isDrill)).toBe(true)
  })
})
