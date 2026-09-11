import { describe, it, expect, vi } from 'vitest'
import { request } from '@/api/index'
import { fetchAedList, fetchAedById, mapApiDeviceToView } from '@/api/aed'
import type { ApiAedDevice } from '@/api/aed'

const rawDevice: ApiAedDevice = {
  id: 'aed_001',
  name: '深圳湾 AED',
  address: '深圳湾公园南门',
  lat: 22.517,
  lng: 113.947,
  distance: 120,
  status: 'available',
  lastCheck: '2025-05-01',
  batteryLevel: 98,
}

describe('AED API（真实接口）', () => {
  it('fetchAedList 调用 /aed/nearby', () => {
    void fetchAedList()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/aed/nearby' })
  })

  it('fetchAedList 支持坐标参数', () => {
    void fetchAedList(22.5, 113.9)
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/aed/nearby?lat=22.5&lng=113.9' })
  })

  it('fetchAedById 调用 /aed/:id', () => {
    void fetchAedById('aed_001')
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/aed/aed_001' })
  })

  it('mapApiDeviceToView 补齐后端缺失字段（photo/discovered/verified）', () => {
    const view = mapApiDeviceToView(rawDevice, { discovered: true, verified: false })
    expect(view).toMatchObject({
      id: 'aed_001', name: '深圳湾 AED',
      photo: '/static/aed/aed_001.png', discovered: true, verified: false,
    })
    expect(view.checkIns).toEqual([])
  })
})
