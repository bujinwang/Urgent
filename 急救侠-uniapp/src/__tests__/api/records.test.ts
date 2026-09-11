import { describe, it, expect, vi } from 'vitest'
import { request } from '@/api/index'
import { fetchRecords, fetchRecordById, mapRescueRecord } from '@/api/records'
import type { ApiRescueRecord } from '@/api/records'

const raw: ApiRescueRecord = {
  id: 'rec_001', type: 'cpr', date: '2026-05-01', location: '深圳湾公园',
  role: '按压员', squad: ['陆远', '陈敏'], result: '成功',
}

describe('Records API（真实接口 /api/records/list）', () => {
  it('fetchRecords 调用 /records/list', () => {
    void fetchRecords()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/records/list' })
  })

  it('mapRescueRecord 显式映射（outcome←result、squad 派生）', () => {
    const r = mapRescueRecord(raw)
    expect(r).toMatchObject({
      id: 'rec_001', type: 'cpr', outcome: 'success', squadCount: 2, aedUsed: false,
    })
    expect(r.squad[0]).toMatchObject({ name: '陆远', avatar: '陆' })
  })

  it('fetchRecordById 直接调用 /records/:id（不存在时抛干净错误）', async () => {
    vi.mocked(request).mockResolvedValueOnce(null)
    await expect(fetchRecordById('rec_001')).rejects.toThrow('救援记录不存在')
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/records/rec_001' })
  })
})
