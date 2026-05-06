<template>
  <view class="metronome-wrap">
    <view class="metronome" @click="$emit('reset')">
      <view class="metronome-ring" />
      <view class="metronome-ring metronome-ring-active" :class="{ paused: !running }" />
      <view class="metronome-center">
        <text class="metronome-bpm">{{ display }}</text>
        <text class="metronome-label">{{ label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Props {
  display?: string
  label?: string
  running?: boolean
}

withDefaults(defineProps<Props>(), {
  display: '准备',
  label: '点圆圈可重置',
  running: true,
})

defineEmits<{
  reset: []
}>()
</script>

<style lang="scss" scoped>
.metronome-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 0 48rpx;
}

.metronome {
  width: 480rpx;
  height: 480rpx;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metronome-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.metronome-ring-active {
  border: 3px solid var(--rescue-red);
  box-shadow: 0 0 80rpx rgba(192, 57, 43, 0.4);

  &:not(.paused) {
    animation: beat 0.545s ease-in-out infinite;
  }
}

.metronome-center {
  text-align: center;
  z-index: 2;
}

.metronome-bpm {
  font-family: var(--mono);
  font-size: 112rpx;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}

.metronome-label {
  font-size: 24rpx;
  opacity: 0.6;
  letter-spacing: 4rpx;
  margin-top: 8rpx;
  color: #fff;
  display: block;
}
</style>
