/**
 * T02 · `GET /api/volunteer/service-hours/me`（我的服务时长）。
 *
 * 覆盖：T1 无 token 401 / T5 分项之和恒等于总时长 / T4·T7·T8 计入口径 /
 * T10 越权隔离（A 绝不读到 B）。
 *
 * 计入口径 = 已闭合 ∧ `is_drill=0` ∧ `status='confirmed'`（复用 `serviceLog`）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'
import { recordService } from '../services/serviceLog'
import type { ActivityType } from '../types'

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
const BASE = 1_700_000_000_000

let refSeq = 0
/** 写一条台账（默认确认态）。`minutes=null` ⇒ 未闭合。 */
function log(
  userId: string,
  type: ActivityType,
  minutes: number | null,
  o: { isDrill?: boolean; status?: 'pending' | 'confirmed' } = {}
): void {
  refSeq += 1
  recordService({
    userId,
    activityType: type,
    sourceRef: `ref_${refSeq}`,
    startedAtMs: BASE,
    endedAtMs: minutes == null ? null : BASE + minutes * 60000,
    isDrill: o.isDrill,
    status: o.status,
    now: 1,
  })
}

function addUser(id: string, name = id): void {
  db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(id, name)
}

describe('T02 · GET /api/volunteer/service-hours/me', () => {
  beforeEach(() => { seedTestData() })

  it('T1：无 token ⇒ 401', async () => {
    const res = await request(server).get('/api/volunteer/service-hours/me')
    expect(res.status).toBe(401)
  })

  it('返回总时长 + 分项 + 明细，且分项之和恒等于总时长（T5）', async () => {
    log('user_001', 'rescue_task', 30)
    log('user_001', 'rescue_task', 45)
    log('user_001', 'drill', 20)

    const res = await request(server).get('/api/volunteer/service-hours/me').set(auth(userToken('user_001')))
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.totalMinutes).toBe(95)
    const sum = d.breakdown.reduce((s: number, b: { minutes: number }) => s + b.minutes, 0)
    expect(sum).toBe(d.totalMinutes)
    expect(d.breakdown).toHaveLength(2) // 数据驱动，不写死分项数
    expect(d.items).toHaveLength(3)
    expect(d.total).toBe(3)
  })

  it('T4/T7/T8：未闭合 / is_drill=1 / pending 均不计入', async () => {
    log('user_001', 'rescue_task', 30)                    // 计入
    log('user_001', 'rescue_task', null)                  // T4：未闭合 ⇒ 不计
    log('user_001', 'drill', 25, { isDrill: true })       // T7：演习 ⇒ 不计
    log('user_001', 'manual', 15, { status: 'pending' })  // T8：待确认 ⇒ 不计

    const res = await request(server).get('/api/volunteer/service-hours/me').set(auth(userToken('user_001')))
    expect(res.body.data.totalMinutes).toBe(30)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.breakdown).toHaveLength(1)
  })

  it('T10：身份只由 token 决定 —— A 绝不读到 B（query.userId 被忽略）', async () => {
    addUser('user_002', '志愿者B')
    log('user_001', 'rescue_task', 30)
    log('user_002', 'rescue_task', 45)

    // 即使伪造 query.userId=B，也必须仍返回 A 自己的数据
    const res = await request(server)
      .get('/api/volunteer/service-hours/me?userId=user_002')
      .set(auth(userToken('user_001')))
    expect(res.status).toBe(200)
    expect(res.body.data.totalMinutes).toBe(30)
    expect(res.body.data.items).toHaveLength(1)
  })

  it('activityType 过滤生效；分页返回 page/pageSize/total', async () => {
    log('user_001', 'rescue_task', 30)
    log('user_001', 'drill', 20)

    const filtered = await request(server)
      .get('/api/volunteer/service-hours/me?activityType=drill')
      .set(auth(userToken('user_001')))
    expect(filtered.body.data.totalMinutes).toBe(20)
    expect(filtered.body.data.breakdown).toHaveLength(1)

    const paged = await request(server)
      .get('/api/volunteer/service-hours/me?page=1&pageSize=1')
      .set(auth(userToken('user_001')))
    expect(paged.body.data.items).toHaveLength(1)
    expect(paged.body.data.total).toBe(2)
    expect(paged.body.data.page).toBe(1)
    expect(paged.body.data.pageSize).toBe(1)
  })
})
