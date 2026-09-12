import { describe, it, expect, afterEach, afterAll, vi } from 'vitest'
// 共用签名模块是**纯函数**（不吃配置），故可静态引入 —— 无需 vi.resetModules()。
import { signRpcParams, canonicalizeQuery } from '../services/aliyunRpc'

type SmsModule = typeof import('../services/smsService')

const BASE_ENV: Record<string, string> = {
  ALIYUN_SMS_ACCESS_KEY_ID: '',
  ALIYUN_SMS_ACCESS_KEY_SECRET: '',
  ALIYUN_SMS_SIGN_NAME: '',
  ALIYUN_SMS_TEMPLATE_CODE: '',
  ALIYUN_SMS_REGION: 'cn-hangzhou',
}

/** 写入环境变量（空串 ⇒ 删除，模拟「未配置」）。 */
function setEnv(overrides: Record<string, string> = {}): void {
  const merged = { ...BASE_ENV, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (v === '') delete process.env[k]
    else process.env[k] = v
  }
}

/**
 * 以指定配置态**重新加载** smsService —— `config.ts` 在模块加载时一次性捕获 env，
 * 故切换配置必须 `vi.resetModules()` 后再动态 import。
 */
async function loadModule(overrides: Record<string, string> = {}): Promise<SmsModule> {
  setEnv(overrides)
  vi.resetModules()
  return import('../services/smsService')
}

const CONFIGURED = {
  ALIYUN_SMS_ACCESS_KEY_ID: 'AK_ID',
  ALIYUN_SMS_ACCESS_KEY_SECRET: 'AK_SECRET',
  ALIYUN_SMS_SIGN_NAME: '急救侠',
  ALIYUN_SMS_TEMPLATE_CODE: 'SMS_123',
}

/** 固定输入 ⇒ 确定性签名（golden 值，由独立脚本按文档算法算得）。 */
const PARAMS = {
  accessKeyId: 'AK_ID',
  accessKeySecret: 'AK_SECRET',
  region: 'cn-hangzhou',
  phone: '13800138000',
  signName: '急救侠',
  templateCode: 'SMS_123',
  templateParam: { device: 'AED~1', address: "A!B'C(D)E*F" },
}
const OPTS = { nonce: 'NONCE123', timestamp: '2026-09-11T00:00:00Z' }
const GOLDEN_SIGNATURE_PE = 'n2yHBP%2BW4%2F6uMrEBp1omoGKj6fM%3D' // = base64 `n2yHBP+W4/6uMrEBp1omoGKj6fM=`

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
afterAll(() => {
  for (const k of Object.keys(BASE_ENV)) delete process.env[k]
})

describe('smsService — isSmsConfigured（配置门控）', () => {
  it('全部为空 → false', async () => {
    const m = await loadModule()
    expect(m.isSmsConfigured()).toBe(false)
  })

  it('缺任意一项 → false', async () => {
    for (const key of ['ALIYUN_SMS_ACCESS_KEY_ID', 'ALIYUN_SMS_ACCESS_KEY_SECRET', 'ALIYUN_SMS_SIGN_NAME', 'ALIYUN_SMS_TEMPLATE_CODE']) {
      const m = await loadModule({ ...CONFIGURED, [key]: '' })
      expect(m.isSmsConfigured()).toBe(false)
    }
  })

  it('四项齐全 → true（region 不影响）', async () => {
    const m = await loadModule({ ...CONFIGURED, ALIYUN_SMS_REGION: '' })
    expect(m.isSmsConfigured()).toBe(true)
  })
})

