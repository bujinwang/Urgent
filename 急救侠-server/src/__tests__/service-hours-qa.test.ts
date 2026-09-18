/**
 * F4 · T01 ★ **独立对抗性验证**（QA 独立文件 —— 刻意**不改**实现方的 `service-hours.test.ts`）。
 *
 * 目标：不复跑实现方已覆盖的组合，而是**另起攻击面**（身份伪造扩散、按人隔离、跨任务串扰、
 * 封顶端到端、错误路径、重复放弃、游客加强）。设计依据：`volunteer-service-hours-design.md`
 * §4.3 / §5.1 / §8（T26–T31）/ §11。
 *
 * ⚠️ 每条断言都按「把对应源码改坏，它必须精确变红」设计（见文件末 MONTH 突变账）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'
import { MAX_SINGLE_MINUTES, getUserHours } from '../services/serviceLog'
import type { TaskVolunteerRow, VolunteerServiceLogRow } from '../types/rows'

const TASK = 'task_001'
const TASK2 = 'task_002'
const tokenA = () => userToken('user_001')
const tokenB = () => userToken('user_002')
const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

type Body = Record<string, unknown>

/** 通用 POST。`token` 为假值（undefined/''）⇒ 不带 Authorization（游客）。 */
const hit = (path: string, token: string | undefined, body: Body = {}) => {
  let r = request(server).post(path)
  if (token) r = r.set(auth(token))
  return r.send({ taskId: TASK, ...body })
}

const accept = (token: string | undefined = tokenA(), body: Body = {}) =>
  hit('/api/task/accept', token, body)
const arrive = (token: string | undefined = tokenA(), body: Body = {}) =>
  hit('/api/task/arrive', token, body)
const complete = (token: string | undefined = tokenA(), body: Body = {}) =>
  hit('/api/task/complete', token, body)
const abandon = (token: string | undefined = tokenA(), body: Body = {}) =>
  hit('/api/task/abandon', token, body)

const count = (table: string, where = ''): number =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}${where}`).get() as { c: number }).c

const tv = (userId: string, taskId = TASK): TaskVolunteerRow =>
  db.prepare('SELECT * FROM task_volunteers WHERE task_id = ? AND user_id = ?').get(taskId, userId) as TaskVolunteerRow

/** 某人在某任务下的台账行（`source_ref` 即 taskId）。 */
const logs = (userId: string, taskId = TASK): VolunteerServiceLogRow[] =>
  db.prepare('SELECT * FROM volunteer_service_logs WHERE user_id = ? AND source_ref = ?').all(userId, taskId) as VolunteerServiceLogRow[]

const addUserB = (): void => {
  db.prepare("INSERT INTO users (id, name) VALUES ('user_002', '志愿者B')").run()
}

const addTask2 = (): void => {
  db.prepare(
    `INSERT INTO tasks (id, type, address, distance, lat, lng, volunteers_needed, volunteers_responded, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(TASK2, 'cpr', '测试任务2', 100, 22.5, 113.9, 3, 0, 'active', new Date().toISOString())
}

const setArrived = (userId: string, ms: number, taskId = TASK): void => {
  db.prepare('UPDATE task_volunteers SET arrived_at_ms = ? WHERE task_id = ? AND user_id = ?').run(ms, taskId, userId)
}

