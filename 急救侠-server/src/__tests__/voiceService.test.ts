import { describe, it, expect, afterEach, afterAll, vi } from 'vitest'

type VoiceModule = typeof import('../services/voiceService')

const BASE_ENV: Record<string, string> = {
  ALIYUN_SMS_ACCESS_KEY_ID: '',
  ALIYUN_SMS_ACCESS_KEY_SECRET: '',
  ALIYUN_SMS_SIGN_NAME: '',
  ALIYUN_SMS_TEMPLATE_CODE: '',
  ALIYUN_SMS_REGION: 'cn-hangzhou',
  ALIYUN_VOICE_TTS_CODE: '',
  ALIYUN_VOICE_CALLER_NUMBER: '',
}

function setEnv(overrides: Record<string, string> = {}): void {
  const merged = { ...BASE_ENV, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (v === '') delete process.env[k]
    else process.env[k] = v
  }
}

/** 以指定配置态重新加载 voiceService（config 于模块加载时捕获 env）。 */
async function loadVoice(overrides: Record<string, string> = {}): Promise<VoiceModule> {
  setEnv(overrides)
  vi.resetModules()
  return import('../services/voiceService')
}

const CONFIGURED = {
  ALIYUN_SMS_ACCESS_KEY_ID: 'AK_ID',
  ALIYUN_SMS_ACCESS_KEY_SECRET: 'AK_SECRET',
  ALIYUN_VOICE_TTS_CODE: 'TTS_123456',
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
afterAll(() => { for (const k of Object.keys(BASE_ENV)) delete process.env[k] })

describe('voiceService — isVoiceConfigured（配置门控）', () => {
  it('全部为空 → false', async () => {
    const m = await loadVoice()
    expect(m.isVoiceConfigured()).toBe(false)
  })

  it('缺任一项（AK/SK/TTS）→ false', async () => {
    for (const key of ['ALIYUN_SMS_ACCESS_KEY_ID', 'ALIYUN_SMS_ACCESS_KEY_SECRET', 'ALIYUN_VOICE_TTS_CODE']) {
      const m = await loadVoice({ ...CONFIGURED, [key]: '' })
      expect(m.isVoiceConfigured()).toBe(false)
    }
  })

  it('AK/SK + TTS 齐备 → true（主叫号可缺省=公共模式）', async () => {
    const m = await loadVoice({ ...CONFIGURED })
    expect(m.isVoiceConfigured()).toBe(true)
  })
})

describe('voiceService — buildVoiceRequest（纯函数）', () => {
  it('公共模式（主叫号为空）⇒ 省略 CalledShowNumber', async () => {
    const { buildVoiceRequest } = await loadVoice()
    const { url, body } = buildVoiceRequest(
      { accessKeyId: 'AK', accessKeySecret: 'SK', region: 'cn-hangzhou', phone: '13800138000', ttsCode: 'TTS_1', ttsParam: { device: 'AED' }, callerNumber: '' },
      { nonce: 'N1', timestamp: '2026-09-11T00:00:00Z' }
    )
    expect(url).toBe('https://dyvmsapi.aliyuncs.com/')
    expect(body).toContain('Action=SingleCallByTts')
    expect(body).toContain('Version=2017-05-25')
    expect(body).toContain('CalledNumber=13800138000')
    expect(body).toContain('TtsCode=TTS_1')
    expect(body).toContain('Signature=')
    expect(body).not.toContain('CalledShowNumber')
  })

  it('专属模式（主叫号非空）⇒ 含 CalledShowNumber', async () => {
    const { buildVoiceRequest } = await loadVoice()
    const { body } = buildVoiceRequest(
      { accessKeyId: 'AK', accessKeySecret: 'SK', region: 'cn-hangzhou', phone: '13800138000', ttsCode: 'TTS_1', ttsParam: { device: 'AED' }, callerNumber: '05710000' },
      { nonce: 'N1', timestamp: '2026-09-11T00:00:00Z' }
    )
    expect(body).toContain('CalledShowNumber=05710000')
  })
})

describe('voiceService — sendVoiceCall（永不抛出）', () => {
  it('未配置 → not_configured，且不发起任何网络请求', async () => {
    const { sendVoiceCall } = await loadVoice()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = await sendVoiceCall('13800138000', { device: 'AED' })
    expect(r).toEqual({ ok: false, reason: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('非法号码 → invalid_phone，且不发起请求', async () => {
    const { sendVoiceCall } = await loadVoice(CONFIGURED)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (const bad of ['12345', '23800138000', '']) {
      expect(await sendVoiceCall(bad, { device: 'AED' })).toEqual({ ok: false, reason: 'invalid_phone' })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('Code OK → ok:true 且返回 callId；请求含关键字段', async () => {
    const { sendVoiceCall } = await loadVoice(CONFIGURED)
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ Code: 'OK', CallId: 'call_abc' }) })
    vi.stubGlobal('fetch', fetchMock)

    const r = await sendVoiceCall('13800138000', { device: 'AED' })
    expect(r).toEqual({ ok: true, code: 'OK', callId: 'call_abc' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://dyvmsapi.aliyuncs.com/')
    expect(init.method).toBe('POST')
    expect(init.body).toContain('CalledNumber=13800138000')
    expect(init.body).toContain('TtsCode=TTS_123456')
    expect(init.body).toContain('Signature=')
  })

  it('业务错误码 → send_failed（日志脱敏）', async () => {
    const { sendVoiceCall } = await loadVoice(CONFIGURED)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ Code: 'isv.LIMIT', Message: '流控' }),
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await sendVoiceCall('13800138000', { device: 'AED' })
    expect(r).toEqual({ ok: false, reason: 'send_failed', code: 'isv.LIMIT', message: '流控' })
    const logged = warn.mock.calls.flat().join(' ')
    expect(logged).not.toContain('13800138000')
    expect(logged).toContain('138****8000')
  })

  it('fetch 抛错 → exception（永不抛出）', async () => {
    const { sendVoiceCall } = await loadVoice(CONFIGURED)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await sendVoiceCall('13800138000', { device: 'AED' })).toEqual({ ok: false, reason: 'exception' })
  })
})
