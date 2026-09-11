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

  it('setCategory + filteredItems 按分类筛选', async () => {
    vi.mocked(request).mockResolvedValue([
      ...raw,
      { ...raw[0], id: 'n002', title: '志愿者故事', category: 'volunteer' },
    ])
    const store = useNewsStore()
    await store.refresh()
    // recommend 类别返回全量
    expect(store.filteredItems).toHaveLength(2)
    store.setCategory('volunteer')
    expect(store.activeCategory).toBe('volunteer')
    expect(store.filteredItems).toHaveLength(1)
    expect(store.filteredItems[0].id).toBe('n002')
  })
})
