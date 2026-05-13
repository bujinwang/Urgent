import { describe, it, expect } from 'vitest'
import { getProfile, getStats, fetchProfile, fetchStats, awardPointsApi } from '@/api/user'

describe('User API', () => {
  it('getProfile returns mock user', () => {
    const user = getProfile()
    expect(user.id).toBe('user_001')
    expect(user.name).toBe('陆远')
    expect(user.tier).toBe('gold')
  })

  it('getStats returns platform stats', () => {
    const stats = getStats()
    expect(stats.certifiedRescuers).toBeGreaterThan(0)
    expect(stats.networkedAeds).toBeGreaterThan(0)
  })

  it('fetchProfile returns a promise', () => {
    expect(fetchProfile()).toBeInstanceOf(Promise)
  })

  it('fetchStats returns a promise', () => {
    expect(fetchStats()).toBeInstanceOf(Promise)
  })

  it('awardPointsApi returns a promise', () => {
    expect(awardPointsApi(10, 'test')).toBeInstanceOf(Promise)
  })
})
