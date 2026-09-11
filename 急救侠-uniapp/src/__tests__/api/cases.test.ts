import { describe, it, expect, vi } from 'vitest'
import { request } from '@/api/index'
import { fetchCases, fetchCaseByIdApi, mapRescueCase } from '@/api/cases'
import type { ApiRescueCase } from '@/api/cases'

const raw: ApiRescueCase = {
  id: 'case_001', title: '心脏骤停救援', summary: '测试摘要',
  date: '2026-05-01', location: '深圳湾公园', result: '成功',
  volunteers: ['陆远', '陈敏'], body: '详细记录',
}

describe('Cases API（真实接口）', () => {
  it('fetchCases 调用 /cases/list', () => {
    void fetchCases()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/cases/list' })
  })

  it('fetchCaseByIdApi 调用 /cases/:id（案例不存在时抛出干净错误）', async () => {
    vi.mocked(request).mockResolvedValueOnce(null)
    await expect(fetchCaseByIdApi('case_001')).rejects.toThrow('救援案例不存在')
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/cases/case_001' })
  })

  it('mapRescueCase 显式映射（heroes←volunteers、timeline 空）', () => {
    const c = mapRescueCase(raw)
    expect(c).toMatchObject({
      id: 'case_001', title: '心脏骤停救援', resultText: '测试摘要', timeline: [],
    })
    expect(c.heroes).toHaveLength(2)
    expect(c.heroes[0]).toMatchObject({ name: '陆远', avatar: '陆' })
  })
})
