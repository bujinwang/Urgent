/**
 * 定位工具 — 跨平台（使用 uni.getLocation）
 */

export interface LocationResult {
  lat: number
  lng: number
  accuracy?: number
}

export function getLocation(): Promise<LocationResult> {
  return new Promise((resolve) => {
    uni.getLocation({
      type: 'gcj02',
      success: (res: any) => {
        resolve({ lat: res.latitude, lng: res.longitude, accuracy: res.accuracy })
      },
      fail: () => {
        // Fallback: 深圳湾公园默认坐标
        resolve({ lat: 22.517, lng: 113.947 })
      },
    })
  })
}

export function chooseLocation(): Promise<LocationResult & { name: string; address: string }> {
  return new Promise((resolve, reject) => {
    uni.chooseLocation({
      success: (res: any) => resolve({
        lat: res.latitude, lng: res.longitude,
        name: res.name, address: res.address,
      }),
      fail: reject,
    })
  })
}
