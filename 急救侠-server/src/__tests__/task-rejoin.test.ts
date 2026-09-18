/**
 * T06（★ v1.4）· 「放弃后反悔、重新参与同一任务」。
 *
 * 设计：`volunteer-service-hours-design.md` §11.11（① upsert 入口 / ③ 重置清单 / ⑤ 状态机 / ⑥ 去重风险）
 * + §8 T36–T40。
 *
 * ⚠️ 本文件的价值在于**改坏源码必须精确变红**（§8 突变计划），尤其 T36/T39（v1.4 主守卫）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'
import type { TaskVolunteerRow } from '../types/rows'

const auth = (t = userToken('user_001')) => ({ Authorization: `Bearer ${t}` })
const accept = (t = userToken('user_001')) => request(server).post('/api/task/accept').set(auth(t)).send({ taskId: 'task_001' })
const arrive = (t = userToken('user_001')) => request(server).post('/api/task/arrive').set(auth(t)).send({ taskId: 'task_001' })
const complete = (t = userToken('user_001')) => request(server).post('/api/task/complete').set(auth(t)).send({ taskId: 'task_001' })
const abandon = (t = userToken('user_001'), reason = 'abandoned') => request(server).post('/api/task/abandon').set(auth(t)).send({ taskId: 'task_001', reason })

const tvRow = (userId = 'user_001') =>
  db.prepare('SELECT * FROM task_volunteers WHERE task_id = ? AND user_id = ?').get('task_001', userId) as TaskVolunteerRow

const ledgerCount = (userId = 'user_001') =>
  (db.prepare('SELECT COUNT(*) AS c FROM volunteer_service_logs WHERE user_id = ?').get(userId) as { c: number }).c

const taskStatus = () =>
  (db.prepare("SELECT status FROM tasks WHERE id = 'task_001'").get() as { status: string }).status

/** 把 `arrived_at_ms` 回拨到 `min` 分钟前（制造可断言的确定时长）。 */
function backdateArrived(userId: string, min: number): void {
  db.prepare('UPDATE task_volunteers SET arrived_at_ms = ? WHERE task_id = ? AND user_id = ?')
    .run(Date.now() - min * 60000, 'task_001', userId)
}

describe('T06 · v1.4 放弃后反悔、重新参与同一任务', () => {
  beforeEach(() => { seedTestData() })

  // ---- ★★ T36 主守卫：反悔后计时正确 ----
  it('★★ T36：abandon→accept(反悔)→arrive→complete ⇒ 时长从**本次到达**起算，本次 arrive 真被记录', async () => {
    await accept()
    // 模拟「上段」：到达发生在很久以前（300 分钟前）
    db.prepare("UPDATE task_volunteers SET arrived_at_ms = ?, status = 'arrived' WHERE task_id = ? AND user_id = ?")
      .run(Date.now() - 300 * 60000, 'task_001', 'user_001')
    await abandon()

    // 反悔：重新激活
    const re = await accept()
    expect(re.body.data).toEqual({ attributed: false, rejoined: true })
    // ★★ 最危险的一行：arrived_at_ms 必须被清空，否则本次 arrive 会 no-op、complete 会拿旧到达当起点
    expect(tvRow().arrived_at_ms).toBeNull()

    // 本次到达真的被记录（若非空且是"最近"，说明没被旧值挡住）
    await arrive()
    expect(tvRow().arrived_at_ms).not.toBeNull()
    expect(tvRow().arrived_at_ms as number).toBeGreaterThan(Date.now() - 60_000)

    // 制造确定的本段时长：本次到达 = 15 分钟前 ⇒ complete 后应为 15（而非 ~300）
    backdateArrived('user_001', 15)
    const c = await complete()
    expect(c.body.data.closed).toBe(1)
    expect(c.body.data.minutes).toBe(15) // ★ 本段；若未清 arrived ⇒ 会是 ~300（巨大且错误）
  })

  // ---- ★ T37 作废痕迹保留 + rejoin_count ----
  it('★ T37：反悔后 status=responded ∧ voided_at_ms 仍非空 ∧ void_reason 保留 ∧ rejoin_count +1', async () => {
    await accept()
    await abandon(userToken('user_001'), '路程过远')
    expect(tvRow().voided_at_ms).toBeGreaterThan(0)
    expect(tvRow().void_reason).toBe('路程过远')

    await accept() // 反悔
    const row = tvRow()
    expect(row.status).toBe('responded')
    expect(row.arrived_at_ms).toBeNull()
    expect(row.ended_at_ms).toBeNull()
    expect(row.voided_at_ms).toBeGreaterThan(0)   // ★ 审计痕迹**不清**
    expect(row.void_reason).toBe('路程过远')       // ★ 保留
    expect(row.rejoin_count).toBe(1)
  })

  // ---- ★ T38 left 终局 ----
  it('★ T38：已 left（已闭合）的行不可反悔、不可作废', async () => {
    await accept()
    await arrive()
    backdateArrived('user_001', 20)
    await complete()
    const closed = tvRow()
    expect(closed.status).toBe('left')
    const endedAt = closed.ended_at_ms
    expect(endedAt).toBeGreaterThan(0)

    // 反悔 ⇒ no-op
    const re = await accept()
    expect(re.body.data.rejoined).toBe(false)
    const afterAccept = tvRow()
    expect(afterAccept.status).toBe('left')            // 不回到 responded
    expect(afterAccept.ended_at_ms).toBe(endedAt)      // 不变
    expect(afterAccept.rejoin_count).toBe(0)

    // 作废 ⇒ no-op（守卫 ended_at_ms IS NULL）
    const ab = await abandon()
    expect(ab.body.data.voided).toBe(false)
    expect(tvRow().status).toBe('left')
  })

  // ---- ★ T39 反复放弃↔反悔不重复入账 ----
  it('★ T39：多轮 abandon↔accept 后 arrive→complete ⇒ 该 (task,user) 台账**仅 1 行**、minutes=最后一段', async () => {
    await accept() // 建行（rejoin_count 0）
    for (let i = 0; i < 3; i++) {
      await abandon()
      const r = await accept()
      expect(r.body.data.rejoined).toBe(true)
    }
    expect(tvRow().rejoin_count).toBe(3)
    expect(ledgerCount()).toBe(0) // 放弃全程不写台账

    await arrive()
    backdateArrived('user_001', 10)
    const c = await complete()
    expect(c.body.data.closed).toBe(1)
    expect(c.body.data.minutes).toBe(10)
    expect(ledgerCount()).toBe(1) // ★ 仅 1 行（idx_vsl_dedup 不被误伤）
  })

  // ---- ★ T40 反悔入口可达性 ----
  it('★ T40：/abandon **不**把 tasks.status 置 completed（任务仍 active ⇒ 反悔入口可达）', async () => {
    await accept()
    expect(taskStatus()).toBe('active')
    const ab = await abandon()
    expect(ab.body.data.voided).toBe(true)
    expect(taskStatus()).toBe('active') // ★ 若日后 abandon 顺手置 completed，此断言必红
  })

  // ---- 幂等：对已有 responded 行重复 accept ----
  it('幂等：对已 responded 的行重复 accept ⇒ 不增 rejoin_count、不改 responded_at_ms、rejoined=false', async () => {
    await accept()
    const before = tvRow()
    const again = await accept()
    expect(again.body.data).toEqual({ attributed: false, rejoined: false })
    const after = tvRow()
    expect(after.rejoin_count).toBe(0)
    expect(after.responded_at_ms).toBe(before.responded_at_ms)
    expect(after.status).toBe('responded')
  })
})