describe('smsService — buildSmsRequest（纯函数，确定性签名）', () => {
  it('端点固定，body 含全部公共/业务参数与 Signature', async () => {
    const { buildSmsRequest } = await loadModule()
    const { url, body } = buildSmsRequest(PARAMS, OPTS)
    expect(url).toBe('https://dysmsapi.aliyuncs.com/')
    expect(body).toContain('Action=SendSms')
    expect(body).toContain('Format=JSON')
    expect(body).toContain('Version=2017-05-25')
    expect(body).toContain('SignatureMethod=HMAC-SHA1')
    expect(body).toContain('SignatureVersion=1.0')
    expect(body).toContain('SignatureNonce=NONCE123')
    expect(body).toContain('AccessKeyId=AK_ID')
    expect(body).toContain('PhoneNumbers=13800138000')
    expect(body).toContain('RegionId=cn-hangzhou')
    expect(body).toContain('TemplateCode=SMS_123')
    expect(body).toContain('Signature=')
  })

  it('确定性：固定 nonce/timestamp ⇒ 与 golden 签名逐字节一致', async () => {
    const { buildSmsRequest } = await loadModule()
    const { body } = buildSmsRequest(PARAMS, OPTS)
    expect(body.endsWith(`Signature=${GOLDEN_SIGNATURE_PE}`)).toBe(true)
  })

  it('幂等：同输入两次调用结果完全相同', async () => {
    const { buildSmsRequest } = await loadModule()
    expect(buildSmsRequest(PARAMS, OPTS).body).toBe(buildSmsRequest(PARAMS, OPTS).body)
  })

  it('nonce 变化 ⇒ 签名变化', async () => {
    const { buildSmsRequest } = await loadModule()
    const a = buildSmsRequest(PARAMS, { nonce: 'A', timestamp: OPTS.timestamp })
    const b = buildSmsRequest(PARAMS, { nonce: 'B', timestamp: OPTS.timestamp })
    expect(a.body).not.toBe(b.body)
  })

  it('key 按字典序排列，Signature 追加在末尾', async () => {
    const { buildSmsRequest } = await loadModule()
    const { body } = buildSmsRequest(PARAMS, OPTS)
    const keys = body.split('&').map((p) => p.slice(0, p.indexOf('=')))
    expect(keys[keys.length - 1]).toBe('Signature')
    const pub = keys.slice(0, -1)
    expect(pub).toEqual([
      'AccessKeyId', 'Action', 'Format', 'PhoneNumbers', 'RegionId', 'SignName',
      'SignatureMethod', 'SignatureNonce', 'SignatureVersion', 'TemplateCode',
      'TemplateParam', 'Timestamp', 'Version',
    ])
    expect(pub).toEqual([...pub].sort()) // 确为升序
  })

  it('TemplateParam（含中文/JSON）被正确 RFC3986 编码；~ 保留、!( ) * 转义', async () => {
    const { buildSmsRequest } = await loadModule()
    const { body } = buildSmsRequest(PARAMS, OPTS)
    expect(body).toContain('TemplateParam=%7B%22device%22%3A%22AED~1%22%2C%22address%22%3A')
    expect(body).toContain('AED~1')
    expect(body).not.toContain('%7E')
    expect(body).toContain('%21')
    expect(body).toContain('%27')
    expect(body).toContain('%28')
    expect(body).toContain('%29')
    expect(body).toContain('%2A')
    expect(body).toContain('SignName=%E6%80%A5%E6%95%91%E4%BE%A0')
  })

  it('M1 规范化对**乱序入参**按字典序排序（钉住 .sort()）', async () => {
    const { canonicalizeQuery } = await loadModule()
    // 故意以非字典序插入 key（Version 在最前）
    const out = canonicalizeQuery({
      Version: '2017-05-25',
      PhoneNumbers: '138',
      Action: 'SendSms',
      AccessKeyId: 'AK',
      Format: 'JSON',
    })
    expect(out).toBe('AccessKeyId=AK&Action=SendSms&Format=JSON&PhoneNumbers=138&Version=2017-05-25')
    const keys = out.split('&').map((p) => p.slice(0, p.indexOf('=')))
    expect(keys).toEqual([...keys].sort()) // 输出必为升序 ⇒ 去掉 sort 会红
  })

  it('Signature 为合法 base64 且非空', async () => {
    const { buildSmsRequest } = await loadModule()
    const { body } = buildSmsRequest(PARAMS, OPTS)
    const raw = decodeURIComponent(body.slice(body.indexOf('Signature=') + 'Signature='.length))
    expect(raw.length).toBeGreaterThan(0)
    expect(raw).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })
})

