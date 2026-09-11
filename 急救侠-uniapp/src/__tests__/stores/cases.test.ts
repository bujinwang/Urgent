import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useCaseStore } from '@/stores/cases'

const raw = [
  {
    id: 'case_001', title: '心脏骤停救援', summary: '测试摘要', date: '2026-05-01',
    location: '深圳湾公园', result: '成功', volunteers: ['陆远', '陈敏'], body: '详细记录',
  },
]

describe('Cases Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载并映射案例', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useCaseStore()
    await store.refresh()
    expect(store.items).toHaveLength(1)
    expect(store.items[0]).toMatchObject({ id: 'case_001', title: '心脏骤停救援' })
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/cases/list' })
  })

  it('selectCase 按 id 选中', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useCaseStore()
    await store.refresh()
    store.selectCase('case_001')
    expect(store.selected?.title).toBe('心脏骤停救援')
  })

  it('selectCase 未知 id 不改变选中（保持 null）', async () => {
    vi.mocked(request).mockResolvedValue(raw)
    const store = useCaseStore()
    await store.refresh()
    store.selectCase('nope')
    expect(store.selected).toBeNull()
  })
})
