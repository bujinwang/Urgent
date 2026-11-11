<template>
  <!-- #ifdef MP-WEIXIN -->
  <!-- 微信小程序：uni-app 原生 <map>，免 Key、免 SDK；仅渲染深圳市南山区局部公共 AED 点位。 -->
  <!-- @vue-ignore -->
  <map
    class="aed-realmap"
    :latitude="mpCenter.lat"
    :longitude="mpCenter.lng"
    :markers="mpMarkers"
    :show-location="true"
    style="width: 100%; height: 100%"
  />
  <!-- #endif -->
  <!-- #ifndef MP-WEIXIN -->
  <!-- H5 / 其他：腾讯地图 GL JS（Key 由 VITE_TMAP_KEY 注入）；失败一律 emit('fallback')。 -->
  <view ref="containerRef" class="aed-realmap" :class="{ ready }">
    <view v-if="!ready && loading" class="aed-realmap-loading">{{ t('aed.mapLoading') }}</view>
  </view>
  <!-- #endif -->
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { i18n } from '@/i18n'
import {
  isMapEnabled,
  isMpWeixin,
  loadTMapSdk,
  createMap,
  toMapMarkers,
  toMpMarkers,
} from '@/utils/map/adapter'
import type { AedDevice } from '@/api/aed'

/**
 * 真地图画布（PRD D2 / D3）——平台分流：
 * - **模板**用 `.vue` 条件编译（MP-WEIXIN 的 ifdef / ifndef 两段，见上方 template）
 *   决定渲染原生 `<map>` 还是 DOM 容器；逻辑分支**不写**任何条件编译指令，
 *   因为 vitest / happy-dom 不处理条件编译注释，两个分支会同时执行、测试全挂。
 *   ⚠️ 注释里刻意不写出指令字面量：uni 预处理器指令正则非行首锚定，
 *   在 `<script>` 注释里出现字面量指令会被当成真实指令、造成条件块不配对。
 * - `<script setup>` 里的平台判据走显式模块 `@/utils/map/platform` 的 `isMpWeixin()`
 *   （经 adapter 转出，可被 `vi.doMock` 驱动）；测试环境（happy-dom，有 document、无 wx）
 *   恒为 false ⇒ 保持 **H5 语义**可测，绝不复用 `src/utils/platform.ts` 的 `isWechatMP`。
 *
 * 降级（PRD D3 硬约束）：
 * - 小程序：设备为空 / 坐标非法 ⇒ `emit('fallback')`（原生 map 免 Key，不加载任何 SDK）。
 * - H5：无 Key / SDK 加载失败 / 超时 / 实例化异常 ⇒ **一律 emit('fallback')**，
 *   由父页回落草图，**绝不白屏、绝不阻塞**。
 */
const props = defineProps<{
  devices: AedDevice[]
  center?: { lat: number; lng: number }
}>()
const emit = defineEmits<{ (e: 'fallback'): void }>()

const i18nGlobal = i18n.global as unknown as { t: (k: string) => string }
function t(key: string): string {
  return i18nGlobal.t(key)
}

const containerRef = ref<HTMLElement | null>(null)
const ready = ref(false)
const loading = ref(false)

function defaultCenter(devices: AedDevice[]): { lat: number; lng: number } {
  const f = (devices || []).find(
    (d) => Number.isFinite(d.lat) && Number.isFinite(d.lng)
      && d.lat >= -90 && d.lat <= 90 && d.lng >= -180 && d.lng <= 180
  )
  return f ? { lat: f.lat, lng: f.lng } : { lat: 0, lng: 0 }
}

/** H5 与小程序共用的中心点（props.center 优先，否则取首个合法设备坐标）。 */
const mapCenter = computed(() => props.center ?? defaultCenter(props.devices))

/** 小程序原生 `<map>` 的 markers（纯函数映射，无本地图片引用）。 */
const mpMarkers = computed(() => toMpMarkers(props.devices))

/** 小程序原生 `<map>` 的中心（与 mpMarkers 共享坐标口径）。 */
const mpCenter = computed(() => mapCenter.value)

/** 设备为空或坐标全部非法时，原生 map 无内容可画 ⇒ 必须回落草图，绝不白屏。 */
function hasRenderableDevices(): boolean {
  const c = mapCenter.value
  return mpMarkers.value.length > 0 && !(c.lat === 0 && c.lng === 0)
}

onMounted(async () => {
  // ── 微信小程序：原生 <map> 免 Key、免 SDK ──────────────────────────────
  if (isMpWeixin()) {
    if (!hasRenderableDevices()) {
      emit('fallback')
      return
    }
    ready.value = true
    return
  }

  // ── H5 / 其他：腾讯地图 GL JS ─────────────────────────────────────────
  if (!isMapEnabled()) {
    emit('fallback')
    return
  }
  loading.value = true
  try {
    await loadTMapSdk()
    createMap(containerRef.value, mapCenter.value, toMapMarkers(props.devices))
    ready.value = true
  } catch {
    loading.value = false
    emit('fallback')
  }
})
</script>

<style lang="scss" scoped>
.aed-realmap {
  width: 100%;
  /* 容器自身 100% 高度：父级 .aed-map-area 已固定 520rpx，必须保证高度否则地图不渲染 */
  height: 100%;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 36rpx;
  overflow: hidden;
  position: relative;
  &.ready { background: #0b1d12; }
}
.aed-realmap-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--mono);
}
</style>
