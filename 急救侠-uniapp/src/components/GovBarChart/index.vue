<template>
  <view class="gov-bars">
    <view v-if="items.length === 0" class="gov-bars-empty">暂无数据</view>
    <view v-for="it in items" :key="it.label" class="gov-bar-row">
      <text class="gov-bar-label">{{ it.label }}</text>
      <view class="gov-bar-track">
        <view class="gov-bar-fill" :style="{ width: pct(it.value) + '%' }" />
      </view>
      <text class="gov-bar-value">{{ it.value }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 政府看板分布/趋势图（P2-8）——纯 CSS 条形，**不引入图表库**，跨端可用。
 * 既用于类型/时段/通道分布，也用于按日趋势（label=日期，value=样本数）。
 */
import { computed } from 'vue'

const props = defineProps<{
  items: Array<{ label: string; value: number }>
}>()

const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))

function pct(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.max(2, Math.round((v / max.value) * 100))
}
</script>

<style lang="scss" scoped>
.gov-bars { width: 100%; }
.gov-bars-empty { font-size: 24rpx; color: rgba(255, 255, 255, 0.35); padding: 12rpx 0; }
.gov-bar-row { display: flex; align-items: center; gap: 12rpx; padding: 8rpx 0; }
.gov-bar-label {
  width: 150rpx; flex-shrink: 0; font-size: 22rpx;
  color: rgba(255, 255, 255, 0.6); overflow: hidden; white-space: nowrap;
}
.gov-bar-track { flex: 1; height: 18rpx; background: rgba(255, 255, 255, 0.08); border-radius: 10rpx; overflow: hidden; }
.gov-bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #22d3ee); border-radius: 10rpx; }
.gov-bar-value { width: 90rpx; text-align: right; font-size: 22rpx; color: rgba(255, 255, 255, 0.75); }
</style>
