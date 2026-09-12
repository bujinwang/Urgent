import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db, seedTestData } from './setup'
import * as voiceService from '../services/voiceService'
import { parseSmsReports, handleSmsReport } from '../services/smsReportService'
import type { SmsReportItem } from '../services/smsReportService'

const USER = 'u_cust_1'
const BIZ = 'BIZ_1'

/** 建一条 dispatch 行（含 aed_001 + alert + 设备号），返回 biz_id。 */
function setupDispatch(opts: { userId?: string; devicePhone?: string; userPhone?: string; bizId?: string } = {}): string {
  seedTestData() // aed_001
  const userId = opts.userId || USER
  const bizId = opts.bizId || BIZ
  db.prepare('INSERT OR REPLACE INTO users (id, name, phone) VALUES (?,?,?)').run(userId, '王磊', opts.userPhone || '')
  db.prepare('UPDATE aed_devices SET custodian_phone=? WHERE id=?').run(opts.devicePhone ?? '13712340000', 'aed_001')
  const now = Date.now()
  db.prepare(
    'INSERT INTO aed_custodian_alerts (id, aed_id, notify_time_ms, sla_deadline_ms, created_at, updated_at) VALUES (?,?,?,?,?,?)'
  ).run('ca_1', 'aed_001', now, now + 1000, now, now)
  db.prepare('INSERT INTO aed_sms_dispatches (id, biz_id, alert_id, custodian_user_id) VALUES (?,?,?,?)')
    .run('sd_1', bizId, 'ca_1', userId)
  return bizId
}

function fail(bizId: string, extra: Partial<SmsReportItem> = {}): SmsReportItem {
  return { bizId, status: 'FAIL', errCode: 'UNDELIVERABLE', ...extra }
}

afterEach(() => { vi.restoreAllMocks(); delete process.env.ALIYUN_VOICE_DAILY_LIMIT })

describe('smsReportService — parseSmsReports（双形态容错）', () => {
  it('JSON Array + 国内 snake_case（success/biz_id）', () => {
    const r = parseSmsReports([
      { phone_number: '13800138000', success: true, err_code: 'DELIVERED', biz_id: 'B1' },
      { phone_number: '13900139000', success: false, err_code: 'UNDELIVERABLE', biz_id: 'B2' },
    ])
    expect(r).toEqual([
      { bizId: 'B1', status: 'SUCCESS', errCode: 'DELIVERED', errMsg: undefined, rawPhone: '13800138000' },
      { bizId: 'B2', status: 'FAIL', errCode: 'UNDELIVERABLE', errMsg: undefined, rawPhone: '13900139000' },
    ])
  })

  it('国际 / HTTP批量推送 cap 形态（Status/MessageId）', () => {
    const r = parseSmsReports([
      { To: '8521****', Status: '1', ErrorCode: 'success', MessageId: 'M1' },
      { To: '8522****', Status: '2', ErrorCode: 'fail', MessageId: 'M2' },
      { To: '8523****', Status: '6', ErrorCode: 'expired', MessageId: 'M3' },
    ])
    expect(r.map((x) => x.status)).toEqual(['SUCCESS', 'FAIL', 'FAIL'])
    expect(r[0].bizId).toBe('M1')
  })

  it('缺字段 / 非对象 / 单对象 → 容错为 UNKNOWN 或规整', () => {
    expect(parseSmsReports({ biz_id: 'S1', success: false })).toEqual([
      { bizId: 'S1', status: 'FAIL', errCode: undefined, errMsg: undefined, rawPhone: undefined },
    ])
    expect(parseSmsReports([{ foo: 1 }])[0]).toMatchObject({ bizId: '', status: 'UNKNOWN' })
    expect(parseSmsReports([null, 'x', 42]).every((x) => x.status === 'UNKNOWN' && x.bizId === '')).toBe(true)
    expect(parseSmsReports(null)).toEqual([])
    expect(parseSmsReports('nonsense')).toEqual([])
  })
})

