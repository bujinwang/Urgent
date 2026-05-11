/**
 * 用户 API — Mock
 */

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
}

const MOCK_USER: UserProfile = {
  id: 'user_001',
  name: '陆远',
  avatar: '陆',
  tier: 'gold',
  points: 2340,
  city: '深圳',
  volunteerId: 'SZ-012',
  certifications: ['CPR-AHA', 'AED-Operator'],
  rescueCount: 12,
}

export function getProfile(): UserProfile {
  return MOCK_USER
}

export function getStats() {
  return {
    certifiedRescuers: 12847,
    networkedAeds: 3256,
    monthlyRescues: 89,
    onlineVolunteers: 3,
    aedsWithin1km: 12,
  }
}

export default function (params?: Record<string, unknown>) {
  return {
    code: 0,
    data: MOCK_USER,
    message: 'ok',
  }
}
