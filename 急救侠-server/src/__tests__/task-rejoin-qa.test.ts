/**
 * F4 · T06（★ v1.4）**独立对抗性验证** —— 「放弃后反悔、重新参与同一任务」。
 *
 * 刻意**不复用**实现方的 `task-rejoin.test.ts`（那 6 例由实现方自测），本文件另起攻击面：
 *   R1 T36 主守卫的**反事实夹具**（首段到达 10 小时前 ⇒ 取旧到达会得 600/封顶 480，取本次得 0）
 *   R2 T38 `left` 终局（/accept、/abandon 双 no-op）
 *   R3 T39 循环去重（5 轮 ⇒ rejoin_count 精确 =5、台账恰 1 条、minutes=最后一段）
 *   R4 T40 **端到端**入口可达（不止 DB 字段：`/api/task/active` 仍返回该任务）
 *   R5 T37 审计痕迹「最近一次」语义 + rejoin **不改**痕迹
 *   R6 `attributed`/`rejoined` 四输入契约一致性
 *   R7 游客**隔离**：真实用户 voided 后，游客 /accept 不得反悔其行
 *   R8 ★ 补 QA-13 改向后的覆盖缺口：**未反悔的** voided 行 ⇒ /arrive no-op（此前从未被隔离覆盖）
 *   R9 `status=responded ∧ voided_at_ms NOT NULL` 组合读语义无歧义
 *
 * 设计依据：`volunteer-service-hours-design.md` §11.11 + §8（T36–T40）。
 * ⚠️ 每条断言均按「把对应源码改坏，它必须**精确**变红」设计（见文件末突变账）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'
import type { TaskVolunteerRow, VolunteerServiceLogRow } from '../types/rows'

const TASK = 'task_001'
const tokenA = () => userToken('user_001')

type Body = Record<string, unknown>

/** 通用 POST。`token` 为假值（undefined/''）⇒ 不带 Authorization（游客）。 */
const hit = (path: string, token: string | undefined, body: Body = {}) => {
  let r = request(server).post(path)
  if (token) r = r.set({ Authorization: `Bearer ${token}` })
  return r.send({ taskId: TASK, ...body })
}

// 约定：第 1 参 = body，第 2 参 = token（默认 user_001）。游客请直接用 `hit`。
const accept = (body: Body = {}, token: string = tokenA()) => hit('/api/task/accept', token, body)
const arrive = (body: Body = {}, token: string = tokenA()) => hit('/api/task/arrive', token, body)
const complete = (body: Body = {}, token: string = tokenA()) => hit('/api/task/complete', token, body)
const abandon = (body: Body = {}, token: string = tokenA()) => hit('/api/task/abandon', token, body)

/** 真实「入口可达性」探针：mission 页靠 `GET /api/task/active` 展示待救援任务。 */
const activeTask = () => request(server).get('/api/task/active')

const tv = (userId = 'user_001', taskId = TASK): TaskVolunteerRow =>
  db.prepare('SELECT * FROM task_volunteers WHERE task_id = ? AND user_id = ?').get(taskId, userId) as TaskVolunteerRow

/** 某人在某任务下的台账（`source_ref` 即 taskId）。 */
const logs = (userId = 'user_001', taskId = TASK): VolunteerServiceLogRow[] =>
  db.prepare('SELECT * FROM volunteer_service_logs WHERE user_id = ? AND source_ref = ?').all(userId, taskId) as VolunteerServiceLogRow[]

