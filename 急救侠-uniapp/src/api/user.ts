/**
 * 用户 API — 真实接口（GET /api/user/profile、/api/user/stats、POST /api/user/points）
 *
 * 已移除 mock 数据；`UserProfile` / `PlatformStats` 与后端响应结构一一对齐，无需映射。
 */

import { request } from './index'

export interface UserProfile {
  id: string
  name: string
  avatar: string
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  points: number
  city: string
  volunteerId: string
  certifications: string[]
  rescueCount: number
  /** 志愿者兴趣方向，逗号分隔（backend 当前未返回，保留可选） */
  volunteer_type?: string
}

/** 平台统计（与后端 `/api/user/stats` 对齐）。 */
export interface PlatformStats {
  certifiedRescuers: number
  networkedAeds: number
  monthlyRescues: number
  onlineVolunteers: number
  aedsWithin1km: number
}

/** 获取当前用户资料。失败时抛出，由调用方呈现错误。 */
export async function fetchProfile(): Promise<UserProfile> {
  return request<UserProfile>({ url: '/user/profile' })
}

/** 获取平台统计。 */
export async function fetchStats(): Promise<PlatformStats> {
  return request<PlatformStats>({ url: '/user/stats' })
}

/** 增加积分（真实接口）。 */
export async function awardPointsApi(amount: number, reason: string) {
  return request<{ points: number; tier: string; reason: string }>({
    url: '/user/points',
    method: 'POST',
    data: { amount, reason },
  })
}
