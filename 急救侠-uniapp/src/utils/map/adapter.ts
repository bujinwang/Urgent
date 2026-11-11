/**
 * 地图 SDK 薄适配层（PRD D2）—— 所有厂商 SDK 调用**只**经本文件；页面只依赖自有 `MapMarker` 模型。
 *
 * ── 合规约束（不可协商）────────────────────────────────────────────────────────
 * 1. 底图白名单：仅允许**腾讯地图 / 高德 / 百度 / 天地图**等具备国内测绘资质的服务商。
 *    禁止 Google Maps、Apple Maps、Bing 海外版、Mapbox、OpenStreetMap、Leaflet+OSM
 *    及任何无测绘资质的第三方瓦片。本次实现只用**腾讯地图 GL JS**（`map.qq.com/api/gljs`）。
 * 2. 坐标系：后端 `aed_devices.lat/lng` 已是 GCJ-02，腾讯地图同为 GCJ-02 ⇒ **坐标零转换**。
 *    本文件不含、也不得引入任何 WGS84 / BD-09 转换代码；`lat/lng` 原样透传。
 * 3. 领土表达：地图只渲染深圳市南山区局部公共 AED 点位，不涉及国界 / 台湾 / 南海绘制，
 *    不标注军事管制区等敏感坐标。AED 是公共设备点位，非个人位置数据。
 *
 * ── Key（PRD D4：绝不 embedding / preset / smuggle 任何有效 Key）──────────────
 * - Key 一律从构建期 `import.meta.env.VITE_TMAP_KEY` 读取，代码里**不得出现任何真实 Key 字面量**。
 * - 显式占位语义（仅说明用，**不是**要写进仓库的 Key）：
 *     key="请到腾讯位置服务开放平台申请自己的 Key 并替换此占位"
 *   真实运行时该参数由环境变量注入，见下方 `loadTMapSdk()` 的 URL 拼接。
 * - 申请入口与步骤：`https://lbs.qq.com/` → 控制台「应用管理 / 我的应用」
 *   → 创建**浏览器端**应用 → 拿到 Key → 配置 **Referer 域名白名单** →
 *   本地填 `.env.local` 的 `VITE_TMAP_KEY=`（该文件被 .gitignore 忽略，绝不入库）。
 * - ⚠️ 前端 Key 泄漏风险：浏览器端 Key 必然可被最终用户读取。
 *   **个人 / 公益自用请配 Referer 域名白名单；商用须改为后端代理鉴权**，不要把 Key 暴露在浏览器。
 * - ⚠️ 不要在**生产**适配层里写 WorkBuddy 本地预览 HTML 专用的「代理 + 安全配置」模式：
 *   那是离线预览专用的免 Key 方案，与「环境变量注入 Key」模式互斥，同时启用会导致底图白图。
 *   本文件生产实现只用环境变量注入 Key 一种模式。
 *
 * ── 腾讯 GL JS 命名规范（官方文档口径）────────────────────────────────────────
 * - `TMap.Map`、`TMap.LatLng`、`TMap.MultiMarker`（**图层类带 Multi**）、
 *   `TMap.MarkerStyle`（**样式类不带 Multi**）。
 * - `MultiMarker` 的 `geometries[].position` 必须是 `new TMap.LatLng(lat, lng)`（**先 lat 后 lng**）。
 * - **不要传 `mapStyleId`**：默认 Key 不支持自定义样式，传了会导致底图灰屏。
 * - 自定义 marker 图标只能用 inline `data:image/svg+xml,` 或 base64；
 *   **不得引用** `mapapi.qq.com/.../demo/images/` 等官方 demo 图片路径。
 *
 * ── 降级（PRD D3）────────────────────────────────────────────────────────────
 * - 无 Key ⇒ `isMapEnabled()` 为假 ⇒ 页面回落到现有草图 / 列表，**绝不白屏、绝不阻塞**。
 * - H5 的 SDK 加载失败 / 超时 / 实例化异常，一律由调用方 catch 后回落草图。
 * - 微信小程序走 uni-app 原生 `<map>`（免 Key、免 SDK），见 `toMpMarkers()`。
 */

import type { AedDevice } from '@/api/aed'
import { aedStatusLabel, aedStatusTone } from './status'

/** 厂商无关的地图点位模型（PRD D2：页面只依赖自有模型）。 */
export interface MapMarker {
  id: string
  lat: number
  lng: number
  label: string
  status: AedDevice['status']
  tone: 'green' | 'amber' | 'red'
}

/** 地图中心点（GCJ-02，lat/lng 顺序，零转换）。 */
export interface MapCenter {
  lat: number
  lng: number
}

/** uni-app 原生 `<map>` 的单个 marker（微信小程序免 Key 分支）。 */
export interface MpMarker {
  /** 微信小程序 marker 的 id 必须是 number（markertap 回调据其定位）。 */
  id: number
  latitude: number
  longitude: number
  title: string
  callout: {
    content: string
    color: string
    fontSize: number
    borderRadius: number
    bgColor: string
    padding: number
    display: 'BYCLICK' | 'ALWAYS'
  }
}

