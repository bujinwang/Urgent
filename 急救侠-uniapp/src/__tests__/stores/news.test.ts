import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useNewsStore } from '@/stores/news'

const raw = [
  {
    id: 'n001', title: '测试新闻', type: 'article', category: 'recommend', time: '2小时前',
    location: { name: '深圳', lat: 22.543, lng: 114.058 }, tags: ['测试'],
    isLive: false, isUrgent: false, body: '正文内容', imageUrl: '/x.png',
  },
]

describe('News Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载并映射新闻', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useNewsStore()
    await store.refresh()
    expect(store.items).toHaveLength(1)
    expect(store.items[0]).toMatchObject({
      id: 'n001', title: '测试新闻', type: 'article', coverImage: '/x.png',
    })
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/news/list' })
  })

  it('selectNews 按 id 选中', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useNewsStore()
    await store.refresh()
    store.selectNews('n001')
    expect(store.selected?.title).toBe('测试新闻')
  })
})
