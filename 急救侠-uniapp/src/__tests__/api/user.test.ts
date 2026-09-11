import { describe, it, expect, vi } from 'vitest'
import { request } from '@/api/index'
import { fetchProfile, fetchStats, awardPointsApi } from '@/api/user'

describe('User API（真实接口）', () => {
  it('fetchProfile 调用 /user/profile', () => {
    void fetchProfile()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/user/profile' })
  })

  it('fetchStats 调用 /user/stats', () => {
    void fetchStats()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/user/stats' })
  })

  it('awardPointsApi 调用 POST /user/points', () => {
    void awardPointsApi(10, 'test')
    expect(vi.mocked(request)).toHaveBeenCalledWith({
      url: '/user/points', method: 'POST', data: { amount: 10, reason: 'test' },
    })
  })
})
