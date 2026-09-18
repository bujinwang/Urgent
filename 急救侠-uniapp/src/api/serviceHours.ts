/**
 * 志愿服务时长 / 证明 API（F4 T03 契约层）。
 *
 * 对接后端（T02/T05 已交付）：
 * - `GET  /api/volunteer/service-hours/me`（auth）→ 我的时长（分页 + 分项）
 * - `POST /api/volunteer/service-certificates`（auth）→ 选区间签发证明
 * - `GET  /api/volunteer/service-certificates/me`（auth）→ 我的证明列表
 * - `GET  /api/volunteer/service-certificates/:certNo`（**公开**）→ 编号验真（仅 5 字段）
 * - `POST /api/volunteer/service-certificates/:certNo/revoke`（auth，**仅本人**）→ 自撤
 *
 * 走既有 `requestFull`（保 `code` 分支）：业务码非 0（如「该区间无可用服务记录」）时**抛出明确错误**，
 * 不静默吞错 —— 与 `api/gov.ts` 的 `callData` 用法一致。
 */

import { requestFull } from './index'

export interface ServiceHoursBreakdownItem {
  activityType: string
  minutes: number
  count: number
}

export interface ServiceHoursItem {
  id: string
  activityType: string
  sourceType: string
  sourceRef: string
  startedAtMs: number
  endedAtMs: number
  durationMin: number
  isDrill: boolean
  orgId: string
}

/** `GET /service-hours/me` 的响应。 */
export interface ServiceHoursView {
  totalMinutes: number
  breakdown: ServiceHoursBreakdownItem[]
  items: ServiceHoursItem[]
  page: number
  pageSize: number
  total: number
}

/** 证明状态（active | revoked）。 */
export type ServiceCertificateStatus = 'active' | 'revoked'

/** `POST /service-certificates` 的响应（签发物）。 */
export interface ServiceCertificateView {
  certNo: string
  periodFromMs: number
  periodToMs: number
  totalMinutes: number
  breakdown: ServiceHoursBreakdownItem[]
  issuedAtMs: number
  status: ServiceCertificateStatus
}

/** `GET /service-certificates/me` 的列表项。 */
export interface ServiceCertificateListItem {
  certNo: string
  periodFromMs: number
  periodToMs: number
  totalMinutes: number
  status: ServiceCertificateStatus
  issuedAtMs: number
}

/** `GET /service-certificates/:certNo` 的公开验真响应（**仅 5 字段、零 PII**）。 */
export interface ServiceCertificateVerifyView {
  certNo: string
  periodFromMs: number
  periodToMs: number
  totalMinutes: number
  status: ServiceCertificateStatus
}

/** `POST /:certNo/revoke` 的响应。 */
export interface RevokeCertificateResult {
  certNo: string
  status: ServiceCertificateStatus
}

export interface ServiceHoursParams {
  page?: number
  pageSize?: number
  activityType?: string
}

/** 抛出给调用方的错误（带业务码 + HTTP 状态码，供页面区分 `404 不存在` 与 `网络/其它失败`）。 */
export interface ServiceHoursApiError extends Error {
  code?: number
  statusCode?: number
}

/** 统一调用：业务码非 0 或无 data 时抛出明确错误（不静默兜底）。 */
async function callData<T>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
}): Promise<T> {
  const res = await requestFull<T>(options)
  if (res.code !== 0 || res.data === undefined) {
    const err = new Error(res.message || '请求失败') as ServiceHoursApiError
    err.code = res.code
    err.statusCode = res.statusCode
    throw err
  }
  return res.data
}

/** 我的服务时长（分页 + 分项）。 */
export function getMyHours(params: ServiceHoursParams = {}): Promise<ServiceHoursView> {
  const q: string[] = []
  if (params.page !== undefined) q.push(`page=${params.page}`)
  if (params.pageSize !== undefined) q.push(`pageSize=${params.pageSize}`)
  if (params.activityType) q.push(`activityType=${encodeURIComponent(params.activityType)}`)
  const qs = q.length > 0 ? `?${q.join('&')}` : ''
  return callData<ServiceHoursView>({ url: `/volunteer/service-hours/me${qs}` })
}

/** 选区间签发证明（区间无可用记录 ⇒ 后端 400 ⇒ 此处抛出该 message）。 */
export function createCertificate(periodFromMs: number, periodToMs: number): Promise<ServiceCertificateView> {
  return callData<ServiceCertificateView>({
    url: '/volunteer/service-certificates',
    method: 'POST',
    data: { periodFromMs, periodToMs },
  })
}

/** 我的证明列表。 */
export function listMyCertificates(): Promise<ServiceCertificateListItem[]> {
  return callData<ServiceCertificateListItem[]>({ url: '/volunteer/service-certificates/me' })
}

/** 编号验真（**公开**，无需登录）。 */
export function verifyCertificate(certNo: string): Promise<ServiceCertificateVerifyView> {
  return callData<ServiceCertificateVerifyView>({
    url: `/volunteer/service-certificates/${encodeURIComponent(certNo)}`,
  })
}

/** 本人撤销自己的证明（非本人 ⇒ 后端 403 ⇒ 此处抛出该 message）。 */
export function revokeCertificate(certNo: string, reason?: string): Promise<RevokeCertificateResult> {
  return callData<RevokeCertificateResult>({
    url: `/volunteer/service-certificates/${encodeURIComponent(certNo)}/revoke`,
    method: 'POST',
    data: reason ? { reason } : {},
  })
}
