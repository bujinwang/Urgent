import { describe, it, expect, vi } from 'vitest'
import { request } from '@/api/index'
import { fetchLeaderboard, mapVolunteerRank } from '@/api/volunteer'
import type { ApiVolunteerRank } from '@/api/volunteer'

const raw: ApiVolunteerRank = {
  id: 'v001', name: '陆远', avatar: '陆', tier: 'gold',
  points: 2340, rescueCount: 12, city: '深圳', rank: 1,
}

describe('Volunteer API（真实接口 /api/volunteer/rankings）', () => {
  it('fetchLeaderboard 默认按 points 维度请求', () => {
    void fetchLeaderboard()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/volunteer/rankings?type=points' })
  })

  it('fetchLeaderboard 支持 rescue 维度', () => {
    void fetchLeaderboard('rescue')
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/volunteer/rankings?type=rescue' })
  })

  it('mapVolunteerRank 显式映射（id←rank、volunteerId←id）', () => {
    expect(mapVolunteerRank(raw)).toMatchObject({
      id: 1, name: '陆远', volunteerId: 'v001', points: 2340, rescueCount: 12, isMe: false,
    })
  })
})
