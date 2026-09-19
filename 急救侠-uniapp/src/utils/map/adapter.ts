/**
 * 地图 SDK 薄适配层（PRD D2）—— 所有厂商 SDK 调用**只**经本文件；页面只依赖自有 `MapMarker` 模型。
 *
 * 设计要点：
 * - 厂商可换：换 高德↔腾讯 只改本文件（及其动态加载的 script URL），页面与测试不依赖任何厂商 API。
 * - **无 Key ⇒ 降级**（PRD D3）：`isMapEnabled()` 为假时，页面回落到现有列表/草图，绝不白屏、绝不阻塞。
 * - Key 不进仓库（PRD D4）：经构建期注入 `VITE_AMAP_KEY` 传入，仓库内不出现真实 Key。
 */

import type { AedDevice } from '@/api/aed'
import { aedStatusTone } from './status'

export interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  status: AedDevice['status']
  tone: 'green' | 'amber' | 'red'
}

/** 构建期注入键名（高德 Web 端 JS API）。 */
export const MAP_KEY_ENV = 'VITE_AMAP_KEY'

/** 读构建期注入的高德 Key；仓库内不出现真实 Key。无 Key ⇒ 返回 ''。 */
export function getMapKey(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    const v = env?.[MAP_KEY_ENV]
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

/** 是否启用真地图（Key 已配置）。为假 ⇒ 页面回落列表（PRD D3）。 */
export function isMapEnabled(): boolean {
  return getMapKey() !== ''
}

/** 无 Key 时抛出，供调用方转降级路径。 */
export class MapKeyMissingError extends Error {
  constructor() {
    super('高德 Key 未配置（VITE_AMAP_KEY 为空）—— 地图降级到列表')
    this.name = 'MapKeyMissingError'
  }
}

/**
 * 动态加载高德 JS API（无 npm 依赖，走官方 loader script）。
 * - 无 Key ⇒ reject(MapKeyMissingError) ⇒ 调用方回落列表（不白屏）。
 * - 浏览器外（纯单测/SSR）⇒ reject，避免 `document` 未定义。
 * 真实渲染需在浏览器 + Key 到位后；本函数只负责"把 SDK 准备好"，地图实例化交给页面组件。
 */
export function loadAmapSdk(key?: string): Promise<unknown> {
  const effective = key ?? getMapKey()
  if (!effective) return Promise.reject(new MapKeyMissingError())
  if (typeof document === 'undefined') return Promise.reject(new Error('AMap SDK 仅可在浏览器加载'))

  const w = window as unknown as { AMap?: unknown }
  if (typeof w.AMap !== 'undefined') return Promise.resolve(w.AMap)

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(effective)}`
    script.async = true
    const timer = setTimeout(() => reject(new Error('AMap SDK 加载超时')), 10000)
    script.onload = () => {
      clearTimeout(timer)
      const AMap = (window as unknown as { AMap?: unknown }).AMap
      if (AMap) resolve(AMap)
      else reject(new Error('AMap SDK 加载成功但未暴露 window.AMap'))
    }
    script.onerror = () => {
      clearTimeout(timer)
      reject(new Error('AMap SDK 加载失败（网络/Key 无效）'))
    }
    document.head.appendChild(script)
  })
}

/** 把后端设备列表映射为厂商无关的 `MapMarker` 模型（PRD D2：页面只依赖自有模型）。 */
export function toMapMarkers(devices: AedDevice[]): MapMarker[] {
  return (devices || []).map((d) => ({
    id: d.id,
    lat: d.lat,
    lng: d.lng,
    label: d.name,
    status: d.status,
    tone: aedStatusTone(d.status),
  }))
}