describe('F4 T01 · 独立对抗性验证（v1.2）', () => {
  beforeEach(() => { seedTestData() })

  // =========================================================================
  // 1. 身份伪造扩散：T2 只覆盖了 /accept —— arrive/complete/abandon 必须同样忽略 body.userId
  // =========================================================================
  it('QA-1a：/arrive body 传 userId:"victim" ⇒ 到达记在 token 主体名下，victim 零行', async () => {
    await accept(tokenA())
    const res = await arrive(tokenA(), { userId: 'victim' })
    expect(res.status).toBe(200)
    expect(tv('user_001').arrived_at_ms).toBeGreaterThan(0)
    expect(tv('user_001').status).toBe('arrived')
    expect(count('task_volunteers', " WHERE user_id = 'victim'")).toBe(0)
  })

  it('QA-1b：/complete body 传 userId:"victim" ⇒ 台账记在 token 主体，victim 零台账', async () => {
    await accept(tokenA())
    await arrive(tokenA())
    setArrived('user_001', Date.now() - 25 * 60000)
    const res = await complete(tokenA(), { userId: 'victim' })
    expect(res.body.data.closed).toBe(1)
    expect(logs('user_001').length).toBe(1)
    expect(logs('victim').length).toBe(0)
    expect(count('volunteer_service_logs', " WHERE user_id = 'victim'")).toBe(0)
  })

  it('QA-1c：/abandon body 传 userId:"victim" ⇒ 作废记在 token 主体，victim 零行', async () => {
    await accept(tokenA())
    const res = await abandon(tokenA(), { userId: 'victim', reason: '路程过远' })
    expect(res.body.data.voided).toBe(true)
    expect(tv('user_001').status).toBe('voided')
    expect(tv('user_001').void_reason).toBe('路程过远')
    expect(count('task_volunteers', " WHERE user_id = 'victim'")).toBe(0)
  })

  // =========================================================================
  // 2. ★ 按人闭合隔离（A、B **都到达**）—— 只由 `WHERE user_id = ?` 挡住，不由到达判定挡住
  // =========================================================================
  it('QA-2：A、B 都到达；A /complete ⇒ 仅 A 闭合入账，B 保持 arrived / ended NULL / 零台账', async () => {
    addUserB()
    await accept(tokenA())
    await accept(tokenB())
    await arrive(tokenA())
    await arrive(tokenB())
    setArrived('user_001', Date.now() - 20 * 60000)
    setArrived('user_002', Date.now() - 15 * 60000)
    const bArrivedBefore = tv('user_002').arrived_at_ms

    const res = await complete(tokenA())
    expect(res.body.data.closed).toBe(1)
    expect(res.body.data.minutes).toBe(20)

    // A：已闭合 + 已入账
    expect(tv('user_001').status).toBe('left')
    expect(tv('user_001').ended_at_ms).toBeGreaterThan(0)
    expect(logs('user_001').length).toBe(1)

    // ★ B：完全不受 A 的动作影响（这条靠 `user_id` 守卫；删掉它必红）
    const b = tv('user_002')
    expect(b.ended_at_ms).toBeNull()
    expect(b.status).toBe('arrived')
    expect(b.arrived_at_ms).toBe(bArrivedBefore)
    expect(logs('user_002').length).toBe(0)
    expect(count('task_volunteers')).toBe(2)
  })

  it('QA-2b：A、B 都到达；A /abandon ⇒ 仅 A 作废，B 仍 arrived 且双方零台账（放弃也按人）', async () => {
    addUserB()
    await accept(tokenA())
    await accept(tokenB())
    await arrive(tokenA())
    await arrive(tokenB())
    const res = await abandon(tokenA(), { reason: '半路退出' })
    expect(res.body.data.voided).toBe(true)
    expect(tv('user_001').status).toBe('voided')
    expect(tv('user_002').status).toBe('arrived')
    expect(tv('user_002').void_reason).toBe('')
    expect(logs('user_001').length).toBe(0)
    expect(logs('user_002').length).toBe(0)
  })

  // =========================================================================
  // 3. 跨任务串扰：任务 X 上的动作不得影响任务 Y
  // =========================================================================
  it('QA-3：对 task_001 的 /complete 不得影响 task_002 的参与行与台账', async () => {
    addTask2()
    await accept(tokenA(), { taskId: TASK })
    await accept(tokenA(), { taskId: TASK2 })
    await arrive(tokenA(), { taskId: TASK })
    await arrive(tokenA(), { taskId: TASK2 })
    setArrived('user_001', Date.now() - 30 * 60000, TASK)

    const res = await complete(tokenA(), { taskId: TASK })
    expect(res.body.data.closed).toBe(1)

    expect(logs('user_001', TASK).length).toBe(1)
    expect(logs('user_001', TASK2).length).toBe(0)
    const other = tv('user_001', TASK2)
    expect(other.ended_at_ms).toBeNull()
    expect(other.status).toBe('arrived')
  })

  // =========================================================================
  // 4. 封顶端到端（单元测试覆盖了 recordService，但**路由路径**未覆盖）
  // =========================================================================
  it('QA-4：单次 >480 分钟 ⇒ /complete 落 duration_min=480 且 status=pending，且不计入聚合', async () => {
    await accept(tokenA())
    await arrive(tokenA())
    setArrived('user_001', Date.now() - 600 * 60000) // 到达回拨 600 分钟

    const res = await complete(tokenA())
    expect(res.body.data.minutes).toBe(MAX_SINGLE_MINUTES)

    const log = logs('user_001')[0]
    expect(log.duration_min).toBe(480)
    expect(log.status).toBe('pending')
    // pending 不进聚合（COUNTING_WHERE）
    expect(getUserHours('user_001').totalMinutes).toBe(0)
  })

  // =========================================================================
  // 5. 错误路径
  // =========================================================================
  it('QA-5a：未知 taskId ⇒ 四端点均 200 且零行（不得因外键违约抛 500）', async () => {
    const ghost = { taskId: 'no_such_task' }
    const ra = await accept(tokenA(), ghost)
    const rr = await arrive(tokenA(), ghost)
    const rc = await complete(tokenA(), ghost)
    const rx = await abandon(tokenA(), ghost)

    for (const r of [ra, rr, rc, rx]) expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(ra.body.data.attributed).toBe(false)
    expect(rr.body.data.arrived).toBe(false)
    expect(rc.body.data.closed).toBe(0)
    expect(rx.body.data.voided).toBe(false)
    expect(count('task_volunteers')).toBe(0)
    expect(count('volunteer_service_logs')).toBe(0)
  })

  it('QA-5b：未报名即调 /arrive、/complete ⇒ no-op 且 200，不写任何行', async () => {
    const rr = await arrive(tokenA())
    const rc = await complete(tokenA())
    expect(rr.status).toBe(200)
    expect(rr.body.data.arrived).toBe(false)
    expect(rc.status).toBe(200)
    expect(rc.body.data.closed).toBe(0)
    expect(count('task_volunteers')).toBe(0)
    expect(count('volunteer_service_logs')).toBe(0)
  })

  it('QA-5c：时钟回拨（ended < arrived）⇒ 归零、不抛异常、仍 200', async () => {
    await accept(tokenA())
    await arrive(tokenA())
    setArrived('user_001', Date.now() + 10 * 60000) // 到达时刻在未来
    const res = await complete(tokenA())
    expect(res.status).toBe(200)
    expect(res.body.data.minutes).toBe(0)
    expect(logs('user_001')[0].duration_min).toBe(0)
  })

  // =========================================================================
  // 6. 重复 /abandon 幂等（实现方只覆盖了单次 abandon）
  // =========================================================================
  it('QA-6：重复 /abandon ⇒ 第二次 voided=false，留痕不被覆盖、零台账', async () => {
    await accept(tokenA())
    const first = await abandon(tokenA(), { reason: '第一次' })
    expect(first.body.data.voided).toBe(true)
    const before = tv('user_001')

    const second = await abandon(tokenA(), { reason: '第二次' })
    expect(second.body.data.voided).toBe(false)
    const after = tv('user_001')
    expect(after.status).toBe('voided')
    expect(after.void_reason).toBe('第一次')
    expect(after.voided_at_ms).toBe(before.voided_at_ms)
    expect(logs('user_001').length).toBe(0)
  })

  // =========================================================================
  // 7. 游客加强：无 token + 非法 token 都必须 200 且零记录
  // =========================================================================
  it('QA-7：游客 / 非法 token ⇒ 四端点均 200 且零记录', async () => {
    // ⚠️ 直接走 `hit`，避免包装函数对 `undefined` 触发默认参数（那样就不是游客了）。
    for (const t of [undefined, 'not-a-jwt', ''] as const) {
      const ra = await hit('/api/task/accept', t)
      const rr = await hit('/api/task/arrive', t)
      const rc = await hit('/api/task/complete', t)
      const rx = await hit('/api/task/abandon', t)
      for (const r of [ra, rr, rc, rx]) {
        expect(r.status, `token=${String(t)} status=${r.status}`).toBe(200)
      }
    }
    expect(count('task_volunteers')).toBe(0)
    expect(count('volunteer_service_logs')).toBe(0)
  })

  // =========================================================================
  // 8. 到达幂等（QA 独立版本，供突变自证）
  // =========================================================================
  it('QA-8：重复 /arrive 不覆盖 arrived_at_ms、状态保持 arrived', async () => {
    await accept(tokenA())
    await arrive(tokenA())
    setArrived('user_001', 424242)
    const again = await arrive(tokenA())
    expect(again.body.data.arrived).toBe(false)
    expect(tv('user_001').arrived_at_ms).toBe(424242)
    expect(tv('user_001').status).toBe('arrived')
  })

  // =========================================================================
  // 9. ★ 主守卫（T26 的**反向判别式**独立版）：时长起点只能是 arrived，不能取 responded
  //    夹具刻意做成"arrived 远早于 responded"（现实中不可能，纯判别用）：
  //    · 取 arrived  ⇒ ≈400
  //    · 取 responded⇒ ≈5
  //    · 取"较晚者"  ⇒ ≈5
  //    ⇒ 任何一种"取错起点"的实现都会落到 5，必被本用例咬住。
  // =========================================================================
  it('QA-9：时长起点恒为 arrived ⇒ 反向判别式（arrived 远早于 responded 时仍取 arrived）', async () => {
    await accept(tokenA())
    await arrive(tokenA())
    const now = Date.now()
    db.prepare('UPDATE task_volunteers SET responded_at_ms = ?, arrived_at_ms = ? WHERE task_id = ? AND user_id = ?')
      .run(now - 5 * 60000, now - 400 * 60000, TASK, 'user_001')

    const res = await complete(tokenA())
    expect(res.body.data.minutes).toBe(400)
    expect(res.body.data.minutes).not.toBe(5)

    const log = logs('user_001')[0]
    expect(log.started_at_ms).toBe(tv('user_001').arrived_at_ms)
    expect(log.duration_min).toBe(400)
  })

  // =========================================================================
  // 10. ★ 「到达后永不闭合」边界（§11.6）：已到达但从不 /complete ⇒ 恒不计入聚合
  //     （实现方只覆盖了"未到场"，没覆盖"已到场但未闭合"这条路）
  // =========================================================================
  it('QA-10：已到达但从不 /complete ⇒ 参与行 arrived/未闭合，零台账、聚合为 0', async () => {
    await accept(tokenA())
    await arrive(tokenA())
    setArrived('user_001', Date.now() - 120 * 60000)

    // 从不调用 /complete
    expect(getUserHours('user_001').totalMinutes).toBe(0)
    expect(count('volunteer_service_logs')).toBe(0)
    const row = tv('user_001')
    expect(row.status).toBe('arrived')
    expect(row.ended_at_ms).toBeNull()
  })

  // =========================================================================
  // 11. ★ 未到场（只 accept、从不 arrive）⇒ /complete 恒 no-op：零台账、
  //     且**不自动作废**（参与行保持 responded、未闭合）。独立于实现方 T26 的版本。
  // =========================================================================
  it('QA-11：只 accept 未 arrive ⇒ /complete 无台账、不闭合、不自动作废', async () => {
    await accept(tokenA())
    db.prepare('UPDATE task_volunteers SET responded_at_ms = ? WHERE task_id = ? AND user_id = ?')
      .run(Date.now() - 200 * 60000, TASK, 'user_001') // 报名很久，但从未到达

    const res = await complete(tokenA())
    expect(res.body.data.closed).toBe(0)
    expect(res.body.data.minutes).toBe(0)
    expect(count('volunteer_service_logs')).toBe(0)

    const row = tv('user_001')
    expect(row.arrived_at_ms).toBeNull()
    expect(row.ended_at_ms).toBeNull()
    expect(row.status).toBe('responded')
    expect(row.void_reason).toBe('')
  })
})