/** 构建期注入键名（腾讯位置服务「浏览器端」Key）。 */
export const MAP_KEY_ENV = 'VITE_TMAP_KEY'

/** tone → 语义色，与现有草图图钉配色对齐（绿 / 琥珀 / 红）。 */
const TONE_COLORS: Record<MapMarker['tone'], string> = {
  green: '#16A34A',
  amber: '#F59E0B',
  red: '#DC2626',
}

/**
 * 读构建期注入的腾讯 Key；仓库内不出现真实 Key。无 Key ⇒ 返回 ''。
 * 用宽松 cast 而非 `ImportMetaEnv` 声明，避免与 vite/client 的索引签名耦合。
 */
export function getMapKey(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    const v = env?.[MAP_KEY_ENV]
    return typeof v === 'string' ? v : ''
  } catch {
    return ''
  }
}

/** 是否启用 H5 真地图（Key 已配置）。为假 ⇒ 页面回落草图（PRD D3）。 */
export function isMapEnabled(): boolean {
  return getMapKey() !== ''
}

/**
 * 平台判据转出：`isMpWeixin()` 的**唯一事实源**在显式模块 `./platform`（可被 `vi.doMock` 驱动）。
 *
 * ⚠️ 刻意**不复用** `src/utils/platform.ts` 的 `isWechatMP`：它是「用条件编译指令包住
 * `return true`、后面紧跟 `return false`」的自执行函数；vitest 没有 uni 预处理 ⇒ 指令只是
 * 死注释 ⇒ `return true` 先执行（实测 `isWechatMP=true`、`isH5=true`、`getPlatform()='h5'`）。
 * 拿它做 `showRealMap` 分流会让测试宿主恒判「小程序」⇒ 草图 `v-else` 不渲染 ⇒
 * `guide-aed-i18n.test.ts` 的 `.aed-map-pokestop` 探针必红；更隐蔽的是「在自己的新用例里
 * mock 掉它 ⇒ 自测全绿、生产 H5 行为与测试分叉」。
 *
 * 也刻意**不写**条件编译指令做逻辑分支：这类注释在 vitest / happy-dom 里原样只是注释，
 * 两个分支会同时执行、测试全挂。平台分支只放在 `.vue` 模板条件编译里。
 * 注释里同样刻意不写出指令字面量（uni 预处理器指令正则非行首锚定，会被误当真实指令）。
 */
export { isMpWeixin } from './platform'

/** 无 Key 时抛出，供调用方转降级路径。 */
export class MapKeyMissingError extends Error {
  constructor() {
    super('腾讯位置服务 Key 未配置（VITE_TMAP_KEY 为空）—— 地图降级到草图')
    this.name = 'MapKeyMissingError'
  }
}

/** 腾讯 GL JS 全局对象的最小结构化视图（避免引入厂商 d.ts 依赖）。 */
interface TMapLatLngLike {
  lat: number
  lng: number
}

interface TMapMarkerStyleOptions {
  width: number
  height: number
  anchor: { x: number; y: number }
  src: string
}

interface TMapGeometry {
  id: string
  styleId: MapMarker['tone']
  position: TMapLatLngLike
  properties: { title: string }
}

interface TMapStatic {
  Map: new (el: HTMLElement, opts: { zoom: number; center: TMapLatLngLike }) => unknown
  LatLng: new (lat: number, lng: number) => TMapLatLngLike
  MarkerStyle: new (opts: TMapMarkerStyleOptions) => unknown
  MultiMarker: new (opts: {
    map: unknown
    styles: Record<string, unknown>
    geometries: TMapGeometry[]
  }) => unknown
}

/**
 * 读取 `window.TMap`（兼容被测环境用 `vi.stubGlobal('TMap', ...)` 挂到 globalThis 的情形）。
 * 读取失败一律返回 undefined，绝不抛错污染调用栈。
 */
function readTMap(): TMapStatic | undefined {
  try {
    const scope = globalThis as unknown as {
      TMap?: TMapStatic
      window?: { TMap?: TMapStatic }
    }
    return scope.TMap ?? scope.window?.TMap
  } catch {
    return undefined
  }
}

/**
 * 动态加载腾讯地图 GL JS（无 npm 依赖，走官方 loader script）。
 * - 无 Key ⇒ reject(MapKeyMissingError) ⇒ 调用方回落草图（不白屏）。
 * - 浏览器外（纯单测 / SSR，无 document）⇒ reject，避免 `document` 未定义。
 * - `window.TMap` 已在场 ⇒ 直接 resolve（重复调用不重复注入 script）。
 * - 10s 超时；`onload` / `onerror` 语义与原薄适配层保持一致。
 */
