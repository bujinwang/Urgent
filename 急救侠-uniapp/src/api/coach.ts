/**
 * 教练 API
 */

import { request } from './index'

export interface CoachSummary {
  id: string
  name: string
  avatar: string
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  city: string
  specialties: string[]
  rescueCount: number
  traineeCount: number
  available: boolean
}

export interface CoachDetail extends CoachSummary {
  certifications: string[]
  bio: string
  points: number
}

/** 获取教练列表 */
export async function fetchCoaches(): Promise<CoachSummary[]> {
  return request({ url: '/volunteer/coaches' })
}

/** 获取教练详情 */
export async function fetchCoachDetail(id: string): Promise<CoachDetail> {
  return request({ url: `/volunteer/coaches/${id}` })
}
