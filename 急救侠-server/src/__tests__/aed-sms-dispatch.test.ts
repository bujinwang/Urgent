import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import type { Server } from 'http'

/**
 * M17：**真实 `sendSms`**（不 mock sendSms）返回 `BizId` ⇒ 落 `aed_sms_dispatches`。
 * 需 config 在加载时就有 AK/SK，故先设 env → `vi.resetModules()` → 全新加载 app/db，自建 server。
 */
type Db = typeof import('../db')['default']

let server: Server
let db: Db
let clearAll: typeof import('../db')['clearAll']

const SMS_ENV = {
  ALIYUN_SMS_ACCESS_KEY_ID: 'AK_ID',
  ALIYUN_SMS_ACCESS_KEY_SECRET: 'AK_SECRET',
  ALIYUN_SMS_SIGN_NAME: '急救侠',
  ALIYUN_SMS_TEMPLATE_CODE: 'SMS_123',
}

beforeAll(async () => {
  process.env.DB_PATH = ':memory:'
  Object.assign(process.env, SMS_ENV)
  vi.resetModules()
  const [appMod, dbMod] = await Promise.all([import('../app'), import('../db')])
  db = dbMod.default
  clearAll = dbMod.clearAll
  server = appMod.default.listen(0, '127.0.0.1')
})

afterAll(() => {
  server.close()
  for (const k of Object.keys(SMS_ENV)) delete process.env[k]
})
afterEach(() => { vi.unstubAllGlobals() })

async function login(code: string): Promise<{ token: string; id: string }> {
  const res = await request(server).post('/api/auth/wechat-login').send({ code })
  return { token: res.body.data.token as string, id: res.body.data.openid as string }
}

describe('notify-custodian → 真实 sendSms(BizId) → aed_sms_dispatches（M17）', () => {
  it('推送失败 ⇒ 走真实 sendSms，返回的 BizId 落库', async () => {
    clearAll()
    db.prepare('INSERT INTO aed_devices (id, name, address, lat, lng, distance, status, last_check, battery_level) VALUES (?,?,?,?,?,?,?,?,?)')
      .run('aed_001', '测试AED', '深圳湾', 22.5, 114.0, 80, 'available', '2025-05-01', 98)

    const requester = await login('requester')
    const cp = await login('primary')
    db.prepare('INSERT INTO aed_managers (id, aed_id, user_id, user_name, role) VALUES (?,?,?,?,?)')
      .run('am_1', 'aed_001', cp.id, '陈敏', 'primary')
    db.prepare('UPDATE users SET phone=? WHERE id=?').run('13800138000', cp.id)
    // 无推送订阅 ⇒ 推送失败 ⇒ 走短信（真实 sendSms）

    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ Code: 'OK', Message: 'OK', BizId: 'BIZ_REAL_1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await request(server)
      .post('/api/aed/aed_001/notify-custodian')
      .set('Authorization', `Bearer ${requester.token}`)
      .send({ consentGranted: true })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.data.deliveryState).toBe('sms_fallback')

    // 真实 sendSms 确实发出了 HTTP 请求（未被 mock）
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toContain('dysmsapi.aliyuncs.com')

    const row = db.prepare('SELECT biz_id, custodian_user_id, alert_id FROM aed_sms_dispatches').get() as
      { biz_id: string; custodian_user_id: string; alert_id: string } | undefined
    expect(row?.biz_id).toBe('BIZ_REAL_1') // 真实 BizId 落库
    expect(row?.custodian_user_id).toBe(cp.id)
    expect(row?.alert_id).toBe(res.body.data.alertId)
  })
})
