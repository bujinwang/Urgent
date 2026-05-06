/**
 * AED API — Mock
 */

interface AedDevice {
  id: string
  name: string
  address: string
  distance: number
  lat: number
  lng: number
  status: 'available' | 'in_use' | 'maintenance'
  lastCheck: string
  custodian?: {
    name: string
    phone: string
  }
}

const MOCK_AEDS: AedDevice[] = [
  { id: 'aed_001', name: '深圳湾公园管理处', address: '南门入口左侧', distance: 120, lat: 22.516, lng: 113.946, status: 'available', lastCheck: '2026-05-01', custodian: { name: '李明', phone: '138****6789' } },
  { id: 'aed_002', name: '海岸城购物中心', address: '1F 服务台旁', distance: 240, lat: 22.518, lng: 113.944, status: 'available', lastCheck: '2026-04-28', custodian: { name: '张芳', phone: '139****8901' } },
  { id: 'aed_003', name: '深圳湾体育中心', address: 'B1 停车场入口', distance: 380, lat: 22.519, lng: 113.950, status: 'available', lastCheck: '2026-05-02' },
  { id: 'aed_004', name: '欢乐海岸购物中心', address: '2F 电梯口', distance: 520, lat: 22.521, lng: 113.943, status: 'maintenance', lastCheck: '2026-04-15', custodian: { name: '王磊', phone: '137****2345' } },
]

export function getNearbyAeds(lat?: number, lng?: number): AedDevice[] {
  return MOCK_AEDS
}

export function getAedById(id: string): AedDevice | undefined {
  return MOCK_AEDS.find((a) => a.id === id)
}

export default function (params?: Record<string, unknown>) {
  return {
    code: 0,
    data: MOCK_AEDS,
    message: 'ok',
  }
}