describe('smsReportService — handleSmsReport', () => {
  beforeEach(() => { vi.spyOn(voiceService, 'isVoiceConfigured').mockReturnValue(true) })

  it('未知 biz_id → 静默 no-op（不呼、不崩）', async () => {
    seedTestData()
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceCall')
    const r = await handleSmsReport(fail('NOPE'))
    expect(r.matched).toBe(false)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('仅 FAIL 才呼语音；SUCCESS/UNKNOWN 只记录', async () => {
    const biz = setupDispatch()
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceCall').mockResolvedValue({ ok: true, code: 'OK', callId: 'c1' })

    const s = await handleSmsReport({ bizId: biz, status: 'SUCCESS', errCode: 'DELIVERED' })
    expect(s.voiced).toBe(false)
    expect(s.reason).toBe('not_failed')
    // report_status 记录错误码（此刻为最后一条报告 DELIVERED）
    const row = db.prepare('SELECT report_status FROM aed_sms_dispatches WHERE biz_id=?').get(biz) as { report_status: string }
    expect(row.report_status).toBe('DELIVERED')

    // UNKNOWN 亦不呼
    const u = await handleSmsReport({ bizId: biz, status: 'UNKNOWN' })
    expect(u.voiced).toBe(false)
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('FAIL → 呼语音一次；重复推送 → 幂等（仍只 1 次）', async () => {
    const biz = setupDispatch({ userPhone: '13800138000' })
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceCall').mockResolvedValue({ ok: true, code: 'OK', callId: 'c1' })

    const first = await handleSmsReport(fail(biz))
    expect(first.voiced).toBe(true)
    expect(sendSpy).toHaveBeenCalledTimes(1)

    const second = await handleSmsReport(fail(biz)) // 重推
    expect(second.voiced).toBe(false)
    expect(second.reason).toBe('already_handled')
    expect(sendSpy).toHaveBeenCalledTimes(1) // 未重复呼

    const row = db.prepare('SELECT voice_state FROM aed_sms_dispatches WHERE biz_id=?').get(biz) as { voice_state: string }
    expect(row.voice_state).toBe('called')
  })

  it('【安全】payload 里的伪造号码**绝不采信**：只呼库里 users.phone', async () => {
    const biz = setupDispatch({ userPhone: '13800138000', devicePhone: '13712340000' })
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceCall').mockResolvedValue({ ok: true, code: 'OK', callId: 'c1' })

    await handleSmsReport(fail(biz, { rawPhone: '13999999999' })) // 伪造号
    expect(sendSpy).toHaveBeenCalledTimes(1)
    expect(sendSpy.mock.calls[0][0]).toBe('13800138000') // 库里号，非伪造号
  })

  it('无 users.phone → 回落设备 custodian_phone（仍忽略 payload 号）', async () => {
    const biz = setupDispatch({ userPhone: '', devicePhone: '13712340000' })
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceCall').mockResolvedValue({ ok: true, code: 'OK', callId: 'c1' })

    await handleSmsReport(fail(biz, { rawPhone: '13999999999' }))
    expect(sendSpy.mock.calls[0][0]).toBe('13712340000')
  })

  it('语音未配置 → 记录但不呼', async () => {
    vi.mocked(voiceService.isVoiceConfigured).mockReturnValue(false)
    const biz = setupDispatch({ userPhone: '13800138000' })
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceCall')

    const r = await handleSmsReport(fail(biz))
    expect(r.matched).toBe(true)
    expect(r.voiced).toBe(false)
    expect(r.reason).toBe('voice_not_configured')
    expect(sendSpy).not.toHaveBeenCalled()
    // 未呼 ⇒ voice_state 保持 'none'（未消费该行的“一次”额度）
    const row = db.prepare('SELECT voice_state FROM aed_sms_dispatches WHERE biz_id=?').get(biz) as { voice_state: string }
    expect(row.voice_state).toBe('none')
  })

  it('日上限生效（ALIYUN_VOICE_DAILY_LIMIT=1）⇒ 第 2 条不再呼', async () => {
    seedTestData()
    db.prepare('INSERT OR REPLACE INTO users (id, name, phone) VALUES (?,?,?)').run(USER, '王磊', '13800138000')
    const now = Date.now()
    db.prepare('INSERT INTO aed_custodian_alerts (id, aed_id, notify_time_ms, sla_deadline_ms, created_at, updated_at) VALUES (?,?,?,?,?,?)')
      .run('ca_1', 'aed_001', now, now + 1000, now, now)
    for (const [biz, id] of [['B1', 'sd_1'], ['B2', 'sd_2']] as const) {
      db.prepare('INSERT INTO aed_sms_dispatches (id, biz_id, alert_id, custodian_user_id) VALUES (?,?,?,?)')
        .run(id, biz, 'ca_1', USER)
    }
    process.env.ALIYUN_VOICE_DAILY_LIMIT = '1'
    const sendSpy = vi.spyOn(voiceService, 'sendVoiceCall').mockResolvedValue({ ok: true, code: 'OK', callId: 'c1' })

    expect((await handleSmsReport(fail('B1'))).voiced).toBe(true)
    const second = await handleSmsReport(fail('B2'))
    expect(second.voiced).toBe(false)
    expect(second.reason).toBe('daily_cap')
    expect(sendSpy).toHaveBeenCalledTimes(1)
  })

  it('审计不含完整号码', async () => {
    const biz = setupDispatch({ userPhone: '13800138000' })
    vi.spyOn(voiceService, 'sendVoiceCall').mockResolvedValue({ ok: true, code: 'OK', callId: 'c1' })
    await handleSmsReport(fail(biz))
    const audit = db.prepare("SELECT description FROM aed_audit_log WHERE event_type='custodian_voice_fallback' ORDER BY rowid DESC LIMIT 1").get() as { description: string } | undefined
    expect(audit?.description).toBeTruthy()
    expect(audit?.description).not.toContain('13800138000')
  })
})
