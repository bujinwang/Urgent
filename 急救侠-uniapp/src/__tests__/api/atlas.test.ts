import { describe, it, expect, vi } from 'vitest'
import { request } from '@/api/index'
import { fetchAtlasCards, mapAtlasCard } from '@/api/atlas'
import type { ApiAtlasCard } from '@/api/atlas'

const raw: ApiAtlasCard = {
  id: 'cpr',
  title: '心脏骤停',
  category: '基础',
  description: 'CPR + AED 全流程',
  steps: ['a'],
  icon: '❤️',
}

describe('Atlas API（真实接口 /api/atlas/cards）', () => {
  it('fetchAtlasCards 调用真实端点', () => {
    void fetchAtlasCards()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/atlas/cards' })
  })

  it('mapAtlasCard 显式映射（num/featured/route）', () => {
    const card = mapAtlasCard(raw, 0)
    expect(card).toMatchObject({
      id: 'cpr', num: '01', title: '心脏骤停', desc: 'CPR + AED 全流程',
      featured: true, route: '/pages/rescue/index',
    })
  })

  it('未知卡片 route 退回默认', () => {
    expect(mapAtlasCard({ ...raw, id: 'unknown' }, 9).route).toBe('/pages/guide/index')
    expect(mapAtlasCard({ ...raw, id: 'unknown' }, 9).num).toBe('10')
  })
})
