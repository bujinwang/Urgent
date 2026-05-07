<template>
  <view class="page-arrived">
    <!-- 顶栏 -->
    <view class="arrived-appbar">
      <text class="arrived-back" @click="goHome">‹</text>
      <text class="arrived-title">已到达</text>
    </view>

    <!-- 成功标识 -->
    <view class="arrived-hero">
      <view class="arrived-check">✓</view>
      <text class="arrived-headline">AED 已送达现场</text>
      <text class="arrived-sub">立即配合按压手进行贴片与轮替</text>
    </view>

    <!-- 操作指引卡片 -->
    <view class="arrived-cards">
      <!-- 贴片指引 -->
      <view class="arrived-card">
        <view class="arrived-card-num">1</view>
        <view class="arrived-card-body">
          <text class="arrived-card-title">贴电极片</text>
          <text class="arrived-card-desc">一片右胸上方 · 一片左侧腋下</text>
          <text class="arrived-card-note">AED 自动开机，按语音提示操作</text>
        </view>
      </view>

      <!-- 轮替指引 -->
      <view class="arrived-card">
        <view class="arrived-card-num">2</view>
        <view class="arrived-card-body">
          <text class="arrived-card-title">2 分钟后准备轮替</text>
          <text class="arrived-card-desc">告诉按压手"不要停，保持节奏"</text>
          <text class="arrived-card-note">利用分析心律间隙快速切换</text>
        </view>
      </view>

      <!-- 持续监护 -->
      <view class="arrived-card">
        <view class="arrived-card-num">3</view>
        <view class="arrived-card-body">
          <text class="arrived-card-title">持续监护至 120 到达</text>
          <text class="arrived-card-desc">记录按压轮替时间与 AED 电击次数</text>
          <text class="arrived-card-note">预计 120 还需 5 分钟到达</text>
        </view>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="arrived-actions">
      <view class="arrived-btn-primary" @click="goAedDetail">查看 AED 操作指引</view>
      <view class="arrived-btn-secondary" @click="goHome">返回首页</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useTaskStore } from '@/stores/task'
import { voice } from '@/utils/voice'

const taskStore = useTaskStore()

function goHome() {
  taskStore.finishMission()
  uni.switchTab({ url: '/pages/home/index' })
}

function goAedDetail() {
  uni.switchTab({ url: '/pages/aed/index' })
}

onMounted(() => {
  voice.speakSequence([
    { text: '已到达现场', rate: 1.05, pause: 400 },
    { text: '告诉按压手：继续按压，我来贴片', rate: 1.2, pitch: 1.1, pause: 800 },
    { text: '揭开 A E D 盖子，按语音提示贴电极片', rate: 1.05 },
  ])
})
</script>

<style lang="scss" scoped>
.page-arrived {
  background: linear-gradient(180deg, #1A0907 0%, #2A0F0C 100%);
  color: #fff;
  min-height: 100vh;
  padding-bottom: 60rpx;
}

/* 顶栏 */
.arrived-appbar {
  display: flex;
  align-items: center;
  padding: 28rpx 40rpx;
  gap: 24rpx;
}
.arrived-back {
  font-size: 48rpx;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.arrived-title {
  flex: 1;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 36rpx;
}

/* 成功标识 */
.arrived-hero {
  text-align: center;
  padding: 48rpx 40rpx 40rpx;
}
.arrived-check {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: var(--green);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  font-weight: 900;
  margin: 0 auto 28rpx;
  box-shadow: 0 16rpx 48rpx rgba(31, 138, 91, 0.4);
}
.arrived-headline {
  font-family: var(--serif);
  font-size: 44rpx;
  font-weight: 900;
  display: block;
  margin-bottom: 12rpx;
}
.arrived-sub {
  font-size: 26rpx;
  opacity: 0.7;
  display: block;
}

/* 操作指引卡片 */
.arrived-cards {
  padding: 0 40rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.arrived-card {
  display: flex;
  gap: 28rpx;
  align-items: flex-start;
  padding: 32rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
}
.arrived-card-num {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: var(--rescue-red);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 28rpx;
  flex-shrink: 0;
}
.arrived-card-body {
  flex: 1;
}
.arrived-card-title {
  font-family: var(--serif);
  font-size: 30rpx;
  font-weight: 700;
  display: block;
  margin-bottom: 8rpx;
}
.arrived-card-desc {
  font-size: 24rpx;
  opacity: 0.85;
  display: block;
  margin-bottom: 6rpx;
  line-height: 1.5;
}
.arrived-card-note {
  font-size: 22rpx;
  opacity: 0.5;
  display: block;
}

/* 操作按钮 */
.arrived-actions {
  padding: 48rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.arrived-btn-primary {
  width: 100%;
  padding: 36rpx;
  background: #C0392B;
  color: #fff;
  border-radius: 32rpx;
  font-family: var(--serif);
  font-size: 32rpx;
  font-weight: 700;
  text-align: center;
  box-shadow: 0 16rpx 48rpx rgba(192, 57, 43, 0.4);
}
.arrived-btn-secondary {
  width: 100%;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 28rpx;
  font-size: 28rpx;
  text-align: center;
}
</style>
