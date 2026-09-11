/**
 * AED API — 真实接口（GET /api/aed/nearby、GET /api/aed/:id、POST /api/aed/:id/pickups）
 *
 * 已移除 mock 数据；后端为唯一数据源。字段差异由 `mapApiDeviceToView` 显式映射。
 */

import { request } from './index'

export interface CheckInRecord {
  id: string
  userId: string
  userName: string
  photo: string
  date: string
  status: 'ok' | 'issue'
  comment: string
  findingTip?: string
}

/** 视图模型（页面消费）。 */
export interface AedDevice {
  id: string
  name: string
  address: string
  distance: number
  lat: number
  lng: number
  status: 'available' | 'in_use' | 'maintenance'
  photo: string
  model: string
  serialNumber: string
  batteryExpiry: string
  electrodeExpiry: string
  lastMaintenance: string
  lastCheck: string
  indoor: boolean
  floor: string
  openHours: string
  findingInstructions: string
  custodian?: {
    name: string
    phone: string
    role: string
    avatar: string
  }
  checkIns: CheckInRecord[]
  discovered: boolean
  verified: boolean
}

/**
 * 后端 `/api/aed/:id` 返回的原始设备结构（camelCase，与后端 `AedDevice` 对齐）。
 * 后端**不含** `photo / discovered / verified / custodian.avatar`。
 */
export interface ApiAedDevice {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance: number
  status: 'available' | 'in_use' | 'maintenance'
  lastCheck: string
  batteryLevel: number
  model?: string
  serialNumber?: string
  batteryExpiry?: string
  electrodeExpiry?: string
  lastMaintenance?: string
  indoor?: boolean
  floor?: string
  openHours?: string
  findingInstructions?: string
  custodian?: { name: string; phone: string; role: string }
  checkIns?: Array<{
    id: string
    aedId?: string
    userId: string
    userName: string
    photo: string
    date: string
    status: 'ok' | 'issue'
    comment: string
    findingTip?: string
  }>
  reportedBy?: string
  reportedAt?: string
  isMobile?: boolean
  linkedUserId?: string
}

/**
 * 后端原始设备 → 本地视图模型（显式映射，禁用 `as any`）。
 * 后端缺失的字段用占位补齐；`discovered/verified` 由本地状态注入。
 */
export function mapApiDeviceToView(
  raw: ApiAedDevice | null | undefined,
  opts: { discovered?: boolean; verified?: boolean } = {}
): AedDevice {
  if (!raw) throw new Error('AED 设备不存在')
  return {
    id: raw.id,
    name: raw.name,
    address: raw.address,
    distance: raw.distance,
    lat: raw.lat,
    lng: raw.lng,
    status: raw.status,
    photo: `/static/aed/${raw.id}.png`,
    model: raw.model || '',
    serialNumber: raw.serialNumber || '',
    batteryExpiry: raw.batteryExpiry || '',
    electrodeExpiry: raw.electrodeExpiry || '',
    lastMaintenance: raw.lastMaintenance || '',
    lastCheck: raw.lastCheck || '',
    indoor: !!raw.indoor,
    floor: raw.floor || '',
    openHours: raw.openHours || '',
    findingInstructions: raw.findingInstructions || '',
    custodian: raw.custodian
      ? {
          name: raw.custodian.name,
          phone: raw.custodian.phone,
          role: raw.custodian.role,
          avatar: (raw.custodian.name || '?').charAt(0),
        }
      : undefined,
    checkIns: (raw.checkIns || []).map(ci => ({
      id: ci.id,
      userId: ci.userId,
      userName: ci.userName,
      photo: ci.photo,
      date: ci.date,
      status: ci.status,
      comment: ci.comment,
      findingTip: ci.findingTip,
    })),
    discovered: opts.discovered ?? false,
    verified: opts.verified ?? false,
  }
}

/** 附近 AED 列表（真实接口）。失败时抛出，由调用方呈现错误。 */
export async function fetchAedList(lat?: number, lng?: number): Promise<AedDevice[]> {
  const params = lat !== undefined ? `?lat=${lat}&lng=${lng}` : ''
  const raw = await request<ApiAedDevice[]>({ url: `/aed/nearby${params}` })
  return (raw || []).map(d => mapApiDeviceToView(d))
}

/** 单个 AED 原始详情（真实接口）。 */
export async function fetchAedById(id: string): Promise<ApiAedDevice> {
  return request<ApiAedDevice>({ url: `/aed/${id}` })
}

/** 取用登记（先取用后留痕，兜底路径不阻断急救）。 */
export async function createAedPickup(
  aedId: string,
  data: { userId: string; userName?: string; missionId?: string; notes?: string }
): Promise<{ id: string }> {
  return request({ url: `/aed/${aedId}/pickups`, method: 'POST', data: { ...data } })
}
