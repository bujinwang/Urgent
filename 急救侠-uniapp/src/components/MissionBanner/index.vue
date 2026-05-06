<template>
  <view class="mission-banner" @click="$emit('click')">
    <view class="mission-pulse" />
    <view class="mission-pulse mission-pulse-2" />
    <view class="mission-content">
      <view class="mission-tag">
        <view class="mission-dot" />
        <text>MISSION · 紧急任务</text>
        <text class="mission-countdown">{{ countdown }}s</text>
      </view>
      <text class="mission-title">{{ distance }}m 外 CPR 协作任务</text>
      <text class="mission-detail">系统正在召集 {{ volunteers }} 人小队 · 你负责 AED 准备</text>
      <view class="mission-cta">
        <text>立即查看</text>
        <text class="mission-arrow">→</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  distance?: number
  volunteers?: number
}

withDefaults(defineProps<Props>(), {
  distance: 100,
  volunteers: 3,
})

defineEmits<{ click: [] }>()

const countdown = ref(23)
let timer: number | null = null

onMounted(() => {
  timer = setInterval(() => {
    countdown.value = countdown.value > 0 ? countdown.value - 1 : 23
  }, 1000) as unknown as number
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.mission-banner {
  margin: 0 40rpx 32rpx;
  background: linear-gradient(135deg, #C0392B 0%, #8B2A1F 100%);
  color: #fff;
  padding: 36rpx 40rpx;
  border-radius: 40rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 24rpx 64rpx rgba(192, 57, 43, 0.35);
  border: 2px solid rgba(255, 107, 91, 0.6);
  transition: transform 0.15s;

  &:active { transform: scale(0.98); }
}

.mission-pulse {
  position: absolute;
  inset: -4rpx;
  border-radius: 40rpx;
  pointer-events: none;
  background: rgba(255, 107, 91, 0.5);
  animation: missionPulse 1.4s ease-in-out infinite;
  z-index: 0;
}

.mission-pulse-2 {
  background: rgba(255, 107, 91, 0.3);
  animation: missionPulse 1.4s ease-in-out infinite 0.5s;
}

.mission-content {
  position: relative;
  z-index: 1;
}

.mission-tag {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  background: rgba(0, 0, 0, 0.25);
  padding: 10rpx 24rpx;
  border-radius: 40rpx;
  font-family: var(--mono);
  font-size: 22rpx;
  font-weight: 600;
  letter-spacing: 3rpx;
  margin-bottom: 20rpx;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.mission-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #FFEC8B;
  box-shadow: 0 0 20rpx #FFEC8B;
  animation: blink 1s infinite;
  flex-shrink: 0;
}

.mission-countdown {
  margin-left: auto;
  padding-left: 16rpx;
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  color: #FFEC8B;
}

.mission-title {
  font-family: var(--serif);
  font-size: 44rpx;
  font-weight: 900;
  line-height: 1.2;
  margin-bottom: 12rpx;
  display: block;
}

.mission-detail {
  font-size: 24rpx;
  opacity: 0.85;
  margin-bottom: 28rpx;
  line-height: 1.5;
  display: block;
}

.mission-cta {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  background: #fff;
  color: var(--rescue-red);
  padding: 20rpx 36rpx;
  border-radius: 48rpx;
  font-family: var(--serif);
  font-size: 28rpx;
  font-weight: 700;
  animation: ctaPulse 1.2s infinite;
  box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
}

.mission-arrow {
  font-size: 32rpx;
}
</style>
