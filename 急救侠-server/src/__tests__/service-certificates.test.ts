/**
 * T02 · 服务证明：签发 / 列表 / 公开验真（零 PII）/ 作废（软删留痕）。
 *
 * 覆盖：§4.3 端点 #2–#4、T15（验真零 PII 深扫）、P0-4①（同区间两次 ⇒ certNo 不同、total 相同）、
 * T9（作废 ⇒ verify=revoked + 分钟数从后续证明消失 + 原台账行仍在）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'
import { recordService } from '../services/serviceLog'
import { revoke } from '../services/serviceCertificate'
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

const certIdOf = (certNo: string): string =>
  (db.prepare('SELECT id FROM service_certificates WHERE cert_no = ?').get(certNo) as { id: string }).id

describe('T02 · 服务证明（签发 / 列表 / 验真 / 作废）', () => {
  beforeEach(() => { seedTestData() })

  // ---- 签发 ----
  it('POST 无 token ⇒ 401', async () => {
    const res = await request(server).post('/api/volunteer/service-certificates').send({ periodFromMs: FROM, periodToMs: TO })
    expect(res.status).toBe(401)
  })

  it('POST 区间非法 / 无数据 ⇒ 400（冷启动不返回空证明）', async () => {
    const t = userToken('user_001')
    const bad = await request(server).post('/api/volunteer/service-certificates').set(auth(t)).send({ periodFromMs: TO, periodToMs: FROM })
    expect(bad.status).toBe(400)
    const nan = await request(server).post('/api/volunteer/service-certificates').set(auth(t)).send({ periodFromMs: 'x', periodToMs: TO })
    expect(nan.status).toBe(400)

    log('user_001', 'rescue_task', 30)
    const emptyPeriod = await request(server).post('/api/volunteer/service-certificates').set(auth(t)).send({ periodFromMs: 0, periodToMs: 1 })
    expect(emptyPeriod.status).toBe(400)
  })

  it('POST 成功：certNo 形如 VS-YYYYMMDD-XXXXXX、totalMinutes 正确、分项之和相等（且 T4/T7/T8 不计入证明）', async () => {
    log('user_001', 'rescue_task', 30)
    log('user_001', 'rescue_task', 45)
    // —— 以下三种**不得**进入证明（T4/T7/T8）——
    refSeq += 1
    recordService({ userId: 'user_001', activityType: 'manual', sourceRef: `cref_${refSeq}`, startedAtMs: BASE, endedAtMs: BASE + 100 * 60000, status: 'pending', now: 1 }) // pending
    refSeq += 1
    recordService({ userId: 'user_001', activityType: 'drill', sourceRef: `cref_${refSeq}`, startedAtMs: BASE, endedAtMs: BASE + 100 * 60000, isDrill: true, now: 1 })     // 演习
    refSeq += 1
    recordService({ userId: 'user_001', activityType: 'rescue_task', sourceRef: `cref_${refSeq}`, startedAtMs: BASE, endedAtMs: null, now: 1 })                        // 未闭合

    const res = await request(server).post('/api/volunteer/service-certificates').set(auth(userToken('user_001'))).send({ periodFromMs: FROM, periodToMs: TO })
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.certNo).toMatch(/^VS-\d{8}-[0-9A-Z]{6}$/)
    expect(d.totalMinutes).toBe(75) // 100(pending)+100(drill)+未闭合 均被排除
    expect(d.status).toBe('active')
    expect(d.periodFromMs).toBe(FROM)
    expect(d.periodToMs).toBe(TO)
    const sum = d.breakdown.reduce((s: number, b: { minutes: number }) => s + b.minutes, 0)
    expect(sum).toBe(75)
  })

  it('P0-4①：同区间签发两次 ⇒ certNo 不同、totalMinutes 相同', async () => {
    log('user_001', 'rescue_task', 50)
    const body = { periodFromMs: FROM, periodToMs: TO }
    const a = await request(server).post('/api/volunteer/service-certificates').set(auth(userToken('user_001'))).send(body)
    const b = await request(server).post('/api/volunteer/service-certificates').set(auth(userToken('user_001'))).send(body)
    expect(a.body.data.certNo).not.toBe(b.body.data.certNo)
    expect(a.body.data.totalMinutes).toBe(b.body.data.totalMinutes)
  })

  // ---- 列表 ----
  it('GET /me 无 token ⇒ 401', async () => {
    expect((await request(server).get('/api/volunteer/service-certificates/me')).status).toBe(401)
  })

  it('GET /me 返回我的证明列表（含 certNo/区间/总时长/status/issuedAtMs）', async () => {
    log('user_001', 'rescue_task', 30)
    await request(server).post('/api/volunteer/service-certificates').set(auth(userToken('user_001'))).send({ periodFromMs: FROM, periodToMs: TO })

    const res = await request(server).get('/api/volunteer/service-certificates/me').set(auth(userToken('user_001')))
    expect(res.status).toBe(200)   // ⚠️ 证明 /me 未被 :certNo 吞掉（路由顺序守卫）
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(1)
    expect(Object.keys(res.body.data[0]).sort()).toEqual(['certNo', 'issuedAtMs', 'periodFromMs', 'periodToMs', 'status', 'totalMinutes'].sort())
  })

  it('GET /me 只返回本人证明（T10 隔离）', async () => {
    addUser('user_002', '志愿者B')
    log('user_001', 'rescue_task', 30)
    log('user_002', 'rescue_task', 45)
    await request(server).post('/api/volunteer/service-certificates').set(auth(userToken('user_002'))).send({ periodFromMs: FROM, periodToMs: TO })

    const res = await request(server).get('/api/volunteer/service-certificates/me').set(auth(userToken('user_001')))
    expect(res.body.data).toHaveLength(0) // A 尚未签发；绝不串到 B
  })

  // ---- 公开验真（零 PII）----
  it('GET /:certNo 公开（无 token）⇒ 200，且**恰好 5 字段、零 PII**（T15）', async () => {
    log('user_001', 'rescue_task', 42)
    const issued = await request(server).post('/api/volunteer/service-certificates').set(auth(userToken('user_001'))).send({ periodFromMs: FROM, periodToMs: TO })
    const certNo = issued.body.data.certNo

    const res = await request(server).get(`/api/volunteer/service-certificates/${certNo}`)
    expect(res.status).toBe(200)
    expect(Object.keys(res.body.data).sort()).toEqual(['certNo', 'periodFromMs', 'periodToMs', 'status', 'totalMinutes'].sort())
    expect(res.body.data.totalMinutes).toBe(42)

    // 深扫：整个响应体不得出现任何身份字段（含键名与值）
    const blob = JSON.stringify(res.body)
    for (const k of PII_KEYS) expect(blob).not.toContain(k)
    expect(blob).not.toContain('user_001')
  })

  it('GET /:certNo 未知编号 ⇒ 404', async () => {
    const res = await request(server).get('/api/volunteer/service-certificates/VS-19700101-ZZZZZZ')
    expect(res.status).toBe(404)
  })

  // ---- 作废（软删留痕，T9）----
  it('T9：作废 ⇒ 验真 revoked；分钟数从后续证明消失；原台账行仍在（不物理删）', async () => {
    log('user_001', 'rescue_task', 60)
    const issued = await request(server).post('/api/volunteer/service-certificates').set(auth(userToken('user_001'))).send({ periodFromMs: FROM, periodToMs: TO })
    const certNo = issued.body.data.certNo

    // 作废（服务层，无 HTTP 端点）
    expect(revoke(certIdOf(certNo), '测试作废')).toBe(true)

    // 前半：验真仍可查到「存在且已撤销」
    const v = await request(server).get(`/api/volunteer/service-certificates/${certNo}`)
    expect(v.status).toBe(200)
    expect(v.body.data.status).toBe('revoked')

    // 后半①：该分钟数从**后续**证明消失（同区间再签 ⇒ 无可用记录 ⇒ 400）
    const again = await request(server).post('/api/volunteer/service-certificates').set(auth(userToken('user_001'))).send({ periodFromMs: FROM, periodToMs: TO })
    expect(again.status).toBe(400)

    // 后半②：原台账行**仍在**（软删，不物理删），仅被标记 voided
    const row = db.prepare('SELECT status FROM volunteer_service_logs WHERE user_id = ?').get('user_001') as { status: string }
    expect(row).toBeDefined()
    expect(row.status).toBe('voided')
    expect((db.prepare('SELECT COUNT(*) AS c FROM volunteer_service_logs WHERE user_id = ?').get('user_001') as { c: number }).c).toBe(1)

    // 重复作废 ⇒ false（幂等，不重复副作用）
    expect(revoke(certIdOf(certNo), 'again')).toBe(false)
  })
})
