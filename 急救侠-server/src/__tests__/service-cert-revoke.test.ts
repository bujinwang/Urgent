/**
 * T35（★ v1.3）· 证明**本人自撤**的鉴权：仅本人；非本人 403；已作废幂等；未知 404。
 *
 * 端点：`POST /api/volunteer/service-certificates/:certNo/revoke`（auth）。
 * 语义：只作废**证明本身**、台账不动（§11.9）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'
import { recordService } from '../services/serviceLog'

const auth = (t: string) => ({ Authorization: `Bearer ${t}` })
const BASE = 1_700_000_000_000
const FROM = BASE - 1
const TO = BASE + 24 * 60 * 60 * 1000

function addUser(id: string, name = id): void {
  db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(id, name)
}

function seedLog(userId: string): void {
  recordService({ userId, activityType: 'rescue_task', sourceRef: `rv_${userId}`, startedAtMs: BASE, endedAtMs: BASE + 60 * 60000, now: 1 })
}

async function issueCert(token: string): Promise<string> {
  const res = await request(server)
    .post('/api/volunteer/service-certificates')
    .set(auth(token))
    .send({ periodFromMs: FROM, periodToMs: TO })
  expect(res.status).toBe(200)
  return res.body.data.certNo as string
}

const revoke = (token: string, certNo: string) =>
  request(server).post(`/api/volunteer/service-certificates/${certNo}/revoke`).set(auth(token)).send({})

const verifyStatus = async (certNo: string) =>
  (await request(server).get(`/api/volunteer/service-certificates/${certNo}`)).body.data.status

describe('T35 · 证明本人自撤的鉴权（v1.3）', () => {
  beforeEach(() => { seedTestData() })

  it('无 token ⇒ 401', async () => {
    addUser('user_002')
    seedLog('user_002')
    const certNo = await issueCert(userToken('user_002'))
    const res = await request(server).post(`/api/volunteer/service-certificates/${certNo}/revoke`).send({})
    expect(res.status).toBe(401)
  })

  it('本人自撤 ⇒ 200，证明变 revoked，台账不动', async () => {
    seedLog('user_001')
    const certNo = await issueCert(userToken('user_001'))
    const res = await revoke(userToken('user_001'), certNo)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ certNo, status: 'revoked' })
    expect(await verifyStatus(certNo)).toBe('revoked')
    // 台账仍在、仍 confirmed
    expect((db.prepare("SELECT COUNT(*) AS c FROM volunteer_service_logs WHERE user_id='user_001' AND status='confirmed'").get() as { c: number }).c).toBe(1)
  })

  it('★ 非本人撤他人证明 ⇒ 403，且**不改任何证明/台账**', async () => {
    addUser('user_002', '志愿者B')
    seedLog('user_001')
    const certNo = await issueCert(userToken('user_001'))

    const res = await revoke(userToken('user_002'), certNo) // 攻击者 = B
    expect(res.status).toBe(403)
    // 证明仍 active
    expect(await verifyStatus(certNo)).toBe('active')
    // 台账不动
    expect((db.prepare("SELECT COUNT(*) AS c FROM volunteer_service_logs WHERE user_id='user_001' AND status='confirmed'").get() as { c: number }).c).toBe(1)
  })

  it('已作废幂等：再次自撤 ⇒ 仍 200 + revoked，不报错', async () => {
    seedLog('user_001')
    const certNo = await issueCert(userToken('user_001'))
    expect((await revoke(userToken('user_001'), certNo)).status).toBe(200)
    const again = await revoke(userToken('user_001'), certNo)
    expect(again.status).toBe(200)
    expect(again.body.data.status).toBe('revoked')
    expect(await verifyStatus(certNo)).toBe('revoked')
  })

  it('未知编号 ⇒ 404', async () => {
    const res = await revoke(userToken('user_001'), 'VS-19700101-ZZZZZZ')
    expect(res.status).toBe(404)
  })
})
