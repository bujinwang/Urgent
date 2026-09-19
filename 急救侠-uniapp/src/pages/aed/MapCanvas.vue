<template>
  <view ref="containerRef" class="aed-realmap" :class="{ ready }">
    <view v-if="!ready && loading" class="aed-realmap-loading">{{ t('aed.mapLoading') }}</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { i18n } from '@/i18n'
import { isMapEnabled, loadAmapSdk, toMapMarkers } from '@/utils/map/adapter'
import type { AedDevice } from '@/api/aed'

/**
 * 真地图画布（PRD D2/D3）。
 * - 有 Key 且 SDK 加载成功 ⇒ 实例化高德地图 + 打点。
 * - 无 Key / SDK 加载失败 / 超时 ⇒ **立即 emit('fallback')**，由父页回落到草图/列表，**绝不白屏、绝不阻塞**。
 * 本组件只在浏览器 + Key 到位时真正渲染；测试环境（无 Key）只验证「会触发 fallback」。
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
  const f = devices.find((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
  return f ? { lat: f.lat, lng: f.lng } : { lat: 0, lng: 0 }
}

onMounted(async () => {
  if (!isMapEnabled()) {
    emit('fallback')
    return
  }
  loading.value = true
  try {
    const AMap = (await loadAmapSdk()) as unknown as {
      Map: new (el: HTMLElement, opts: Record<string, unknown>) => { add: (m: unknown) => void }
      Marker: new (opts: Record<string, unknown>) => unknown
    }
    const c = props.center ?? defaultCenter(props.devices)
    const map = new AMap.Map(containerRef.value as HTMLElement, { zoom: 14, center: [c.lng, c.lat] })
    for (const m of toMapMarkers(props.devices)) {
      const marker = new AMap.Marker({ position: [m.lng, m.lat], title: m.label })
      map.add(marker)
    }
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
