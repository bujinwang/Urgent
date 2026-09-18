/**
 * T02 · 服务证明：签发（★ v1.3 幂等）/ 列表 / 公开验真（零 PII）/ 作废（语义 B）。
 *
 * 覆盖：§4.3 端点 #2–#4、T15（验真零 PII 深扫）、
 * **T33**（★ v1.3 同区间幂等同编号 + 作废后再开 ⇒ 新编号、同 totalMinutes）、
 * **T34**（★★ v1.3 权益主守卫：作废证明**不动台账**、该时长仍可被后续新证明统计）、
 * 迁移 045 去重（设计口径 T32）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'
import { MIGRATION_045_SQL } from '../db'
import { recordService } from '../services/serviceLog'
import type { ActivityType } from '../types'

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
const BASE = 1_700_000_000_000
const FROM = BASE - 1
const TO = BASE + 24 * 60 * 60 * 1000
const PII_KEYS = ['user_id', 'userId', 'name', 'phone']

let refSeq = 0
function log(userId: string, type: ActivityType, minutes: number): void {
  refSeq += 1
  recordService({
    userId,
    activityType: type,
    sourceRef: `cref_${refSeq}`,
    startedAtMs: BASE,
    endedAtMs: BASE + minutes * 60000,
    now: 1,
  })
}

function addUser(id: string, name = id): void {
  db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(id, name)
}

const issue = (t: string, period = { periodFromMs: FROM, periodToMs: TO }) =>
  request(server).post('/api/volunteer/service-certificates').set(auth(t)).send(period)

const revoke = (t: string, certNo: string, reason?: string) =>
  request(server)
    .post(`/api/volunteer/service-certificates/${certNo}/revoke`)
    .set(auth(t))
    .send(reason ? { reason } : {})

describe('T02 · 服务证明（签发 / 列表 / 验真 / 作废）', () => {
  beforeEach(() => { seedTestData() })

  // ---- 签发 ----
  it('POST 无 token ⇒ 401', async () => {
    const res = await request(server).post('/api/volunteer/service-certificates').send({ periodFromMs: FROM, periodToMs: TO })
    expect(res.status).toBe(401)
  })

  it('POST 区间非法 / 无数据 ⇒ 400（冷启动不返回空证明）', async () => {
    const t = userToken('user_001')
    expect((await request(server).post('/api/volunteer/service-certificates').set(auth(t)).send({ periodFromMs: TO, periodToMs: FROM })).status).toBe(400)
    expect((await request(server).post('/api/volunteer/service-certificates').set(auth(t)).send({ periodFromMs: 'x', periodToMs: TO })).status).toBe(400)

    log('user_001', 'rescue_task', 30)
    expect((await request(server).post('/api/volunteer/service-certificates').set(auth(t)).send({ periodFromMs: 0, periodToMs: 1 })).status).toBe(400)
  })

  it('POST 成功：certNo 形如 VS-YYYYMMDD-XXXXXX、totalMinutes 正确、分项之和相等（且 T4/T7/T8 不计入证明）', async () => {
    log('user_001', 'rescue_task', 30)
    log('user_001', 'rescue_task', 45)
    refSeq += 1; recordService({ userId: 'user_001', activityType: 'manual', sourceRef: `cref_${refSeq}`, startedAtMs: BASE, endedAtMs: BASE + 100 * 60000, status: 'pending', now: 1 })
    refSeq += 1; recordService({ userId: 'user_001', activityType: 'drill', sourceRef: `cref_${refSeq}`, startedAtMs: BASE, endedAtMs: BASE + 100 * 60000, isDrill: true, now: 1 })
    refSeq += 1; recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: `cref_${refSeq}`, startedAtMs: BASE, endedAtMs: null, now: 1 })

    const res = await issue(userToken('user_001'))
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.certNo).toMatch(/^VS-\d{8}-[0-9A-Z]{6}$/)
    expect(d.totalMinutes).toBe(75)
    expect(d.status).toBe('active')
    const sum = d.breakdown.reduce((s: number, b: { minutes: number }) => s + b.minutes, 0)
    expect(sum).toBe(75)
  })

  // ---- ★ T33 幂等签发 ----
  it('★ T33：同区间重复签发 ⇒ **幂等同编号**；作废后再开 ⇒ **新编号、同 totalMinutes**', async () => {
    log('user_001', 'rescue_task', 50)
    const t = userToken('user_001')

    const a = await issue(t)
    const b = await issue(t) // 第二次：命中既有 active ⇒ 幂等
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(b.body.data.certNo).toBe(a.body.data.certNo) // 同编号（不换）
    expect(b.body.data.totalMinutes).toBe(50)
    expect((db.prepare("SELECT COUNT(*) AS c FROM service_certificates WHERE status='active'").get() as { c: number }).c).toBe(1)

    // 作废后 ⇒ 允许重新签发（新编号、同 totalMinutes）
    expect((await revoke(t, a.body.data.certNo, '改日期重开')).status).toBe(200)
    const c = await issue(t)
    expect(c.status).toBe(200)
    expect(c.body.data.certNo).not.toBe(a.body.data.certNo) // 新编号
    expect(c.body.data.totalMinutes).toBe(50)               // 同 totalMinutes
  })

  // ---- 列表 ----
  it('GET /me 无 token ⇒ 401', async () => {
    expect((await request(server).get('/api/volunteer/service-certificates/me')).status).toBe(401)
  })

  it('GET /me 返回我的证明列表（含 certNo/区间/总时长/status/issuedAtMs）', async () => {
    log('user_001', 'rescue_task', 30)
    await issue(userToken('user_001'))

    const res = await request(server).get('/api/volunteer/service-certificates/me').set(auth(userToken('user_001')))
    expect(res.status).toBe(200)   // ⚠️ 证明 /me 未被 :certNo 吞掉（路由顺序守卫）
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['certNo', 'issuedAtMs', 'periodFromMs', 'periodToMs', 'status', 'totalMinutes'].sort())
  })

  it('GET /me 只返回本人证明（T10 隔离）', async () => {
    addUser('user_002', '志愿者B')
    log('user_001', 'rescue_task', 30)
    log('user_002', 'rescue_task', 45)
    await issue(userToken('user_002'))

    const res = await request(server).get('/api/volunteer/service-certificates/me').set(auth(userToken('user_001')))
    expect(res.body.data).toHaveLength(0) // A 尚未签发；绝不串到 B
  })

  // ---- 公开验真（零 PII）----
  it('GET /:certNo 公开（无 token）⇒ 200，且**恰好 5 字段、零 PII**（T15）', async () => {
    log('user_001', 'rescue_task', 42)
    const issued = await issue(userToken('user_001'))
    const certNo = issued.body.data.certNo

    const res = await request(server).get(`/api/volunteer/service-certificates/${certNo}`)
    expect(res.status).toBe(200)
    expect(Object.keys(res.body.data).sort()).toEqual(['certNo', 'periodFromMs', 'periodToMs', 'status', 'totalMinutes'].sort())
    expect(res.body.data.totalMinutes).toBe(42)

    const blob = JSON.stringify(res.body)
    for (const k of PII_KEYS) expect(blob).not.toContain(k)
    expect(blob).not.toContain('user_001')
  })

  it('GET /:certNo 未知编号 ⇒ 404', async () => {
    expect((await request(server).get('/api/volunteer/service-certificates/VS-19700101-ZZZZZZ')).status).toBe(404)
  })

  // ---- ★★ T34 权益主守卫 ----
  it('★★ T34：撤一张覆盖 120h 的证明 ⇒ 台账**仍在**、该 120h **仍能被后续新证明统计**', async () => {
    // 15 条 × 480 分钟（单次封顶）= 7200 分钟 = 120h
    for (let i = 0; i < 15; i++) log('user_001', 'rescue_task', 480)
    const t = userToken('user_001')

    const first = await issue(t)
    expect(first.body.data.totalMinutes).toBe(7200)

    expect((await revoke(t, first.body.data.certNo, '重开')).status).toBe(200)
    // 验真 ⇒ revoked（证明本身作废）
    expect((await request(server).get(`/api/volunteer/service-certificates/${first.body.data.certNo}`)).body.data.status).toBe('revoked')

    // ★ 台账**完全不动**：15 行仍在、且仍为 confirmed（语义 B）
    const logs = db.prepare("SELECT COUNT(*) AS c FROM volunteer_service_logs WHERE user_id='user_001' AND status='confirmed'").get() as { c: number }
    expect(logs.c).toBe(15)

    // ★ 该 120h **仍能被后续新证明统计**（新编号、同 7200）
    const again = await issue(t)
    expect(again.status).toBe(200)
    expect(again.body.data.certNo).not.toBe(first.body.data.certNo)
    expect(again.body.data.totalMinutes).toBe(7200)
  })

  // ---- 迁移 045（设计口径 T32）：先去重再建唯一索引 ----
  it('迁移 045：含重复 active 的旧库 ⇒ 去重后每 (user,period) 仅 1 条 active，且唯一索引建成', () => {
    // 模拟「旧库」：撤掉唯一索引，塞入同区间两条 active（旧行为允许）
    db.exec('DROP INDEX IF EXISTS idx_scert_active_dedup')
    const ins = db.prepare(
      `INSERT INTO service_certificates
         (id,user_id,cert_no,period_from_ms,period_to_ms,total_minutes,breakdown_json,issued_at_ms,issued_by,status,revoked_at_ms,revoke_reason)
       VALUES (?,?,?,?,?,?,?,?,?,'active',NULL,'')`
    )
    ins.run('sc_old1', 'user_001', 'VS-OLD-0001', FROM, TO, 100, '[]', 1000, 'self')
    ins.run('sc_old2', 'user_001', 'VS-OLD-0002', FROM, TO, 100, '[]', 2000, 'self')
    expect((db.prepare("SELECT COUNT(*) AS c FROM service_certificates WHERE status='active'").get() as { c: number }).c).toBe(2)

    db.exec(MIGRATION_045_SQL) // 与生产迁移**同一** SQL

    const actives = db.prepare("SELECT id FROM service_certificates WHERE status='active'").all() as Array<{ id: string }>
    expect(actives).toHaveLength(1)
    expect(actives[0].id).toBe('sc_old1') // 保留 issued_at_ms 最早的一条
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_scert_active_dedup'").get()).toBeTruthy()

    // 幂等：再跑一次不报错、结果不变
    db.exec(MIGRATION_045_SQL)
    expect((db.prepare("SELECT COUNT(*) AS c FROM service_certificates WHERE status='active'").get() as { c: number }).c).toBe(1)
  })
})