export function loadTMapSdk(key?: string): Promise<unknown> {
  const effective = key ?? getMapKey()
  if (!effective) return Promise.reject(new MapKeyMissingError())
  if (typeof document === 'undefined') return Promise.reject(new Error('腾讯地图 GL JS 仅可在浏览器加载'))

  const already = readTMap()
  if (already) return Promise.resolve(already)

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${encodeURIComponent(effective)}`
    script.async = true
    const timer = setTimeout(() => reject(new Error('腾讯地图 GL JS 加载超时')), 10000)
    script.onload = () => {
      clearTimeout(timer)
      const sdk = readTMap()
      if (sdk) resolve(sdk)
      else reject(new Error('腾讯地图 GL JS 加载成功但未暴露 window.TMap'))
    }
    script.onerror = () => {
      clearTimeout(timer)
      reject(new Error('腾讯地图 GL JS 加载失败（网络 / Key 无效）'))
    }
    document.head.appendChild(script)
  })
}

/**
 * 生成 inline `data:image/svg+xml,` 图钉（**不引用任何官方 demo 图片路径 / 本地资源**）。
 * `encodeURIComponent` 会把 `#` 编码成 `%23`，避免 data URI 里的片段标识符被截断。
 */
function markerPinSrc(color: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">' +
    '<path d="M16 0C7.2 0 0 7.2 0 16c0 11.2 16 26 16 26s16-14.8 16-26C32 7.2 24.8 0 16 0z" ' +
    `fill="${color}"/>` +
    '<circle cx="16" cy="16" r="6" fill="#FFFFFF"/>' +
    '</svg>'
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * 实例化腾讯 GL JS 地图并批量打点（PRD D2：厂商实例化从组件收进适配层）。
 *
 * - `center` / `markers` 均为**厂商无关**模型，坐标 GCJ-02 原样透传、零转换。
 * - 按 `tone` 建 3 个 `TMap.MarkerStyle`（绿 / 琥珀 / 红 inline SVG 图钉）。
 * - 用 `TMap.MultiMarker` 一次批量上图，不逐点 `map.add()`。
 * - **不传 `mapStyleId`**（默认 Key 不支持，会灰屏）。
 * - 返回该 map 实例，便于调用方后续扩展（当前页面不消费）。
 * - 任何前置条件缺失（SDK 未就绪 / 容器为空）都抛错，由组件 catch ⇒ `emit('fallback')`。
 */
export function createMap(el: HTMLElement | null, center: MapCenter, markers: MapMarker[]): unknown {
  const TMap = readTMap()
  if (!TMap) throw new Error('腾讯地图 GL JS 未就绪（window.TMap 缺失）')
  if (!el) throw new Error('腾讯地图容器不存在（容器需有确定高度）')

  const map = new TMap.Map(el, {
    zoom: 14,
    center: new TMap.LatLng(center.lat, center.lng),
  })

  const styles: Record<string, unknown> = {}
  for (const tone of ['green', 'amber', 'red'] as const) {
    styles[tone] = new TMap.MarkerStyle({
      width: 32,
      height: 42,
      anchor: { x: 16, y: 42 },
      src: markerPinSrc(TONE_COLORS[tone]),
    })
  }

  const geometries: TMapGeometry[] = (markers || []).map((m) => ({
    id: m.id,
    styleId: m.tone,
    position: new TMap.LatLng(m.lat, m.lng),
    properties: { title: m.label },
  }))

  new TMap.MultiMarker({ map, styles, geometries })
  return map
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

/**
 * 把后端设备列表映射为 uni-app 原生 `<map>` 的 markers（微信小程序免 Key 分支）。
 *
 * - 纯函数：不碰 DOM、不碰 SDK、不改入参；空 / undefined 入参返回空数组。
 * - **不引用任何本地图片文件**（项目无对应资源，避免 404）：用默认图钉 + 文字标注。
 * - 状态文字走唯一权威映射 `aedStatusLabel()`（随当前语言切换），语义色与 H5 图钉同源。
 * - 坐标非法（非有限数 / 越界）的点位直接跳过，避免原生 map 渲染异常。
 * - `id` 用 `index + 1` 的数值序号：微信小程序 marker id 必须是 number，且需在同一批内唯一。
 */
export function toMpMarkers(devices: AedDevice[]): MpMarker[] {
  const list = devices || []
  return list
    .filter((d) =>
      Number.isFinite(d.lat) && Number.isFinite(d.lng)
      && d.lat >= -90 && d.lat <= 90
      && d.lng >= -180 && d.lng <= 180
    )
    .map((d, index) => {
      const tone = aedStatusTone(d.status)
      return {
        id: index + 1,
        latitude: d.lat,
        longitude: d.lng,
        title: d.name,
        callout: {
          content: `${d.name} · ${aedStatusLabel(d.status)}`,
          color: '#FFFFFF',
          fontSize: 12,
          borderRadius: 8,
          bgColor: TONE_COLORS[tone],
          padding: 6,
          display: 'BYCLICK' as const,
        },
      }
    })
}
