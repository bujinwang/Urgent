<template>
  <view class="lifespark-logo" :class="{ 'logo-pulse': pulse }" :style="logoStyle">
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <!-- 圆角底 -->
      <rect x="10" y="10" width="80" height="80" rx="24" :fill="colorBg" />
      <!-- 内环 -->
      <circle cx="50" cy="50" r="31" fill="none" :stroke="colorRing" stroke-width="3" />
      <!-- 心形 -->
      <path
        d="M50 73C36 60 28 52 28 42c0-7.2 5.3-12.5 12.4-12.5 4.4 0 7.8 2 9.6 5.2 1.8-3.2 5.2-5.2 9.6-5.2C66.7 29.5 72 34.8 72 42c0 10-8 18-22 31z"
        :fill="colorHeart"
      />
      <!-- 闪电火花 -->
      <path
        d="M54 27 39 53h11l-4 20 18-31H53l1-15z"
        :fill="colorSpark"
      />
      <!-- 小十字芯片 -->
      <circle cx="72" cy="28" r="10" :fill="colorChip" />
      <path
        d="M72 22v12M66 28h12"
        :stroke="colorChipCross"
        stroke-width="3.2"
        stroke-linecap="round"
      />
    </svg>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 底背景色，默认急救红 */
  colorBg?: string
  /** 心形颜色，默认白色 */
  colorHeart?: string
  /** 火花颜色，默认金色 */
  colorSpark?: string
  /** 十字底圆颜色，默认白色 */
  colorChip?: string
  /** 十字线条颜色，默认红色 */
  colorChipCross?: string
  /** 内环颜色，默认半透明白 */
  colorRing?: string
  /** 是否播放脉冲动画 */
  pulse?: boolean
  /** 自定义宽高 (rpx 或 px)，默认 64rpx */
  size?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  colorBg: '#C0392B',
  colorHeart: '#FFFFFF',
  colorSpark: '#F6C65B',
  colorChip: '#FFFFFF',
  colorChipCross: '#C0392B',
  colorRing: 'rgba(255,255,255,0.34)',
  pulse: true,
  size: '64rpx',
})

const logoStyle = computed(() => ({
  width: typeof props.size === 'number' ? `${props.size}rpx` : props.size,
  height: typeof props.size === 'number' ? `${props.size}rpx` : props.size,
}))
</script>

<style lang="scss" scoped>
.lifespark-logo {
  display: inline-flex;
  flex-shrink: 0;

  svg {
    width: 100%;
    height: 100%;
  }
}

.logo-pulse {
  animation: logoPulse 2s ease-in-out infinite;
  transform-origin: center;
}
</style>
