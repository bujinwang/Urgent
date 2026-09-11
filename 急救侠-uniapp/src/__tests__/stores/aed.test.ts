import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useAedStore } from '@/stores/aed'

const raw = [
  {
    id: 'aed_001', name: '深圳湾 AED', address: '深圳湾公园南门', lat: 22.517, lng: 113.947,
    distance: 120, status: 'available', lastCheck: '2025-05-01', batteryLevel: 98,
  },
]

describe('AED Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载并映射 AED 列表', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useAedStore()
    await store.refresh()
    expect(store.aeds).toHaveLength(1)
    expect(store.aeds[0]).toMatchObject({ id: 'aed_001', photo: '/static/aed/aed_001.png' })
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/aed/nearby' })
  })

  it('selectAed 按 id 选中', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useAedStore()
    await store.refresh()
    store.selectAed('aed_001')
    expect(store.selectedAed?.name).toBe('深圳湾 AED')
  })

  it('加载失败时显式记 error 并抛出（不静默兜底）', async () => {
    vi.mocked(request).mockRejectedValue(new Error('boom'))
    const store = useAedStore()
    await expect(store.refresh()).rejects.toThrow('boom')
    expect(store.error).toBe('boom')
    expect(store.aeds).toHaveLength(0)
  })
})
