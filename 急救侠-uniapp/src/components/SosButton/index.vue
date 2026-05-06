<template>
  <view class="sos-button" :class="[variant]" @click="$emit('click')">
    <view class="sos-pulse" />
    <view class="sos-pulse sos-pulse-2" />
    <view class="sos-content">
      <LifeSparkLogo
        :size="logoSize"
        :color-bg="logoColors.bg"
        :color-heart="logoColors.heart"
        :color-ring="logoColors.ring"
        :color-chip="logoColors.chip"
        :color-chip-cross="logoColors.chipCross"
      />
      <view class="sos-text">
        <text class="sos-title">{{ title }}</text>
        <text class="sos-sub">{{ subtitle }}</text>
      </view>
      <text v-if="showArrow" class="sos-arrow">→</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LifeSparkLogo from '@/components/LifeSparkLogo/index.vue'

interface Props {
  title?: string
  subtitle?: string
  variant?: 'primary' | 'dark'
  showArrow?: boolean
  size?: 'normal' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  title: '紧急处理',
  subtitle: '语音引导 · 召唤志愿者 · 联动 120',
  variant: 'primary',
  showArrow: true,
  size: 'normal',
})

defineEmits<{ click: [] }>()

const logoSize = computed(() => (props.size === 'large' ? '112rpx' : '80rpx'))

const logoColors = computed(() => {
  if (props.variant === 'dark') {
    return {
      bg: 'var(--rescue-red)',
      heart: '#FFFFFF',
      ring: 'rgba(255,255,255,0.34)',
      chip: '#FFFFFF',
      chipCross: 'var(--rescue-red)',
    }
  }
  // primary: white tile on red button
  return {
    bg: 'rgba(255,255,255,0.96)',
    heart: '#C0392B',
    ring: 'rgba(192,57,43,0.18)',
    chip: '#C0392B',
    chipCross: '#FFFFFF',
  }
})
</script>

<style lang="scss" scoped>
.sos-button {
  width: 100%;
  border: none;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s;
  cursor: pointer;

  &:active { transform: scale(0.98); }
}

/* primary = red bg (home SOS, rescue start) */
.sos-button.primary {
  background: linear-gradient(140deg, #C0392B 0%, #8B2A1F 100%);
  border-radius: 48rpx;
  padding: 48rpx 40rpx;
  color: #fff;
  box-shadow: 0 28rpx 88rpx rgba(192, 57, 43, 0.42);
}

/* dark variant (on dark bg rescue page) */
.sos-button.dark {
  background: linear-gradient(135deg, #C0392B 0%, #8B2A1F 100%);
  border: 2px solid rgba(255,107,91,0.5);
  border-radius: 48rpx;
  padding: 52rpx 44rpx;
  box-shadow: 0 32rpx 80rpx rgba(192,57,43,0.45);
}

/* Pulse layers */
.sos-pulse {
  position: absolute;
  inset: -4rpx;
  border-radius: 48rpx;
  pointer-events: none;
  background: rgba(255, 107, 91, 0.45);
  animation: missionPulse 1.9s ease-in-out infinite;
  z-index: 0;
}

.sos-pulse-2 {
  background: rgba(255, 107, 91, 0.28);
  animation: missionPulse 1.9s ease-in-out infinite 0.75s;
}

.sos-content {
  display: flex;
  align-items: center;
  gap: 36rpx;
  position: relative;
  z-index: 1;
}

.sos-text {
  flex: 1;
  text-align: left;
}

.sos-title {
  font-family: var(--serif);
  font-size: 52rpx;
  font-weight: 900;
  line-height: 1.2;
  margin-bottom: 10rpx;
  display: block;
}

.sos-sub {
  font-size: 24rpx;
  opacity: 0.82;
  line-height: 1.4;
  display: block;
}

.sos-arrow {
  font-size: 56rpx;
  opacity: 0.7;
  flex-shrink: 0;
}
</style>
