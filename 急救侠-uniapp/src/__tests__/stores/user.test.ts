import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useUserStore } from '@/stores/user'

const profile = {
  id: 'user_001', name: '陆远', avatar: '陆', tier: 'gold', points: 2340,
  city: '深圳', volunteerId: 'SZ-012', certifications: ['CPR-AHA'], rescueCount: 12,
}
const stats = {
  certifiedRescuers: 12847, networkedAeds: 3256, monthlyRescues: 89,
  onlineVolunteers: 3, aedsWithin1km: 12,
}

function mockByUrl() {
  vi.mocked(request).mockImplementation((options) => {
    if (options.url === '/user/profile') return Promise.resolve(profile)
    if (options.url === '/user/stats') return Promise.resolve(stats)
    return Promise.resolve([])
  })
}

describe('User Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载 profile 与 stats', async () => {
    mockByUrl()
    const store = useUserStore()
    await store.loadProfile()
    await store.loadStats()
    expect(store.profile.name).toBe('陆远')
    expect(store.stats.certifiedRescuers).toBe(12847)
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/user/profile' })
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/user/stats' })
  })

  it('computes tier label correctly', async () => {
    mockByUrl()
    const store = useUserStore()
    await store.loadProfile()
    expect(store.tierLabel).toBe('金牌')
  })

  it('awardPoints 累加积分并按阈值升级', () => {
    mockByUrl()
    const store = useUserStore()
    store.profile.points = 900
    store.profile.tier = 'bronze'
    store.awardPoints(200, '测试奖励')
    expect(store.profile.points).toBe(1100)
    expect(store.profile.tier).toBe('silver')
    // reason 不再被静默丢弃：进入积分流水
    expect(store.pointLog[0]).toMatchObject({ amount: 200, reason: '测试奖励' })
  })

  it('★ P1-2：profile 接口异常（回传 undefined）⇒ 不把 profile 置空（避免白屏），保留 GUEST 占位', async () => {
    // 模拟 request() 吞噬业务错误、回传 body.data = undefined 的场景（根因见 #1）
    vi.mocked(request).mockImplementation((options) => {
      if (options.url === '/user/profile') return Promise.resolve(undefined as unknown as typeof profile)
      if (options.url === '/user/stats') return Promise.resolve(stats)
      return Promise.resolve([])
    })
    const store = useUserStore()
    await store.loadProfile()
    // ★ 不被置空：仍是 GUEST 占位（id 为空串），页面访问 user.profile.xxx 不崩
    expect(store.profile).toBeDefined()
    expect(store.profile.id).toBe('')
  })
})