describe('smsService — sendSms（永不抛出）', () => {
  it('未配置 → not_configured，且不发起任何网络请求', async () => {
    const { sendSms } = await loadModule()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = await sendSms('13800138000', { device: 'AED' })
    expect(r).toEqual({ ok: false, reason: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('非法号码 → invalid_phone，且不发起请求', async () => {
    const { sendSms } = await loadModule(CONFIGURED)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (const bad of ['12345', '23800138000', '1380013800a', '']) {
      const r = await sendSms(bad, { device: 'AED' })
      expect(r).toEqual({ ok: false, reason: 'invalid_phone' })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('已配置 + Code OK → ok:true，请求含关键字段', async () => {
    const { sendSms } = await loadModule(CONFIGURED)
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ Code: 'OK' }) })
    vi.stubGlobal('fetch', fetchMock)

    const r = await sendSms('13800138000', { device: 'AED', address: 'X' })
    expect(r).toEqual({ ok: true, code: 'OK' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://dysmsapi.aliyuncs.com/')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toContain('PhoneNumbers=13800138000')
    expect(init.body).toContain('SignName=')
    expect(init.body).toContain('TemplateCode=SMS_123')
    expect(init.body).toContain('Signature=')
  })

  it('业务错误码 → send_failed 且带 code/message（日志脱敏）', async () => {
    const { sendSms } = await loadModule(CONFIGURED)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ Code: 'isv.BUSINESS_LIMIT_CONTROL', Message: '触发流控' }),
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await sendSms('13800138000', { device: 'AED' })
    expect(r).toEqual({ ok: false, reason: 'send_failed', code: 'isv.BUSINESS_LIMIT_CONTROL', message: '触发流控' })
    const logged = warn.mock.calls.flat().join(' ')
    expect(logged).not.toContain('13800138000')
    expect(logged).toContain('138****8000')
  })

  it('fetch 抛错 → exception（永不抛出）', async () => {
    const { sendSms } = await loadModule(CONFIGURED)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await sendSms('13800138000', { device: 'AED' })
    expect(r).toEqual({ ok: false, reason: 'exception' })
  })
})

describe('smsService — maskPhone（PII 脱敏）', () => {
  it('保留前 3 后 4，中间打码', async () => {
    const { maskPhone } = await loadModule()
    expect(maskPhone('13800138000')).toBe('138****8000')
    expect(maskPhone('19912345678')).toBe('199****5678')
  })

  it('非手机号 → ***', async () => {
    const { maskPhone } = await loadModule()
    expect(maskPhone('12345')).toBe('***')
    expect(maskPhone('')).toBe('***')
  })
})

/**
 * 共用签名模块的**第三方权威**验证。
 *
 * 上面所有 golden 都是「自算自比」（同义反复：用同一套实现算出期望值），只能防回归、
 * 不能证明算法正确。本组用例改用**阿里云官方文档给出的签名示例**做独立向量 ——
 * 出处：`help.aliyun.com/zh/sdk/product-overview/rpc-mechanism`「签名示例」。
 * 官方给定：AccessKeySecret=`testsecret`，期望签名 = `9NaGiOspFP5UPcwX8Iwt2YJXXuk=`。
 */
describe('aliyunRpc — 阿里云官方文档签名向量（权威断言）', () => {
  const OFFICIAL = {
    AccessKeyId: 'testid',
    Action: 'DescribeDedicatedHosts',
    Format: 'JSON',
    RegionId: 'cn-beijing',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: 'edb2b34af0af9a6d14deaf7c1a5315eb',
    SignatureVersion: '1.0',
    Timestamp: '2023-03-13T08:34:30Z',
    Version: '2014-05-26',
  }

  it('规范化查询串与官方文档逐字一致', () => {
    expect(canonicalizeQuery(OFFICIAL)).toBe(
      'AccessKeyId=testid&Action=DescribeDedicatedHosts&Format=JSON&RegionId=cn-beijing' +
        '&SignatureMethod=HMAC-SHA1&SignatureNonce=edb2b34af0af9a6d14deaf7c1a5315eb' +
        '&SignatureVersion=1.0&Timestamp=2023-03-13T08%3A34%3A30Z&Version=2014-05-26'
    )
  })

  it('★ 签名值与官方文档期望值逐字一致（GET，AccessKeySecret=testsecret）', () => {
    const body = signRpcParams(OFFICIAL, 'testsecret', 'GET')
    const sig = decodeURIComponent(body.slice(body.indexOf('Signature=') + 'Signature='.length))
    expect(sig).toBe('9NaGiOspFP5UPcwX8Iwt2YJXXuk=')
  })

  it('method 默认 POST（短信/语音的既有行为不变）', () => {
    const viaDefault = signRpcParams(OFFICIAL, 'testsecret')
    const viaExplicit = signRpcParams(OFFICIAL, 'testsecret', 'POST')
    expect(viaDefault).toBe(viaExplicit)
    // 且与 GET 不同（方法参与 stringToSign）
    expect(viaDefault).not.toBe(signRpcParams(OFFICIAL, 'testsecret', 'GET'))
  })
})
