<template>
  <view class="page-share">
    <view class="share-hero">
      <LifeSparkLogo :size="176" color-bg="var(--rescue-red)" />
      <text class="share-hero-title">急救侠</text>
      <text class="share-hero-sub">CPR + AED 救援网络\n有人倒下，别慌 · 跟着做就能帮</text>
      <view class="share-hero-badge">
        <view class="share-badge-dot" />
        <text>附近 3 名志愿者在线</text>
      </view>
      <view class="share-stats">
        <view class="share-stat"><text class="share-stat-num">2,340+</text><text class="share-stat-label">累计志愿者</text></view>
        <view class="share-stat"><text class="share-stat-num">89</text><text class="share-stat-label">成功救援</text></view>
        <view class="share-stat"><text class="share-stat-num">1km</text><text class="share-stat-label">AED覆盖</text></view>
      </view>
    </view>

    <view class="share-cta-section">
      <view class="share-cta-btn" @click="enterApp">
        <text class="share-cta-btn-text">立即进入救援网络</text>
      </view>
    </view>

    <view class="share-enter-btn" @click="enterApp">
      <text class="share-enter-icon">🚑</text>
      <text class="share-enter-text">进入急救侠应用</text>
      <text class="share-enter-sub">👆 点击直达首页</text>
    </view>

    <view class="share-features">
      <text class="share-section-title">我们能做什么</text>
      <view class="share-features-grid">
        <view v-for="f in features" :key="f.icon" class="share-feature-card">
          <text class="share-feature-icon">{{ f.icon }}</text>
          <text class="share-feature-title">{{ f.title }}</text>
          <text class="share-feature-desc">{{ f.desc }}</text>
        </view>
      </view>
    </view>

    <view class="share-footer">
      <text class="share-footer-brand">急救侠</text>
      <text> · 公共急救响应平台</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import LifeSparkLogo from '@/components/LifeSparkLogo/index.vue'

const features = [
  { icon: '❤', title: 'CPR指南', desc: '节拍器引导正确按压深度' },
  { icon: '📍', title: 'AED地图', desc: '实时查找最近设备' },
  { icon: '🔔', title: '紧急呼救', desc: '一键求救志愿者响应' },
  { icon: '📚', title: '急救图谱', desc: '常见急症处理指南' },
]

function enterApp() {
  uni.switchTab({ url: '/pages/home/index' })
}
</script>

<style lang="scss" scoped>
.page-share { background: linear-gradient(180deg, #FFF8F5 0%, var(--paper) 50%); min-height: 100vh; max-width: 480px; margin: 0 auto; }
.share-hero { background: linear-gradient(165deg, var(--rescue-red) 0%, var(--rescue-red-deep) 100%); color: #fff; padding: 96rpx 48rpx 128rpx; text-align: center; position: relative; overflow: hidden; }
.share-hero-title { font-family: var(--serif); font-size: 68rpx; font-weight: 900; letter-spacing: -2rpx; margin: 40rpx 0 20rpx; display: block; line-height: 1.2; }
.share-hero-sub { font-size: 28rpx; opacity: 0.9; line-height: 1.6; margin-bottom: 56rpx; display: block; }
.share-hero-badge { display: inline-flex; align-items: center; gap: 12rpx; background: rgba(255,255,255,0.15); backdrop-filter: blur(20rpx); padding: 16rpx 36rpx; border-radius: 48rpx; font-size: 24rpx; font-weight: 600; border: 1px solid rgba(255,255,255,0.2); }
.share-badge-dot { width: 16rpx; height: 16rpx; background: #FFEC8B; border-radius: 50%; box-shadow: 0 0 16rpx #FFEC8B; animation: blink 1.5s infinite; }
.share-stats { display: flex; justify-content: center; gap: 48rpx; padding: 48rpx 0 0; }
.share-stat { text-align: center; }
.share-stat-num { font-family: var(--mono); font-size: 56rpx; font-weight: 700; color: #fff; display: block; }
.share-stat-label { font-size: 22rpx; opacity: 0.75; margin-top: 8rpx; display: block; }

.share-cta-section { padding: 0 48rpx 32rpx; margin-top: -40rpx; position: relative; z-index: 2; }
.share-cta-btn { width: 100%; background: linear-gradient(135deg, var(--rescue-red) 0%, var(--rescue-red-deep) 100%); border-radius: 40rpx; padding: 48rpx; color: #fff; font-family: var(--serif); font-size: 40rpx; font-weight: 900; text-align: center; box-shadow: 0 24rpx 64rpx rgba(192,57,43,0.4); }
.share-enter-btn { display: block; width: 100%; margin: 0 48rpx 40rpx; background: #fff; border: 4rpx solid var(--rescue-red); border-radius: 32rpx; padding: 40rpx; text-align: center; }
.share-enter-icon { font-size: 64rpx; display: block; margin-bottom: 16rpx; }
.share-enter-text { font-family: var(--serif); font-size: 36rpx; font-weight: 700; color: var(--rescue-red); display: block; }
.share-enter-sub { font-size: 24rpx; color: var(--ink-mute); margin-top: 8rpx; display: block; }

.share-features { padding: 40rpx 48rpx; background: #fff; border-radius: 56rpx 56rpx 0 0; margin-top: -40rpx; position: relative; z-index: 3; }
.share-section-title { font-family: var(--serif); font-size: 44rpx; font-weight: 900; text-align: center; margin-bottom: 56rpx; display: block; }
.share-features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32rpx; }
.share-feature-card { background: var(--paper-warm); border: 1px solid var(--line); border-radius: 32rpx; padding: 36rpx 28rpx; text-align: center; }
.share-feature-icon { font-size: 64rpx; display: block; margin-bottom: 20rpx; }
.share-feature-title { font-family: var(--serif); font-size: 28rpx; font-weight: 700; display: block; margin-bottom: 8rpx; }
.share-feature-desc { font-size: 22rpx; color: var(--ink-mute); display: block; }

.share-footer { text-align: center; padding: 48rpx 48rpx 80rpx; color: var(--ink-mute); font-size: 24rpx; }
.share-footer-brand { font-family: var(--serif); font-weight: 700; color: var(--rescue-red); }
</style>
