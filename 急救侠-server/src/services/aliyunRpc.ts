/**
 * 阿里云 RPC 风格签名（短信 / 语音共用）——**零新增依赖**，仅用 Node 内置 `crypto`。
 *
 * 详见 https://help.aliyun.com/zh/sms/ 的「签名机制」：HMAC-SHA1 + 规范化查询串。
 * 抽成独立小模块，供 `smsService` 与 `voiceService` **共用同一套签名实现**，避免重复。
 */

import crypto from 'crypto'

/** RFC3986 百分号编码：在 `encodeURIComponent` 基础上额外转义 `! ' ( ) *`，保留 `~`。大写十六进制。 */
export function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

/** 规范化查询串（纯函数）：按 **key 字典序**排序 → 逐项编码 → `k=v` 以 `&` 连接。 */
export function canonicalizeQuery(query: Record<string, string>): string {
  return Object.keys(query)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(query[k])}`)
    .join('&')
}

/**
 * 阿里云 RPC 签名：给定**完整参数集（含公共参数）**，返回 x-www-form-urlencoded body（含 `Signature`）。
 *
 * `stringToSign = 'POST&%2F&' + percentEncode(规范串)`；
 * `Signature = base64(HMAC-SHA1(AccessKeySecret + '&', stringToSign))`。
 */
export function signRpcParams(params: Record<string, string>, accessKeySecret: string): string {
  const cqs = canonicalizeQuery(params)
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(cqs)}`
  const signature = crypto.createHmac('sha1', accessKeySecret + '&').update(stringToSign).digest('base64')
  return `${cqs}&Signature=${percentEncode(signature)}`
}

/** 公共请求参数（短信/语音共用的那部分）。 */
export function baseCommonParams(opts: {
  action: string
  version: string
  accessKeyId: string
  region: string
  nonce: string
  timestamp: string
}): Record<string, string> {
  return {
    AccessKeyId: opts.accessKeyId,
    Action: opts.action,
    Format: 'JSON',
    RegionId: opts.region,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: opts.nonce,
    SignatureVersion: '1.0',
    Timestamp: opts.timestamp,
    Version: opts.version,
  }
}

/** ISO8601 UTC（`YYYY-MM-DDThh:mm:ssZ`，去毫秒）——阿里云要求的时间戳格式。 */
export function isoTimestamp(d: Date = new Date()): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
