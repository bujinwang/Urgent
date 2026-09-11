<template>
  <view class="gov-stat">
    <text class="gov-stat-label">{{ label }}</text>
    <view class="gov-stat-value">
      <text v-if="value === null" class="gov-stat-null">数据积累中</text>
      <text v-else class="gov-stat-num">
        {{ formatted }}<text v-if="unit" class="gov-stat-unit">{{ unit }}</text>
      </text>
    </view>
    <text v-if="hint" class="gov-stat-hint">{{ hint }}</text>
  </view>
</template>

<script setup lang="ts">
/**
 * 政府看板指标卡（P2-8）。
 * `value === null` 一律渲染「数据积累中」——不显示 0，避免误导（冷启动/覆盖率缺口）。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: number | null
    unit?: string
    hint?: string
    digits?: number
  }>(),
  { unit: '', hint: '', digits: 1 }
)

const formatted = computed(() => {
  if (props.value === null) return ''
  return Number.isInteger(props.value) ? String(props.value) : props.value.toFixed(props.digits)
})
</script>

<style lang="scss" scoped>
.gov-stat {
  padding: 20rpx 24rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
}
.gov-stat-label { font-size: 22rpx; color: rgba(255, 255, 255, 0.5); display: block; }
.gov-stat-value { margin-top: 8rpx; }
.gov-stat-null { font-size: 24rpx; color: #f59e0b; }
.gov-stat-num { font-size: 36rpx; font-weight: 800; color: #fff; }
.gov-stat-unit { font-size: 22rpx; margin-left: 4rpx; color: rgba(255, 255, 255, 0.6); }
.gov-stat-hint { display: block; margin-top: 6rpx; font-size: 20rpx; color: rgba(255, 255, 255, 0.35); }
</style>
