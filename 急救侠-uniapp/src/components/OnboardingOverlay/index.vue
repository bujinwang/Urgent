<template>
  <view v-if="visible" class="onboarding-overlay" @touchmove.prevent>
    <view class="onboarding-swiper-wrap">
      <swiper
        class="onboarding-swiper"
        :current="step"
        @change="onChange"
        circular
      >
        <swiper-item v-for="(slide, i) in slides" :key="i">
          <view class="onboarding-slide">
            <view class="onboarding-icon">{{ slide.icon }}</view>
            <text class="onboarding-title">{{ slide.title }}</text>
            <text class="onboarding-desc">{{ slide.desc }}</text>
          </view>
        </swiper-item>
      </swiper>
    </view>

    <view class="onboarding-footer">
      <view class="onboarding-dots">
        <view
          v-for="(_, i) in slides"
          :key="i"
          :class="['onboarding-dot', i === step ? 'active' : '']"
        />
      </view>
      <view class="onboarding-actions">
        <text class="onboarding-skip" @click="dismiss">跳过</text>
        <view class="onboarding-next" @click="next">
          <text>{{ step < slides.length - 1 ? '下一步' : '开始使用' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const ONBOARDING_SEEN_KEY = 'onboarding_seen'

const visible = ref(!uni.getStorageSync(ONBOARDING_SEEN_KEY))
const step = ref(0)

const slides = [
  {
    icon: '🚑',
    title: '一键 SOS 求救',
    desc: '遇到紧急情况时，一键发送 SOS 信号，附近的急救志愿者会立即收到通知并赶来支援。',
  },
  {
    icon: '⚡',
    title: 'AED 导航',
    desc: '实时查看附近 AED 设备位置、状态和可用时间。快速取用，争取黄金救援时间。',
  },
  {
    icon: '📖',
    title: '急救学习',
    desc: 'CPR 心肺复苏、AED 使用指南、止血包扎… 随时随地学习急救技能，成为生命守护者。',
  },
  {
    icon: '🔔',
    title: '推送通知',
    desc: '开启通知后，有新救援任务、演习或 AED 维护提醒时会第一时间通知您。',
  },
]

function onChange(e: any) {
  step.value = e.detail.current
}

function next() {
  if (step.value < slides.length - 1) {
    step.value++
  } else {
    dismiss()
  }
}

function dismiss() {
  uni.setStorageSync(ONBOARDING_SEEN_KEY, '1')
  visible.value = false
}
</script>

<style scoped>
.onboarding-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: linear-gradient(180deg, #2C3E50 0%, #1A2530 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 60rpx;
}

.onboarding-swiper-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  width: 100%;
}

.onboarding-swiper { width: 100%; height: 600rpx; }

.onboarding-slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  text-align: center;
}

.onboarding-icon { font-size: 160rpx; margin-bottom: 48rpx; }

.onboarding-title {
  font-family: var(--serif);
  font-size: 44rpx;
  font-weight: 700;
  color: #fff;
  margin-bottom: 24rpx;
  display: block;
}

.onboarding-desc {
  font-size: 28rpx;
  color: rgba(255,255,255,0.75);
  line-height: 1.6;
  display: block;
  max-width: 560rpx;
}

.onboarding-footer {
  width: 100%;
  padding: 40rpx 0 80rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40rpx;
}

.onboarding-dots { display: flex; gap: 16rpx; }

.onboarding-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  transition: all 0.3s;
}

.onboarding-dot.active {
  width: 48rpx;
  border-radius: 8rpx;
  background: var(--rescue-red);
}

.onboarding-actions {
  display: flex;
  align-items: center;
  gap: 40rpx;
  width: 100%;
  justify-content: center;
}

.onboarding-skip {
  font-size: 28rpx;
  color: rgba(255,255,255,0.5);
  padding: 20rpx 40rpx;
}

.onboarding-next {
  background: var(--rescue-red);
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  padding: 20rpx 60rpx;
  border-radius: 48rpx;
}
</style>
