/**
 * 志愿者排行榜 API — 真实接口（GET /api/volunteer/rankings）
 *
 * 已移除 mock 数据。注意：后端 `/volunteer/rankings` **不支持** `type` 维度
 * （仅按 `rank_pos` 排序返回），两种榜单当前数据相同（见交付映射表）。
 */

import { request } from './index'

export interface VolunteerRankEntry {
  id: number
  avatar: string
  name: string
  volunteerId: string
  rescueCount: number
  points: number
  /** 是否为当前登录用户（store 层按姓名匹配后覆盖） */
  isMe: boolean
}

export type LeaderboardType = 'points' | 'rescue'

/** 后端 `/api/volunteer/rankings` 返回的原始结构。 */
export interface ApiVolunteerRank {
  id: string
  name: string
  avatar: string
  tier: string
  points: number
  rescueCount: number
  city: string
  rank: number
  /** 所选榜单维度（points|rescue）下的位次（后端新增，1-based） */
  position?: number
}

/**
 * 后端排行项 → 视图模型（显式映射，禁用 `as any`）。
 * 后端无 `volunteerId` → 用后端用户 id 兜底；`id` 用位次（数字型）；`isMe` 由 store 覆盖。
 */
export function mapVolunteerRank(raw: ApiVolunteerRank | null | undefined): VolunteerRankEntry {
  if (!raw) throw new Error('排行榜数据不存在')
  return {
    id: raw.position ?? raw.rank ?? 0,
    avatar: raw.avatar || (raw.name || '?').charAt(0),
    name: raw.name,
    volunteerId: raw.id,
    rescueCount: raw.rescueCount,
    points: raw.points,
    isMe: false,
  }
}

/** 获取排行榜。失败时抛出，由调用方呈现错误。 */
export async function fetchLeaderboard(type: LeaderboardType = 'points'): Promise<VolunteerRankEntry[]> {
  const raw = await request<ApiVolunteerRank[]>({ url: `/volunteer/rankings?type=${type}` })
  return (raw || []).map(mapVolunteerRank)
}
