import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import type { Server } from 'http'

/**
 * 端点测试：`ALIYUN_SMS_REPORT_SECRET` 必须在 **config 模块加载时**已存在，而 `setupFiles` 会在本文件前
 * 先加载 config（此时 env 未设）。故此处：设好 env → `vi.resetModules()` → **全新加载** app/db/voiceService，
 * 自建 server（不复用 setup 的）。测试后清理 env，避免污染后续文件。
 */
type VoiceMod = typeof import('../services/voiceService')
type Db = typeof import('../db')['default']

let server: Server
let db: Db
let clearAll: typeof import('../db')['clearAll']
let voiceService: VoiceMod

const SECRET = 'test-report-secret'
const URL = '/api/public/aliyun-sms-report'
const USER = 'u_cust_1'
const BIZ = 'BIZ_EP_1'

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  process.env.ALIYUN_SMS_REPORT_SECRET = SECRET
  vi.resetModules()
  const [appMod, dbMod, voiceMod] = await Promise.all([
    import('../app'),
    import('../db'),
    import('../services/voiceService'),
  ])
  db = dbMod.default
  clearAll = dbMod.clearAll
  voiceService = voiceMod
  server = appMod.default.listen(0, '127.0.0.1')
})

afterAll(() => {
  server.close()
  delete process.env.ALIYUN_SMS_REPORT_SECRET
})

function reset(): void {
  clearAll()
  db.prepare('INSERT INTO aed_devices (id, name, address, lat, lng, distance, status, last_check, battery_level) VALUES (?,?,?,?,?,?,?,?,?)')
    .run('aed_001', '测试 AED', '深圳湾', 22.5, 114.0, 80, 'available', '2025-05-01', 98)
  const now = Date.now()
  db.prepare('INSERT OR REPLACE INTO users (id, name, phone) VALUES (?,?,?)').run(USER, '王磊', '13800138000')
  db.prepare('INSERT INTO aed_custodian_alerts (id, aed_id, notify_time_ms, sla_deadline_ms, created_at, updated_at) VALUES (?,?,?,?,?,?)')
    .run('ca_1', 'aed_001', now, now + 1000, now, now)
  db.prepare('INSERT INTO aed_sms_dispatches (id, biz_id, alert_id, custodian_user_id) VALUES (?,?,?,?)')
    .run('sd_1', BIZ, 'ca_1', USER)
}

const FAIL_BODY = [{ phone_number: '13999999999', success: false, err_code: 'UNDELIVERABLE', biz_id: BIZ }]

beforeEach(() => {
  vi.spyOn(voiceService, 'isVoiceConfigured').mockReturnValue(true)
  vi.spyOn(voiceService, 'sendVoiceCall').mockResolvedValue({ ok: true, code: 'OK', callId: 'c1' })
})
afterEach(() => { vi.restoreAllMocks(); delete process.env.ALIYUN_VOICE_DAILY_LIMIT })

describe('POST /api/public/aliyun-sms-report（验真 + 幂等 + 成本护栏）', () => {
  it('缺密钥 / 错密钥 → 404，且绝不呼语音', async () => {
    reset()
    const noHeader = await request(server).post(URL).send(FAIL_BODY)
    expect(noHeader.status).toBe(404)
    const wrong = await request(server).post(URL).set('x-sms-report-secret', 'wrong').send(FAIL_BODY)
    expect(wrong.status).toBe(404)
    expect(vi.mocked(voiceService.sendVoiceCall)).not.toHaveBeenCalled()
  })

  it('正确密钥 + FAIL → 200 {code:0,msg} 且恰好 1 次语音', async () => {
    reset()
    const res = await request(server).post(URL).set('x-sms-report-secret', SECRET).send(FAIL_BODY)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ code: 0, msg: '接收成功' })
    expect(vi.mocked(voiceService.sendVoiceCall)).toHaveBeenCalledTimes(1)
    // 号码取自库（users.phone），非 payload 里的伪造号
    expect(vi.mocked(voiceService.sendVoiceCall).mock.calls[0][0]).toBe('13800138000')
  })

  it('重复推同一份报告 → 仍只有 1 次语音（幂等）', async () => {
    reset()
    await request(server).post(URL).set('x-sms-report-secret', SECRET).send(FAIL_BODY)
    await request(server).post(URL).set('x-sms-report-secret', SECRET).send(FAIL_BODY)
    expect(vi.mocked(voiceService.sendVoiceCall)).toHaveBeenCalledTimes(1)
  })

  it('SUCCESS 报告 → 200 但不呼语音', async () => {
    reset()
    const res = await request(server).post(URL).set('x-sms-report-secret', SECRET)
      .send([{ phone_number: '13800138000', success: true, err_code: 'DELIVERED', biz_id: BIZ }])
    expect(res.status).toBe(200)
    expect(vi.mocked(voiceService.sendVoiceCall)).not.toHaveBeenCalled()
  })

  it('未知 biz_id → 200 且不呼（静默 no-op）', async () => {
    reset()
    const res = await request(server).post(URL).set('x-sms-report-secret', SECRET)
      .send([{ success: false, biz_id: 'UNKNOWN' }])
    expect(res.status).toBe(200)
    expect(vi.mocked(voiceService.sendVoiceCall)).not.toHaveBeenCalled()
  })

  it('日上限生效：上限 1，两条 FAIL 只呼一次', async () => {
    reset()
    db.prepare('INSERT INTO aed_sms_dispatches (id, biz_id, alert_id, custodian_user_id) VALUES (?,?,?,?)')
      .run('sd_2', 'BIZ_EP_2', 'ca_1', USER)
    process.env.ALIYUN_VOICE_DAILY_LIMIT = '1'

    await request(server).post(URL).set('x-sms-report-secret', SECRET).send(FAIL_BODY)
    await request(server).post(URL).set('x-sms-report-secret', SECRET)
      .send([{ success: false, biz_id: 'BIZ_EP_2' }])
    expect(vi.mocked(voiceService.sendVoiceCall)).toHaveBeenCalledTimes(1)
  })
})
