import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setLocale } from '@/i18n'
import { messages } from '@/locales'
import {
  aedStatusLabel,
  aedStatusTone,
  type AedStatus,
} from '@/utils/map/status'
import {
  MAP_KEY_ENV,
  isMapEnabled,
  isMpWeixin,
  getMapKey,
  loadTMapSdk,
  toMapMarkers,
  toMpMarkers,
  createMap,
  MapKeyMissingError,
  type MapMarker,
} from '@/utils/map/adapter'

// 仅结构必要的字段；运行时 toMapMarkers / toMpMarkers 只读取 id/lat/lng/name/status。
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
  beforeEach(() => setLocale('zh-CN'))
  afterEach(() => {
    setLocale('zh-CN')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('MAP_KEY_ENV 已切到腾讯位置服务 VITE_TMAP_KEY（不得再是高德 VITE_AMAP_KEY）', () => {
    expect(MAP_KEY_ENV).toBe('VITE_TMAP_KEY')
    expect(MAP_KEY_ENV).not.toContain('AMAP')
  })

  it('getMapKey() 在测试环境（无 VITE_TMAP_KEY）返回空串', () => {
    expect(getMapKey()).toBe('')
  })

  it('isMapEnabled() 无 Key ⇒ false（页面必须回落草图/列表，绝不白屏）', () => {
    expect(isMapEnabled()).toBe(false)
  })

  it('isMpWeixin() 在 H5 / vitest 语义下恒 false（有 document、无 wx）', () => {
    expect(isMpWeixin()).toBe(false)
  })

  it('isMpWeixin() 用 uniPlatform 权威判据识别小程序 / H5（含 DOM 垫片的新运行时）', () => {
    vi.stubGlobal('uni', { getSystemInfoSync: () => ({ uniPlatform: 'mp-weixin' }) })
    expect(isMpWeixin()).toBe(true)
    vi.stubGlobal('uni', { getSystemInfoSync: () => ({ uniPlatform: 'web' }) })
    expect(isMpWeixin()).toBe(false)
    vi.unstubAllGlobals()
    expect(isMpWeixin()).toBe(false)
  })

  it('isMpWeixin() 无 uni API 时回落到 wx + 无 DOM 判据，且异常兜底 H5 语义', () => {
    vi.stubGlobal('uni', undefined)
    vi.stubGlobal('wx', { getSystemInfoSync: () => ({}) })
    vi.stubGlobal('document', undefined)
    expect(isMpWeixin()).toBe(true)
    vi.stubGlobal('document', {})
    expect(isMpWeixin()).toBe(false)
    vi.unstubAllGlobals()
    expect(isMpWeixin()).toBe(false)
  })

  it('loadTMapSdk() 无 Key ⇒ reject(MapKeyMissingError)，且文案指向新环境变量', async () => {
    const err = await loadTMapSdk().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MapKeyMissingError)
    expect((err as Error).message).toContain('VITE_TMAP_KEY')
    expect((err as Error).message).toContain('腾讯')
    expect((err as Error).message).not.toContain('VITE_AMAP_KEY')
  })

  it('loadTMapSdk(key) 注入腾讯 GL JS script（Key 只来自入参/环境变量，源码不内嵌有效 Key）', async () => {
    const fakeScript = {
      src: '',
      async: false,
      onload: null as null | (() => void),
      onerror: null as null | (() => void),
    }
    const createSpy = vi.spyOn(document, 'createElement')
      .mockReturnValue(fakeScript as unknown as HTMLScriptElement)
    const appendSpy = vi.spyOn(document.head, 'appendChild')
      .mockReturnValue(fakeScript as unknown as HTMLScriptElement)

    const pending = loadTMapSdk('PLACEHOLDER_KEY_FROM_ENV')
    expect(fakeScript.src).toContain('https://map.qq.com/api/gljs?v=1.exp&key=')
    expect(fakeScript.src).toContain('PLACEHOLDER_KEY_FROM_ENV')
    expect(fakeScript.src).not.toContain('webapi.amap.com')
    expect(fakeScript.src).not.toContain('AMap')

    vi.stubGlobal('TMap', { Map: vi.fn(), LatLng: vi.fn(), MarkerStyle: vi.fn(), MultiMarker: vi.fn() })
    fakeScript.onload?.()
    await expect(pending).resolves.toBeTruthy()
    createSpy.mockRestore()
    appendSpy.mockRestore()
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

describe('F1 utils/map/adapter —— toMpMarkers（微信小程序原生 <map>，免 Key）', () => {
  beforeEach(() => setLocale('zh-CN'))
  afterEach(() => setLocale('zh-CN'))

  it('正常映射：id/latitude/longitude/title + 状态文字 callout，坐标顺序为 lat→latitude / lng→longitude', () => {
    const markers = toMpMarkers([
      dev({ id: 'a1', name: 'AED-A', lat: 22.517, lng: 113.947, status: 'available' }),
      dev({ id: 'a2', name: 'AED-B', lat: 22.520, lng: 113.950, status: 'in_use' }),
      dev({ id: 'a3', name: 'AED-C', lat: 22.523, lng: 113.953, status: 'maintenance' }),
    ])
    expect(markers).toHaveLength(3)
    expect(markers[0]).toMatchObject({
      id: 1, latitude: 22.517, longitude: 113.947, title: 'AED-A',
    })
    expect(markers[1].latitude).toBe(22.520)
    expect(markers[1].longitude).toBe(113.950)
    expect(markers[2].latitude).toBe(22.523)
    expect(markers[2].longitude).toBe(113.953)
    expect(markers.every((m) => typeof m.id === 'number')).toBe(true)
  })

  it('状态文字随语言切换，且三值各有确定输出', () => {
    const devices = [
      dev({ status: 'available' }),
      dev({ status: 'in_use' }),
      dev({ status: 'maintenance' }),
    ]
    setLocale('zh-CN')
    expect(toMpMarkers(devices).map((m) => m.callout.content)).toEqual([
      expect.stringContaining(messages['zh-CN'].aed.status.available),
      expect.stringContaining(messages['zh-CN'].aed.status.inUse),
      expect.stringContaining(messages['zh-CN'].aed.status.maintenance),
    ])
    setLocale('en-US')
    expect(toMpMarkers(devices).map((m) => m.callout.content)).toEqual([
      expect.stringContaining(messages['en-US'].aed.status.available),
      expect.stringContaining(messages['en-US'].aed.status.inUse),
      expect.stringContaining(messages['en-US'].aed.status.maintenance),
    ])
  })

  it('空数组 / undefined 入参返回空数组（防崩溃）', () => {
    expect(toMpMarkers([])).toEqual([])
    expect(toMpMarkers(undefined as unknown as import('@/api/aed').AedDevice[])).toEqual([])
  })

  it('坐标非法（NaN / 越界）的点位被跳过，且不引用任何本地/官方 demo 图片', () => {
    const markers = toMpMarkers([
      dev({ id: 'ok', lat: 22.5, lng: 113.9 }),
      dev({ id: 'nan', lat: Number.NaN, lng: 113.9 }),
      dev({ id: 'oob', lat: 999, lng: 113.9 }),
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0].latitude).toBe(22.5)
    const serialized = JSON.stringify(markers)
    expect(serialized).not.toContain('iconPath')
    expect(serialized).not.toContain('mapapi.qq.com')
    expect(serialized).not.toContain('/static/')
  })

  it('tone 语义色与草图一致：绿 #16A34A / 琥珀 #F59E0B / 红 #DC2626', () => {
    const colors = toMpMarkers([
      dev({ status: 'available' }),
      dev({ status: 'in_use' }),
      dev({ status: 'maintenance' }),
    ]).map((m) => m.callout.bgColor)
    expect(colors).toEqual(['#16A34A', '#F59E0B', '#DC2626'])
  })
})

describe('F1 utils/map/adapter —— createMap（腾讯 GL JS 实例化，PRD D2）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  /** 构造最小 TMap mock；四个构造器均用 vi.fn 记录调用参数。 */
  function makeTMapMock() {
    const LatLng = vi.fn(function TLatLng(this: { lat: number; lng: number }, lat: number, lng: number) {
      this.lat = lat
      this.lng = lng
    })
    const Map = vi.fn(function TMapCtor(_el: unknown, _opts: unknown) { /* 记录调用即可 */ })
    const MarkerStyle = vi.fn(function TMarkerStyle(_opts: unknown) { /* 记录调用即可 */ })
    const MultiMarker = vi.fn(function TMultiMarker(_opts: unknown) { /* 记录调用即可 */ })
    return { Map, LatLng, MarkerStyle, MultiMarker }
  }

  it('TMap.Map / LatLng / MultiMarker / MarkerStyle 被调用；geometries 数量正确、坐标 lat/lng 顺序正确', () => {
    const TMap = makeTMapMock()
    vi.stubGlobal('TMap', TMap)
    const el = document.createElement('div')
    const center = { lat: 22.517, lng: 113.947 }
    const markers: MapMarker[] = [
      { id: 'a1', lat: 22.51, lng: 113.94, label: 'A', status: 'available', tone: 'green' },
      { id: 'a2', lat: 22.52, lng: 113.95, label: 'B', status: 'in_use', tone: 'amber' },
      { id: 'a3', lat: 22.53, lng: 113.96, label: 'C', status: 'maintenance', tone: 'red' },
    ]

    const map = createMap(el, center, markers)

    expect(TMap.Map).toHaveBeenCalledTimes(1)
    expect(TMap.Map.mock.calls[0][0]).toBe(el)
    const mapOpts = TMap.Map.mock.calls[0][1] as Record<string, unknown>
    expect(mapOpts.zoom).toBe(14)
    expect((mapOpts.center as { lat: number; lng: number }).lat).toBe(22.517)
    expect((mapOpts.center as { lat: number; lng: number }).lng).toBe(113.947)
    expect(map).toBeTruthy()

    // 中心点 1 次 + 每个 marker 1 次；中心必须是 (lat, lng) 而非 (lng, lat)
    expect(TMap.LatLng).toHaveBeenCalledTimes(4)
    expect(TMap.LatLng.mock.calls[0]).toEqual([22.517, 113.947])
    expect(TMap.LatLng.mock.calls[1]).toEqual([22.51, 113.94])

    expect(TMap.MarkerStyle).toHaveBeenCalledTimes(3)
    expect(TMap.MultiMarker).toHaveBeenCalledTimes(1)
    const multiOpts = TMap.MultiMarker.mock.calls[0][0] as {
      styles: Record<string, unknown>
      geometries: Array<{
        id: string
        styleId: string
        position: { lat: number; lng: number }
      }>
    }
    expect(Object.keys(multiOpts.styles).sort()).toEqual(['amber', 'green', 'red'])
    expect(multiOpts.geometries).toHaveLength(3)
    expect(multiOpts.geometries.map((g) => g.id)).toEqual(['a1', 'a2', 'a3'])
    expect(multiOpts.geometries.map((g) => g.styleId)).toEqual(['green', 'amber', 'red'])
    expect(multiOpts.geometries[0].position).toEqual({ lat: 22.51, lng: 113.94 })
  })

  it('不传 mapStyleId（默认 Key 不支持 ⇒ 会灰屏）；marker 图标只用 inline data URI', () => {
    const TMap = makeTMapMock()
    vi.stubGlobal('TMap', TMap)
    createMap(document.createElement('div'), { lat: 22.5, lng: 113.9 }, [
      { id: 'a1', lat: 22.5, lng: 113.9, label: 'A', status: 'available', tone: 'green' },
    ])

    const mapOpts = TMap.Map.mock.calls[0][1] as Record<string, unknown>
    expect(mapOpts).not.toHaveProperty('mapStyleId')

    const srcs = TMap.MarkerStyle.mock.calls.map((c) => (c[0] as { src: string }).src)
    expect(srcs).toHaveLength(3)
    for (const src of srcs) {
      expect(src.startsWith('data:image/svg+xml,')).toBe(true)
      expect(src).not.toContain('mapapi.qq.com')
      expect(src).not.toContain('/static/')
    }
    const decoded = srcs.map((s) => decodeURIComponent(s)).join('')
    expect(decoded).toContain('#16A34A')
    expect(decoded).toContain('#F59E0B')
    expect(decoded).toContain('#DC2626')
  })

  it('SDK 未就绪 / 容器为空 ⇒ 抛错（由组件 catch 转 fallback，绝不白屏）', () => {
    expect(() => createMap(document.createElement('div'), { lat: 0, lng: 0 }, [])).toThrow()
    const TMap = makeTMapMock()
    vi.stubGlobal('TMap', TMap)
    expect(() => createMap(null, { lat: 0, lng: 0 }, [])).toThrow()
    expect(TMap.Map).not.toHaveBeenCalled()
  })
})