const count = (table: string, where = ''): number =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}${where}`).get() as { c: number }).c

const taskStatus = (taskId = TASK): string =>
  (db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string }).status

const setArrived = (userId: string, ms: number, taskId = TASK): void => {
  db.prepare('UPDATE task_volunteers SET arrived_at_ms = ? WHERE task_id = ? AND user_id = ?').run(ms, taskId, userId)
}

describe('F4 T06 · 独立对抗性验证（v1.4 反悔重新参与）', () => {
  beforeEach(() => { seedTestData() })

  // =========================================================================
  // R1 · ★★ T36 主守卫（反事实夹具）：首段到达在 **10 小时前**
  //     · 取「本次到达」⇒ minutes = 0、started = 本次
  //     · 取「上次到达」⇒ minutes = 600（封顶 480）、started = 旧值
  //     两种错误实现（未清 arrived / 未重置 responded）都会落到 480 或旧起点，本用例必红。
  // =========================================================================
  it('R1（T36 主守卫 · 反事实）：反悔后时长只算**本次**（0），起点=本次到达，非 10 小时前的旧值', async () => {
    await accept()
    await arrive()
    // 制造「上段」：到达发生在 10 小时前（= 600 分钟）
    const oldArrived = Date.now() - 600 * 60000
    db.prepare("UPDATE task_volunteers SET arrived_at_ms = ?, status = 'arrived' WHERE task_id = ? AND user_id = ?")
      .run(oldArrived, TASK, 'user_001')
    await abandon()

    // 反悔
    const re = await accept()
    expect(re.body.data).toEqual({ attributed: false, rejoined: true })
    // ★★ 最危险的一行：反悔**必须**清空 arrived_at_ms（否则本次 arrive 被守卫挡住、complete 拿旧到达当起点）
    expect(tv().arrived_at_ms).toBeNull()

    const rr = await arrive()
    expect(rr.body.data.arrived).toBe(true) // 本次到达真的被记录（未清空 ⇒ false）
    const secondArrived = tv().arrived_at_ms as number
    expect(secondArrived).toBeGreaterThan(Date.now() - 60000) // 是「本次」，不是 10h 前
    expect(secondArrived).not.toBe(oldArrived)

    const rc = await complete()
    expect(rc.body.data.closed).toBe(1)
    expect(rc.body.data.minutes).toBe(0)          // ★ 本段几乎瞬时；若误取旧到达 ⇒ 600（封顶 480）
    expect(rc.body.data.minutes).not.toBe(480)    // 明确排除「封顶后的错误值」

    const log = logs()[0]
    expect(log.started_at_ms).toBe(secondArrived) // ★ 台账起点 = 本次到达
    expect(log.started_at_ms).not.toBe(oldArrived)
    expect(log.duration_min).toBe(0)
  })

  // =========================================================================
  // R2 · ★ T38 `left` 终局：闭合后**不可**反悔、不可作废（独立于实现方版本）
  // =========================================================================
  it('R2（T38 终局）：已 left 的行 ⇒ /accept 不反悔、/abandon 不作废，状态/时刻/rejoin_count 全冻结', async () => {
    await accept()
    await arrive()
    setArrived('user_001', Date.now() - 20 * 60000)
    await complete()

    const closed = tv()
    expect(closed.status).toBe('left')
    expect(closed.rejoin_count).toBe(0)

    const re = await accept()
    expect(re.body.data).toEqual({ attributed: false, rejoined: false })
    const afterAccept = tv()
    expect(afterAccept.status).toBe('left')
    expect(afterAccept.ended_at_ms).toBe(closed.ended_at_ms)
    expect(afterAccept.rejoin_count).toBe(0)

    const ab = await abandon()
    expect(ab.body.data.voided).toBe(false)
    expect(tv().status).toBe('left')
    expect(tv().voided_at_ms).toBeNull() // 闭合行不得被作废

    expect(logs().length).toBe(1) // 台账不变
  })

  // =========================================================================
  // R3 · ★ T39 循环：反复 放弃 ↔ 反悔 ⇒ 不重复入账、rejoin_count 单调精确
  // =========================================================================
  it('R3（T39 循环）：5 轮 abandon↔accept ⇒ rejoin_count 精确=5、台账恰 1 条、minutes=最后一段', async () => {
    await accept()
    expect(tv().rejoin_count).toBe(0) // ★ 首次参与 = 0

    for (let i = 1; i <= 5; i++) {
      const ab = await abandon()
      expect(ab.body.data.voided).toBe(true)
      expect(logs().length).toBe(0)            // 放弃全程零台账

      const r = await accept()
      expect(r.body.data.rejoined).toBe(true)
      const row = tv()
      expect(row.rejoin_count).toBe(i)         // 单调、精确
      expect(row.status).toBe('responded')
      expect(row.arrived_at_ms).toBeNull()
      expect(row.ended_at_ms).toBeNull()
    }

    await arrive()
    setArrived('user_001', Date.now() - 7 * 60000)
    const c = await complete()
    expect(c.body.data.closed).toBe(1)
    expect(c.body.data.minutes).toBe(7)        // = 最后一段
    expect(logs().length).toBe(1)              // ★ idx_vsl_dedup 未被误伤：恰 1 条
    expect(logs()[0].duration_min).toBe(7)

    // 终局：再 accept / complete 均 no-op，台账仍恰 1 条
    expect((await accept()).body.data.rejoined).toBe(false)
    expect((await complete()).body.data.closed).toBe(0)
    expect(logs().length).toBe(1)
    expect(count('volunteer_service_logs')).toBe(1)
  })

  // =========================================================================
  // R4 · ★ T40 反悔入口可达性 —— **端到端**（不止 DB 字段）
  // =========================================================================
  it('R4（T40 入口可达 · 端到端）：/abandon 后任务仍 active，且 /api/task/active 仍返回它', async () => {
    await accept()
    const before = await activeTask()
    expect(before.body.data?.id).toBe(TASK)

    const ab = await abandon({ reason: '现场判断无需支援' })
    expect(ab.body.data.voided).toBe(true)
    expect(taskStatus()).toBe('active')          // 不得置 completed
    const after = await activeTask()             // ★ 真实入口可达性（若 completed，/active 会返回 null）
    expect(after.body.data).not.toBeNull()
    expect(after.body.data.id).toBe(TASK)

    await abandon()                              // 多轮放弃后仍 active
    expect(taskStatus()).toBe('active')
  })

  // =========================================================================
  // R5 · ★ T37 审计：痕迹＝「最近一次」、rejoin **不改**痕迹
  // =========================================================================
  it('R5（T37 审计）：两轮 abandon→rejoin ⇒ 痕迹更新为「最近一次」、rejoin 不清痕迹', async () => {
    await accept()
    await abandon({ reason: '理由1' })
    const v1 = tv().voided_at_ms as number
    expect(v1).toBeGreaterThan(0)
    expect(tv().void_reason).toBe('理由1')

    await accept() // 反悔 #1
    expect(tv().status).toBe('responded')
    expect(tv().rejoin_count).toBe(1)
    expect(tv().voided_at_ms).toBe(v1)           // ★ rejoin **不改**痕迹
    expect(tv().void_reason).toBe('理由1')

    // 哨兵：把痕迹回拨到 111，验证「第二次 abandon」会把它覆盖为**最近一次**
    db.prepare("UPDATE task_volunteers SET voided_at_ms = 111, void_reason = 'sentinel' WHERE task_id = ? AND user_id = ?")
      .run(TASK, 'user_001')
    await abandon({ reason: '理由2' })
    expect(tv().void_reason).toBe('理由2')
    expect(tv().voided_at_ms as number).toBeGreaterThan(111) // 已覆盖（确定性，不依赖真实时钟差值）

    await accept() // 反悔 #2
    expect(tv().rejoin_count).toBe(2)
    expect(tv().void_reason).toBe('理由2')        // 保留「最近一次」
  })

  // =========================================================================
  // R6 · 契约：attributed / rejoined 四输入一致性
  // =========================================================================
  it('R6（契约）：attributed/rejoined 在 新接受 / 重复接受 / 反悔 / 已 left 再接受 下精确一致', async () => {
    // 1) 新用户接受
    expect((await accept()).body.data).toEqual({ attributed: true, rejoined: false })
    // 2) 重复接受（responded 行）
    expect((await accept()).body.data).toEqual({ attributed: false, rejoined: false })
    // 3) 反悔（voided 行）
    await abandon()
    expect((await accept()).body.data).toEqual({ attributed: false, rejoined: true })
    // 4) 已 left 再接受
    await arrive()
    setArrived('user_001', Date.now() - 5 * 60000)
    await complete()
    expect((await accept()).body.data).toEqual({ attributed: false, rejoined: false })
  })

  // =========================================================================
  // R7 · 游客**隔离**：真实用户 voided 后，游客 /accept 不得反悔其行
  // =========================================================================
  it('R7（游客隔离）：真实用户 voided 后，游客（无/非法 token）/accept ⇒ 200 且零影响', async () => {
    await accept()
    await abandon()
    const before = tv()
    expect(before.status).toBe('voided')

    // ⚠️ 直接走 `hit`，避免默认参数把 undefined 变成 tokenA（那就不是游客了）。
    for (const t of [undefined, '', 'not-a-jwt'] as const) {
      const r = await hit('/api/task/accept', t)
      expect(r.status, `token=${String(t)}`).toBe(200)
      expect(r.body.data).toEqual({ attributed: false, rejoined: false })
    }

    const after = tv()
    expect(after.status).toBe('voided')                 // ★ 游客未反悔真实用户的行
    expect(after.rejoin_count).toBe(0)
    expect(after.voided_at_ms).toBe(before.voided_at_ms)
    expect(count('task_volunteers')).toBe(1)            // 未新增行
  })

  // =========================================================================
  // R8 · ★ 补 QA-13 改向后的覆盖缺口：「未反悔的 voided 行」⇒ /arrive no-op
  //   v1.4 前该方向由 `service-hours-qa.test.ts` 的 QA-13 承担；QA-13 按 v1.4 改向后，
  //   它只覆盖「反悔后正常入账」。其中：
  //     · `/complete` 侧 ⇒ 由 `service-hours.test.ts`「T28（反向）」承担（有覆盖）；
  //     · `/arrive` 侧  ⇒ **此前从未被隔离覆盖**（旧 QA-13 的 arrive 是由 arrived_at_ms 非空挡住的，
  //                        与 `status <> 'voided'` 无关），本用例补上。
  //   夹具：**未到达即放弃** ⇒ arrived_at_ms 仍 NULL ⇒ 只有 `status <> 'voided'` 能挡住 /arrive。
  // =========================================================================
  it('R8（补覆盖缺口）：未到达即放弃 ⇒ voided 行上 /arrive 与 /complete 均 no-op、零台账', async () => {
    await accept() // responded，arrived_at_ms = NULL
    const ab = await abandon()
    expect(ab.body.data.voided).toBe(true)

    expect(tv().arrived_at_ms).toBeNull()        // ★ 未到达即放弃：唯一防线是 status<>'voided'
    const rr = await arrive()
    expect(rr.body.data.arrived).toBe(false)     // ★ 守卫咬住：不得在 voided 行上记到达
    expect(tv().arrived_at_ms).toBeNull()
    expect(tv().status).toBe('voided')

    const rc = await complete()
    expect(rc.body.data.closed).toBe(0)
    expect(logs().length).toBe(0)
    expect(count('volunteer_service_logs')).toBe(0)
  })

  // =========================================================================
  // R9 · 读语义：`status=responded ∧ voided_at_ms NOT NULL` 唯一对应「曾作废并已反悔」
  // =========================================================================
  it('R9（读语义无歧义）：从未作废的 responded 行 voided_at_ms 必为 NULL；反悔后才非空', async () => {
    await accept()
    // 从未作废 ⇒ 无痕迹（读不出歧义）
    expect(tv().status).toBe('responded')
    expect(tv().voided_at_ms).toBeNull()
    expect(tv().rejoin_count).toBe(0)

    await abandon()
    await accept() // 反悔
    const row = tv()
    expect(row.status).toBe('responded')         // 当前**未**作废
    expect(row.voided_at_ms).not.toBeNull()      // 但曾作废（审计痕迹）
    expect(row.rejoin_count).toBeGreaterThanOrEqual(1)
  })

  // =========================================================================
  // R10 · 补覆盖缺口：反悔把 `responded_at_ms` 重置为**本次**接受时刻（§11.11-③ 明列）
  //   实测：把 rejoin 的 `responded_at_ms = ?` 换成 `COALESCE(responded_at_ms, ?)`
  //   （= 永不更新）⇒ 全仓库**无一条用例变红**（SURVIVED）⇒ 此前完全未覆盖，本用例补上。
  //   注：`responded_at_ms` 目前尚无生产端读取方（仅写入），故本条属**低危**，但仍是设计要求项。
  // =========================================================================
  it('R10（补覆盖缺口）：反悔把 responded_at_ms 重置为**本次**（不是第一次的旧值）', async () => {
    await accept()
    // 把「第一次接受」时刻回拨 300 分钟，制造可判别的旧值
    const firstResponded = Date.now() - 300 * 60000
    db.prepare('UPDATE task_volunteers SET responded_at_ms = ? WHERE task_id = ? AND user_id = ?')
      .run(firstResponded, TASK, 'user_001')
    await abandon()

    const beforeRejoin = Date.now()
    await accept() // 反悔
    const row = tv()
    expect(row.responded_at_ms).toBeGreaterThanOrEqual(beforeRejoin) // ★ 本次
    expect(row.responded_at_ms).not.toBe(firstResponded)
  })
})
