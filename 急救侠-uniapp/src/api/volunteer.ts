/**
 * 志愿者排行榜 API — Mock
 *
 * 提供积分排行和救援次数排行两类数据。
 * 后端就绪后替换为真实接口即可。
 */

export interface VolunteerRankEntry {
  id: number
  avatar: string
  name: string
  volunteerId: string
  rescueCount: number
  points: number
  /** 标记是否为当前登录用户，store 层会覆盖为 profile 数据 */
  isMe: boolean
}

/** 积分排行榜（按 points 降序） */
const POINTS_LEADERBOARD: VolunteerRankEntry[] = [
  { id: 1, avatar: '张', name: '张医生', volunteerId: 'SZ-001', rescueCount: 32, points: 5890, isMe: false },
  { id: 2, avatar: '李', name: '李护士', volunteerId: 'SZ-005', rescueCount: 28, points: 4720, isMe: false },
  { id: 3, avatar: '王', name: '王教练', volunteerId: 'SZ-018', rescueCount: 19, points: 3450, isMe: false },
  { id: 4, avatar: '赵', name: '赵老师', volunteerId: 'SZ-007', rescueCount: 15, points: 2980, isMe: false },
  { id: 5, avatar: '陆', name: '陆远', volunteerId: 'SZ-012', rescueCount: 12, points: 2340, isMe: true },
  { id: 6, avatar: '陈', name: '陈同学', volunteerId: 'SZ-031', rescueCount: 9, points: 1890, isMe: false },
  { id: 7, avatar: '刘', name: '刘急救', volunteerId: 'SZ-009', rescueCount: 8, points: 1560, isMe: false },
  { id: 8, avatar: '周', name: '周志愿', volunteerId: 'SZ-022', rescueCount: 7, points: 1320, isMe: false },
  { id: 9, avatar: '孙', name: '孙救援', volunteerId: 'SZ-015', rescueCount: 6, points: 1100, isMe: false },
  { id: 10, avatar: '吴', name: '吴急救', volunteerId: 'SZ-040', rescueCount: 5, points: 980, isMe: false },
]

/** 救援次数排行（按 rescueCount 降序，同次数按 points 降序） */
const RESCUE_LEADERBOARD: VolunteerRankEntry[] = [
  { id: 1, avatar: '张', name: '张医生', volunteerId: 'SZ-001', rescueCount: 32, points: 5890, isMe: false },
  { id: 2, avatar: '李', name: '李护士', volunteerId: 'SZ-005', rescueCount: 28, points: 4720, isMe: false },
  { id: 3, avatar: '王', name: '王教练', volunteerId: 'SZ-018', rescueCount: 19, points: 3450, isMe: false },
  { id: 4, avatar: '赵', name: '赵老师', volunteerId: 'SZ-007', rescueCount: 15, points: 2980, isMe: false },
  { id: 5, avatar: '陆', name: '陆远', volunteerId: 'SZ-012', rescueCount: 12, points: 2340, isMe: true },
  { id: 6, avatar: '陈', name: '陈同学', volunteerId: 'SZ-031', rescueCount: 9, points: 1890, isMe: false },
  { id: 7, avatar: '刘', name: '刘急救', volunteerId: 'SZ-009', rescueCount: 8, points: 1560, isMe: false },
  { id: 8, avatar: '周', name: '周志愿', volunteerId: 'SZ-022', rescueCount: 7, points: 1320, isMe: false },
  { id: 9, avatar: '孙', name: '孙救援', volunteerId: 'SZ-015', rescueCount: 6, points: 1100, isMe: false },
  { id: 10, avatar: '吴', name: '吴急救', volunteerId: 'SZ-040', rescueCount: 5, points: 980, isMe: false },
]

export type LeaderboardType = 'points' | 'rescue'

/** 获取排行榜数据 */
export function getLeaderboard(type: LeaderboardType = 'points'): VolunteerRankEntry[] {
  const source = type === 'rescue' ? RESCUE_LEADERBOARD : POINTS_LEADERBOARD
  return source.map((entry) => ({ ...entry }))
}

/** 默认导出：兼容 API 请求层 */

import { request } from './index'

export async function fetchLeaderboard(type: LeaderboardType = 'points'): Promise<VolunteerRankEntry[]> {
  return request({ url: `/volunteer/rankings?type=${type}` })
}

export default function (params?: Record<string, unknown>) {
  const type = (params?.type as LeaderboardType) || 'points'
  return {
    code: 0,
    data: getLeaderboard(type),
    message: 'ok',
  }
}
