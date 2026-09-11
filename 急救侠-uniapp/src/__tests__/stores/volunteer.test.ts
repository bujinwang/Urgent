import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useVolunteerStore } from '@/stores/volunteer'

const rankings = [
  { id: 'v001', name: '张医生', avatar: '张', tier: 'gold', points: 5890, rescueCount: 32, city: '深圳', rank: 1 },
  { id: 'v002', name: '陆远', avatar: '陆', tier: 'gold', points: 2340, rescueCount: 12, city: '深圳', rank: 2 },
]

describe('Volunteer Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载排行榜', async () => {
    vi.mocked(request).mockResolvedValue(rankings)
    const store = useVolunteerStore()
    await store.refresh()
    expect(store.leaderboard).toHaveLength(2)
    expect(store.leaderboard[0].name).toBeTruthy()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/volunteer/rankings?type=points' })
  })

  it('setTab 切到 rescue 维度并重新请求', async () => {
    vi.mocked(request).mockResolvedValue(rankings)
    const store = useVolunteerStore()
    store.setTab('rescue')
    await new Promise((r) => setTimeout(r, 0))
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/volunteer/rankings?type=rescue' })
  })
})
