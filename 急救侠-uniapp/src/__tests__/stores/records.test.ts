import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useRecordsStore } from '@/stores/records'

const raw = [
  { id: 'rec_001', type: 'cpr', date: '2026-05-01', location: '深圳湾公园', role: '按压员', squad: ['陆远', '陈敏'], result: '成功' },
]

describe('Records Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载并映射记录', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useRecordsStore()
    await store.refresh()
    expect(store.records).toHaveLength(1)
    expect(store.records[0]).toMatchObject({ id: 'rec_001', outcome: 'success', squadCount: 2 })
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/records/list' })
  })

  it('computes totalRescues / successCount', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useRecordsStore()
    await store.refresh()
    expect(store.totalRescues).toBe(1)
    expect(store.successCount).toBe(1)
  })
})
