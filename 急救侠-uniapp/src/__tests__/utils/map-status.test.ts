import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setLocale } from '@/i18n'
import { messages } from '@/locales'
import {
  aedStatusLabel,
  aedStatusTone,
  type AedStatus,
} from '@/utils/map/status'
import {
  isMapEnabled,
  getMapKey,
  loadAmapSdk,
  toMapMarkers,
  MapKeyMissingError,
  type MapMarker,
} from '@/utils/map/adapter'

// 仅结构必要的字段；运行时 toMapMarkers 只读取 id/lat/lng/name/status。
const dev = (over: Partial<{ id: string; name: string; lat: number; lng: number; status: AedStatus }>) =>
  ({ id: 'x', name: 'X', lat: 0, lng: 0, status: 'available', ...over }) as unknown as import('@/api/aed').AedDevice

describe('F1 utils/map/status —— AED 状态权威映射（PRD D5）', () => {
  beforeEach(() => setLocale('zh-CN'))
  afterEach(() => setLocale('zh-CN'))

  it('aedStatusLabel 三值封闭映射，且随语言切换（修复 in_use 渲染成"维护中"的 bug）', () => {
    for (const loc of ['zh-CN', 'en-US'] as const) {
      setLocale(loc)
      expect(aedStatusLabel('available')).toBe(messages[loc].aed.status.available)
      expect(aedStatusLabel('in_use')).toBe(messages[loc].aed.status.inUse)
      expect(aedStatusLabel('maintenance')).toBe(messages[loc].aed.status.maintenance)
    }
  })

  it('aedStatusTone：available→green / in_use→amber / maintenance→red', () => {
    expect(aedStatusTone('available')).toBe('green')
    expect(aedStatusTone('in_use')).toBe('amber')
    expect(aedStatusTone('maintenance')).toBe('red')
  })

  it('未知状态回落 maintenance 文案（封闭集兜底，不得抛错）', () => {
    expect(aedStatusLabel('unknown' as AedStatus)).toBe(messages['zh-CN'].aed.status.maintenance)
  })
})

describe('F1 utils/map/adapter —— 薄适配层 + 无 Key 降级（PRD D2/D3）', () => {
  it('getMapKey() 在测试环境（无 VITE_AMAP_KEY）返回空串', () => {
    expect(getMapKey()).toBe('')
  })

  it('isMapEnabled() 无 Key ⇒ false（页面必须回落草图/列表，绝不白屏）', () => {
    expect(isMapEnabled()).toBe(false)
  })

  it('loadAmapSdk() 无 Key ⇒ reject(MapKeyMissingError)', async () => {
    await expect(loadAmapSdk()).rejects.toBeInstanceOf(MapKeyMissingError)
  })

  it('toMapMarkers：后端设备 → 厂商无关 MapMarker（含 tone 派生）', () => {
    const markers: MapMarker[] = toMapMarkers([
      dev({ id: 'a1', name: 'A', lat: 22.5, lng: 113.9, status: 'available' }),
      dev({ id: 'a2', name: 'B', lat: 22.6, lng: 114.0, status: 'in_use' }),
    ])
    expect(markers).toEqual([
      { id: 'a1', lat: 22.5, lng: 113.9, label: 'A', status: 'available', tone: 'green' },
      { id: 'a2', lat: 22.6, lng: 114.0, label: 'B', status: 'in_use', tone: 'amber' },
    ])
  })

  it('toMapMarkers：空/undefined 入参返回空数组（防崩溃）', () => {
    expect(toMapMarkers([])).toEqual([])
    expect(toMapMarkers(undefined as unknown as import('@/api/aed').AedDevice[])).toEqual([])
  })
})
