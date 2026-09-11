import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, seedGovViewer, db } from './setup'

const GOV = '/api/gov'

/** 造一条责任人告警（可带 PII 字段，用于脱敏断言）。 */
function addAlert(opts: {
  id: string
  status: string
  latency?: number | null
  slaMet?: number | null
  channel?: string
  aedId?: string
  notifyMs?: number
  custodianName?: string
  requesterName?: string
  phone?: string
}) {
  const now = Date.now()
  const notify = opts.notifyMs ?? now
  const latency = opts.latency ?? null
  db.prepare(`INSERT INTO aed_custodian_alerts
    (id, aed_id, pickup_id, requester_user_id, requester_user_name, requester_user_phone,
     custodian_user_id, custodian_name, custodian_phone_snapshot, custodian_role,
     channel, status, notify_time_ms, first_sent_time_ms, responded_time_ms, sla_deadline_ms,
     response_latency_ms, sla_met, unlock_action, unlock_command_status, unlock_token,
     responder_user_id, delivery_state, consent_granted, consent_version, consent_at_ms,
     consent_revoked_at_ms, notes, created_at, updated_at)
    VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?,?,?,?)`).run(
    opts.id, opts.aedId || 'aed_001', '', 'u_req_secret', opts.requesterName || '急救者甲', opts.phone || '13800000000',
    'u_cust_secret', opts.custodianName || '张责任人', '13900000000', 'primary',
    opts.channel || 'push', opts.status, notify, null, latency === null ? null : notify + latency,
    notify + 120000, latency, opts.slaMet ?? null, 'none', 'not_issued', '',
    '', 'delivered', 1, 'v1', notify,
    null, '', now, now
  )
}

async function dashboard(token: string, query = '') {
  return request(server).get(`${GOV}/dashboard${query}`).set('Authorization', `Bearer ${token}`)
}

describe('Gov Dashboard 指标口径（P2-8）', () => {
  beforeEach(() => { seedTestData() })

  it('冷启动：无告警 → hasData=false 且 p95/sla/noResponse 为 null（不是 0）', async () => {
    const v = seedGovViewer({ username: 'm1', scopeAll: true })
    const res = await dashboard(v.token)
    expect(res.status).toBe(200)
    const d = res.body.data
    expect(d.responseTime.hasData).toBe(false)
    expect(d.responseTime.p95Ms).toBeNull()
    expect(d.responseTime.slaRate).toBeNull()
    expect(d.responseTime.noResponseRate).toBeNull()
    expect(d.responseTime.alertTotal).toBe(0)
    expect(d.responseTime.sampleSize).toBe(0)
  })

  it('覆盖率恒 null + dataGap（不显示 0、不做除法）', async () => {
    const v = seedGovViewer({ username: 'm2', scopeAll: true })
    const d = (await dashboard(v.token)).body.data
    expect(d.aed.coverage).toEqual({ per10k: null, perKm2: null, dataGap: true })
    expect(d.meta.dataGaps.length).toBeGreaterThanOrEqual(1)
  })

  it('有样本 → alertTotal / P95(nearest-rank) / SLA / 无响应率 按口径计算', async () => {
    const v = seedGovViewer({ username: 'm3', scopeAll: true })
    addAlert({ id: 'al1', status: 'acknowledged', latency: 30000, slaMet: 1 })
    addAlert({ id: 'al2', status: 'acknowledged', latency: 60000, slaMet: 1 })
    addAlert({ id: 'al3', status: 'rejected', latency: 300000, slaMet: 0 })
    addAlert({ id: 'al4', status: 'expired' })

    const d = (await dashboard(v.token)).body.data
    expect(d.responseTime.hasData).toBe(true)
    expect(d.responseTime.alertTotal).toBe(4)
    expect(d.responseTime.sampleSize).toBe(3)
    // nearest-rank: ceil(0.95*3)-1 = 2 → 300000
    expect(d.responseTime.p95Ms).toBe(300000)
    expect(d.responseTime.slaRate).toBeCloseTo(2 / 3, 5)
    expect(d.responseTime.noResponseRate).toBeCloseTo(1 / 4, 5)
  })

  it('PII 断言：响应 JSON 不含姓名/手机号/用户 id/password_hash', async () => {
    const v = seedGovViewer({ username: 'm4', scopeAll: true })
    addAlert({ id: 'al_pii', status: 'acknowledged', latency: 45000, slaMet: 1 })

    const res = await dashboard(v.token)
    const json = JSON.stringify(res.body)
    expect(json).not.toContain('急救者甲')
    expect(json).not.toContain('张责任人')
    expect(json).not.toContain('13800000000')
    expect(json).not.toContain('13900000000')
    expect(json).not.toContain('u_req_secret')
    expect(json).not.toContain('u_cust_secret')
    expect(json).not.toContain('password_hash')
    expect(json).not.toContain('custodian_name')
    expect(json).not.toContain('requester_user_name')
  })

  it('区域口径：无 district 归一化为 __UNASSIGNED__（不排除）', async () => {
    const v = seedGovViewer({ username: 'm5', scopeAll: true })
    db.prepare("UPDATE aed_devices SET district = '南山区' WHERE id = 'aed_001'").run()
    const d = (await dashboard(v.token)).body.data
    const keys = (d.districts as Array<{ district: string }>).map((r) => r.district)
    expect(keys).toContain('南山区')
    expect(keys).toContain('__UNASSIGNED__')
  })

  it('越权查询未授权区域 → 403', async () => {
    const v = seedGovViewer({ username: 'm6', scopeAll: false, scopeDistricts: ['南山区'] })
    const ok = await dashboard(v.token, '?district=南山区')
    expect(ok.status).toBe(200)
    const bad = await dashboard(v.token, '?district=福田区')
    expect(bad.status).toBe(403)
  })

  it('window 便捷参数生效（meta.windowDays）', async () => {
    const v = seedGovViewer({ username: 'm7', scopeAll: true })
    const d = (await dashboard(v.token, '?window=7')).body.data
    expect(d.meta.windowDays).toBe(7)
  })

  it('AED / 任务 / 人员 概览字段存在且为计数', async () => {
    const v = seedGovViewer({ username: 'm8', scopeAll: true })
    const d = (await dashboard(v.token)).body.data
    expect(typeof d.aed.total).toBe('number')
    expect(typeof d.aed.available).toBe('number')
    expect(typeof d.tasks.total).toBe('number')
    expect(typeof d.people.certifiedVolunteers).toBe('number')
    expect(typeof d.rescue.records).toBe('number')
    expect(Array.isArray(d.tasks.typeDistribution)).toBe(true)
    expect(Array.isArray(d.responseTime.channelDistribution)).toBe(true)
  })
})
