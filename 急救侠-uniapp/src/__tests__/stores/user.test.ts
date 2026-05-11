import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '@/stores/user'

describe('User Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with mock profile', () => {
    const store = useUserStore()
    expect(store.profile.name).toBe('陆远')
    expect(store.profile.tier).toBe('gold')
    expect(store.profile.points).toBeGreaterThan(0)
  })

  it('initializes with mock stats', () => {
    const store = useUserStore()
    expect(store.stats.certifiedRescuers).toBeGreaterThan(0)
  })

  it('computes tier label correctly', () => {
    const store = useUserStore()
    expect(store.tierLabel).toBe('金牌')
    store.profile.tier = 'silver'
    expect(store.tierLabel).toBe('银牌')
  })

  it('awards points', () => {
    const store = useUserStore()
    store.awardPoints(200, '测试')
    expect(store.profile.points).toBe(2540)
  })

  it('refresh reloads data', () => {
    const store = useUserStore()
    store.refresh()
    expect(store.profile.id).toBeTruthy()
  })
})
