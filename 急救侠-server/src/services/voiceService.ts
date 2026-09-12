/**
 * 阿里云语音服务（AED 责任人联动「短信状态报告未送达 → 语音降级」，P1）
 *
 * 与 `smsService` **纪律完全一致**：
 * - **零新增依赖**：复用 `aliyunRpc.ts` 的签名实现（HMAC-SHA1），不引 SDK。
 * - **配置门控**：未配置（AK/SK + TTS code）时 `sendVoiceCall` 直接返回 `not_configured`，**不发任何请求**。
 * - **永不抛出**、**日志脱敏**。
 *
 * 说明（依官方文档核实）：
 * - 接口 `SingleCallByTts`，端点 `dyvmsapi.aliyuncs.com`，版本 `2017-05-25`；成功响应含 `Code:'OK'` 与 `CallId`。
 * - `CalledShowNumber`（主叫号）**可选**：**公共模式**省略（系统从公共号码池调度，**无需购买号码**）；
 *   **专属模式**才需传入已购买的真实号，且 `TtsCode` 的「外呼模式」必须与之匹配。
 */

import crypto from 'crypto'
import * as config from '../config'
import { baseCommonParams, isoTimestamp, signRpcParams } from './aliyunRpc'
import { maskPhone } from './smsService'

/** 语音服务端点（dyvmsapi，RegionId 走公共参数）。 */
const VOICE_ENDPOINT = 'https://dyvmsapi.aliyuncs.com/'
/** Dyvmsapi 版本（SingleCallByTts 所属版本）。 */
const VOICE_API_VERSION = '2017-05-25'

export interface VoiceSendResult {
  ok: boolean
  code?: string
  message?: string
  /** 通话唯一回执 ID（`CallId`），可用于后续 `QueryCallDetailByCallId` 查询。 */
  callId?: string
  reason?: 'not_configured' | 'invalid_phone' | 'send_failed' | 'exception'
}

/**
 * 语音是否配置齐全：**AK/SK + TTS 模板**。
 * 主叫号（`ALIYUN_VOICE_CALLER_NUMBER`）**可选**（空 = 公共模式）。
 */
export function isVoiceConfigured(): boolean {
  return Boolean(
    config.ALIYUN_SMS_ACCESS_KEY_ID &&
      config.ALIYUN_SMS_ACCESS_KEY_SECRET &&
      config.ALIYUN_VOICE_TTS_CODE
  )
}

/** 中国大陆手机号。 */
const CN_MOBILE = /^1[3-9]\d{9}$/

export interface VoiceRequestParams {
  accessKeyId: string
  accessKeySecret: string
  region: string
  phone: string
  ttsCode: string
  ttsParam: Record<string, string>
  /** 主叫号（`CalledShowNumber`）；为空则不传该参数 ⇒ 公共模式（公共号码池）。 */
  callerNumber?: string
}

/**
 * 构造阿里云 `SingleCallByTts` 的 POST 请求（**纯函数**：时间戳/随机数由调用方注入）。
 * `callerNumber` 为空 ⇒ **省略** `CalledShowNumber`（公共模式）。
 */
export function buildVoiceRequest(
  params: VoiceRequestParams,
  opts: { nonce: string; timestamp: string }
): { url: string; body: string } {
  const query: Record<string, string> = {
    ...baseCommonParams({
      action: 'SingleCallByTts',
      version: VOICE_API_VERSION,
      accessKeyId: params.accessKeyId,
      region: params.region,
      nonce: opts.nonce,
      timestamp: opts.timestamp,
    }),
    CalledNumber: params.phone,
    TtsCode: params.ttsCode,
    TtsParam: JSON.stringify(params.ttsParam),
  }
  if (params.callerNumber) query.CalledShowNumber = params.callerNumber

  return { url: VOICE_ENDPOINT, body: signRpcParams(query, params.accessKeySecret) }
}

/**
 * 发起一次 TTS 语音呼叫。
 *
 * @returns
 * - `{ok:false, reason:'not_configured'}` 未配置（**不发任何请求**）
 * - `{ok:false, reason:'invalid_phone'}` 号码非法（**不发任何请求**）
 * - `{ok:true, code:'OK', callId}` 受理成功
 * - `{ok:false, reason:'send_failed', code, message}` 业务错误
 * - `{ok:false, reason:'exception'}` 网络/解析异常（**永不抛出**）
 */
export async function sendVoiceCall(
  phone: string,
  ttsParam: Record<string, string>
): Promise<VoiceSendResult> {
  if (!isVoiceConfigured()) return { ok: false, reason: 'not_configured' }
  if (!CN_MOBILE.test(phone)) return { ok: false, reason: 'invalid_phone' }

  try {
    const { url, body } = buildVoiceRequest(
      {
        accessKeyId: config.ALIYUN_SMS_ACCESS_KEY_ID,
        accessKeySecret: config.ALIYUN_SMS_ACCESS_KEY_SECRET,
        region: config.ALIYUN_SMS_REGION || 'cn-hangzhou',
        phone,
        ttsCode: config.ALIYUN_VOICE_TTS_CODE,
        ttsParam,
        callerNumber: config.ALIYUN_VOICE_CALLER_NUMBER || '',
      },
      { nonce: crypto.randomUUID(), timestamp: isoTimestamp() }
    )

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { Code?: string; Message?: string; CallId?: string }
    if (data.Code === 'OK') return { ok: true, code: 'OK', callId: data.CallId }

    console.warn(`[Voice] 呼叫失败 phone=${maskPhone(phone)} code=${data.Code} message=${data.Message}`)
    return { ok: false, reason: 'send_failed', code: data.Code, message: data.Message }
  } catch (err) {
    console.error(`[Voice] 呼叫异常 phone=${maskPhone(phone)}: ${(err as Error).message}`)
    return { ok: false, reason: 'exception' }
  }
}
