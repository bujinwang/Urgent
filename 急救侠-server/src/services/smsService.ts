/**
 * 阿里云短信服务（AED 责任人联动「推送失败 → 即时短信降级」，P1）
 *
 * 设计原则：
 * - **零新增依赖**：阿里云 RPC 签名用 Node 内置 `crypto` 手写（HMAC-SHA1），不引入 `@alicloud/*` SDK。
 * - **配置门控**：未配置凭证（任一为空）时功能视为关闭，`sendSms` 直接返回 `not_configured`，
 *   **不发起任何网络请求** —— 与既有行为完全一致（既有测试不受影响）。
 * - **永不抛出**：一切失败以返回值表达（`reason`），避免拖垮急救主流程。
 * - **纯函数可单测**：`buildSmsRequest` 的时间戳/随机数由调用方注入，便于确定性断言。
 * - **PII**：日志/错误信息**禁止输出完整手机号**，一律经 `maskPhone` 脱敏。
 */

import crypto from 'crypto'
import * as config from '../config'

/** dysmsapi 全局端点（地域由 `RegionId` 参数表达，不使用区域化域名）。 */
const SMS_ENDPOINT = 'https://dysmsapi.aliyuncs.com/'
/** 阿里云短信 API 版本（SendSms 自 2017-05-25 起稳定）。 */
const SMS_API_VERSION = '2017-05-25'

export interface SmsSendResult {
  ok: boolean
  code?: string
  message?: string
  reason?: 'not_configured' | 'invalid_phone' | 'send_failed' | 'exception'
}

/** 凭证/模板是否配置齐全（AccessKeyId / Secret / SignName / TemplateCode 四项全部非空）。 */
export function isSmsConfigured(): boolean {
  return Boolean(
    config.ALIYUN_SMS_ACCESS_KEY_ID &&
      config.ALIYUN_SMS_ACCESS_KEY_SECRET &&
      config.ALIYUN_SMS_SIGN_NAME &&
      config.ALIYUN_SMS_TEMPLATE_CODE
  )
}

/** 中国大陆手机号（11 位，1[3-9] 开头）。 */
const CN_MOBILE = /^1[3-9]\d{9}$/

/** 手机号脱敏：`138****0000`（保留前 3 后 4）；非手机号返回 `***`。 */
export function maskPhone(phone: string): string {
  if (!CN_MOBILE.test(phone)) return '***'
  return phone.slice(0, 3) + '****' + phone.slice(-4)
}

/**
 * RFC3986 百分号编码：在 `encodeURIComponent` 基础上，额外转义 `! ' ( ) *`，
 * 并保留 `~`（阿里云签名规范要求）。大写十六进制。
 */
function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

/**
 * 规范化查询串（**纯函数，可单测**）：按 **key 字典序**排序 → 逐项 RFC3986 编码 → `k=v` 以 `&` 连接。
 * 单独导出以便对「乱序入参」直接断言排序行为（钉住 `.sort()`）。
 */
export function canonicalizeQuery(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(query[k])}`)
    .join('&')
}

export interface SmsRequestParams {
  accessKeyId: string
  accessKeySecret: string
  region: string
  phone: string
  signName: string
  templateCode: string
  templateParam: Record<string, string>
}

/**
 * 构造阿里云 `SendSms` 的 POST 请求（**纯函数**：时间戳 / 随机数由调用方注入）。
 *
 * 签名算法（RPC 风格 HMAC-SHA1）：
 * 1. 组装公共参数 + 业务参数；
 * 2. 按 **key 字典序** 排序 → 逐项 RFC3986 编码 → `k=v` 以 `&` 连接，得到规范化查询串；
 * 3. `stringToSign = 'POST&%2F&' + percentEncode(规范串)`；
 * 4. `Signature = base64(HMAC-SHA1(AccessKeySecret + '&', stringToSign))`；
 * 5. 返回以 `&Signature=<percentEncode(Signature)>` 结尾的 `application/x-www-form-urlencoded` body。
 */
export function buildSmsRequest(
  params: SmsRequestParams,
  opts: { nonce: string; timestamp: string }
): { url: string; body: string } {
  const query: Record<string, string> = {
    AccessKeyId: params.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: params.phone,
    RegionId: params.region,
    SignName: params.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: opts.nonce,
    SignatureVersion: '1.0',
    TemplateCode: params.templateCode,
    TemplateParam: JSON.stringify(params.templateParam),
    Timestamp: opts.timestamp,
    Version: SMS_API_VERSION,
  }

  const canonicalQuery = canonicalizeQuery(query)

  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalQuery)}`
  const signature = crypto
    .createHmac('sha1', params.accessKeySecret + '&')
    .update(stringToSign)
    .digest('base64')

  const body = `${canonicalQuery}&Signature=${percentEncode(signature)}`
  return { url: SMS_ENDPOINT, body }
}

/**
 * 发送一条模板短信。
 *
 * @returns
 * - `{ok:false, reason:'not_configured'}` 未配置凭证（**不发任何请求**）
 * - `{ok:false, reason:'invalid_phone'}` 号码非中国大陆手机号（**不发任何请求**）
 * - `{ok:true, code:'OK'}` 阿里云受理成功
 * - `{ok:false, reason:'send_failed', code, message}` 阿里云返回业务错误
 * - `{ok:false, reason:'exception'}` 网络/解析异常（**永不抛出**）
 */
export async function sendSms(
  phone: string,
  templateParam: Record<string, string>
): Promise<SmsSendResult> {
  if (!isSmsConfigured()) return { ok: false, reason: 'not_configured' }
  if (!CN_MOBILE.test(phone)) return { ok: false, reason: 'invalid_phone' }

  try {
    const { url, body } = buildSmsRequest(
      {
        accessKeyId: config.ALIYUN_SMS_ACCESS_KEY_ID,
        accessKeySecret: config.ALIYUN_SMS_ACCESS_KEY_SECRET,
        region: config.ALIYUN_SMS_REGION || 'cn-hangzhou',
        phone,
        signName: config.ALIYUN_SMS_SIGN_NAME,
        templateCode: config.ALIYUN_SMS_TEMPLATE_CODE,
        templateParam,
      },
      {
        nonce: crypto.randomUUID(),
        // 阿里云要求 ISO8601 UTC（`YYYY-MM-DDThh:mm:ssZ`），去掉毫秒
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      }
    )

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { Code?: string; Message?: string }
    if (data.Code === 'OK') return { ok: true, code: 'OK' }

    console.warn(`[SMS] 发送失败 phone=${maskPhone(phone)} code=${data.Code} message=${data.Message}`)
    return { ok: false, reason: 'send_failed', code: data.Code, message: data.Message }
  } catch (err) {
    console.error(`[SMS] 发送异常 phone=${maskPhone(phone)}: ${(err as Error).message}`)
    return { ok: false, reason: 'exception' }
  }
}
