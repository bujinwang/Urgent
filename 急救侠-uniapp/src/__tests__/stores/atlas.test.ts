import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useAtlasStore } from '@/stores/atlas'

const raw = [
  { id: 'cpr', title: '心脏骤停', category: '基础', description: 'CPR + AED 全流程', steps: [], icon: '❤️' },
]

describe('Atlas Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载并映射卡片', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useAtlasStore()
    await store.refresh()
    expect(store.cards).toHaveLength(1)
    expect(store.cards[0].title).toBe('心脏骤停')
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/atlas/cards' })
  })

  it('featuredCard 取 CPR 卡片', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useAtlasStore()
    await store.refresh()
    expect(store.featuredCard?.id).toBe('cpr')
  })

  it('加载失败时记 error 并抛出（不静默兜底）', async () => {
    vi.mocked(request).mockRejectedValue(new Error('network down'))
    const store = useAtlasStore()
    await expect(store.refresh()).rejects.toThrow('network down')
    expect(store.error).toBe('network down')
    expect(store.cards).toHaveLength(0)
  })
})
