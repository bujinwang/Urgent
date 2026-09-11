/**
 * 政府数据监管看板 API（P2-8）
 *
 * 鉴权：使用**独立** `gov_token`（与业务 `jwt_token` 分离）——本模块自行构造
 * `Authorization` 头并覆盖 `request` 的默认头（`request` 会先注入业务 token，再被这里的 header 覆盖）。
 * 响应零 PII：仅计数/比率/分布/district/channel。
 */

import { requestFull } from './index'

/** 简易请求头类型（避免与共享层耦合） */
export type AuthHeader = Record<string, string>

/** 读取政府令牌（与业务 jwt_token 分离）。 */
export function getGovToken(): string {
  return uni.getStorageSync('gov_token') || ''
}

/** 构造政府鉴权头（覆盖业务 token）。 */
export function govAuthHeader(): AuthHeader {
  const t = getGovToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export interface GovViewer {
  id: string
  name: string
  orgName: string
  scopeAll: boolean
  districts: string[]
}

export interface GovMeta {
  from: number
  to: number
  windowDays: number
  district: string | null
  generatedAt: number
  dataGaps: string[]
}
export interface GovTrendPoint { date: string; p95Ms: number | null; count: number }
export interface GovChannelRow { channel: string; count: number; ratio: number }
export interface GovResponseTime {
  hasData: boolean
  sampleSize: number
  p95Ms: number | null
  slaRate: number | null
  noResponseRate: number | null
  alertTotal: number
  trend: GovTrendPoint[]
  channelDistribution: GovChannelRow[]
}
export interface GovCoverage { per10k: number | null; perKm2: number | null; dataGap: boolean }
export interface GovAed {
  total: number
  available: number
  availabilityRate: number | null
  pickups: number
  activePickups: number
  coverage: GovCoverage
}
export interface GovTypeCount { type: string; count: number }
export interface GovHourCount { hour: number; count: number }
export interface GovTasks {
  total: number
  completed: number
  completionRate: number | null
  typeDistribution: GovTypeCount[]
  hourlyDistribution: GovHourCount[]
}
export interface GovRescue { records: number; cases: number }
export interface GovPeople {
  certifiedVolunteers: number
  onlineVolunteers: number
  organizations: number
  orgMembers: number
}
export interface GovDistrictRow {
  district: string
  aedCount: number
  aedAvailableRate: number | null
  responseP95Ms: number | null
  slaRate: number | null
  alertTotal: number
  taskCount: number
  taskCompletionRate: number | null
  coveragePer10k: number | null
}
export interface GovDashboard {
  meta: GovMeta
  responseTime: GovResponseTime
  aed: GovAed
  tasks: GovTasks
  rescue: GovRescue
  people: GovPeople
  districts: GovDistrictRow[]
}

export interface GovViewerAdmin {
  id: string
  username: string
  name: string
  orgName: string
  scopeAll: boolean
  districts: string[]
  active: boolean
  lastLoginAt: number | null
}

export interface GovViewerCreateInput {
  username: string
  password: string
  name?: string
  orgName?: string
  scopeAll?: boolean
  scopeDistricts?: string[]
}

export interface GovViewerUpdateInput {
  name?: string
  orgName?: string
  scopeAll?: boolean
  scopeDistricts?: string[]
  active?: boolean
  password?: string
}

export interface GovDashboardParams {
  from?: number
  to?: number
  window?: number
  district?: string
}

/** 统一 gov 调用：业务码非 0 时抛出明确错误（不静默吞错）。 */
async function callData<T>(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: AuthHeader
}): Promise<T> {
  const res = await requestFull<T>(options)
  if (res.code !== 0 || res.data === undefined) throw new Error(res.message || '请求失败')
  return res.data
}

/** 统一 gov 调用（无返回体）：仅校验业务码。 */
async function callVoid(options: {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: AuthHeader
}): Promise<void> {
  const res = await requestFull<unknown>(options)
  if (res.code !== 0) throw new Error(res.message || '请求失败')
}

/** 政府登录（公开）。 */
export function govLogin(username: string, password: string): Promise<{ token: string; viewer: GovViewer }> {
  return callData<{ token: string; viewer: GovViewer }>({
    url: '/gov/login',
    method: 'POST',
    data: { username, password },
  })
}

/** 当前政府身份 + 可见范围。 */
export function fetchGovMe(): Promise<GovViewer> {
  return callData<GovViewer>({ url: '/gov/me', header: govAuthHeader() })
}

/** 看板聚合数据。 */
export function fetchGovDashboard(params: GovDashboardParams = {}): Promise<GovDashboard> {
  const q: string[] = []
  if (params.from !== undefined) q.push(`from=${params.from}`)
  if (params.to !== undefined) q.push(`to=${params.to}`)
  if (params.window !== undefined) q.push(`window=${params.window}`)
  if (params.district) q.push(`district=${encodeURIComponent(params.district)}`)
  const qs = q.length > 0 ? `?${q.join('&')}` : ''
  return callData<GovDashboard>({ url: `/gov/dashboard${qs}`, header: govAuthHeader() })
}

// ---- 管理员：政府账号（业务 token）----

export function listGovViewers(): Promise<GovViewerAdmin[]> {
  return callData<GovViewerAdmin[]>({ url: '/gov/viewers' })
}

export function createGovViewer(data: GovViewerCreateInput): Promise<{ id: string }> {
  return callData<{ id: string }>({ url: '/gov/viewers', method: 'POST', data: { ...data } })
}

export function updateGovViewer(id: string, data: GovViewerUpdateInput): Promise<void> {
  return callVoid({ url: `/gov/viewers/${id}`, method: 'PUT', data: { ...data } })
}
