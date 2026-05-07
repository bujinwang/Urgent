<template>
  <view class="page-mission">
    <!-- 顶栏 -->
    <view class="mission-appbar">
      <text class="mission-back" @click="goBack">‹</text>
      <text class="mission-title">紧急任务</text>
    </view>

    <!-- 紧急标识 + 倒计时 -->
    <view class="mission-tag-row">
      <view class="mission-tag">
        <view class="mission-tag-dot" />
        <text>倒计时 {{ countdown }}s</text>
      </view>
    </view>

    <!-- 主任务卡：标题 + 核心信息 + 小队一行 -->
    <view class="mission-main-card">
      <text class="mission-main-headline">取 AED · 送到现场</text>
      <text class="mission-main-desc">80m 取设备 → 280m 送现场</text>
      <view class="mission-squad-line">
        <text>小队已就位：</text>
        <text class="squad-role compress">按压</text>
        <text class="squad-role aed">你·AED</text>
        <text class="squad-role record">记录</text>
      </view>
    </view>

    <!-- 任务地图示意 -->
    <view class="mission-map">
      <view class="mission-map-grid" />
      <view class="mission-map-pin me">你</view>
      <view class="mission-map-pin aed-pin">⚡</view>
      <view class="mission-map-pin sos-pin">SOS</view>
      <svg class="mission-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="14" y1="58" x2="44" y2="33" stroke="#34D277" stroke-width="0.6" stroke-dasharray="2,1.5" />
        <line x1="44" y1="33" x2="90" y2="62" stroke="#F59E0B" stroke-width="0.6" stroke-dasharray="2,1.5" />
      </svg>
    </view>

    <!-- 路径：压缩为一行 -->
    <view class="mission-path-compact">
      <text class="path-dot step-1">1</text><text>取 AED（80m）</text>
      <text class="path-arrow">→</text>
      <text class="path-dot step-2">2</text><text>已远程开柜</text>
      <text class="path-arrow">→</text>
      <text class="path-dot step-3">3</text><text>送现场（280m）</text>
    </view>

    <!-- 现场摘要：只保留关键 3 条 -->
    <view class="mission-scene">
      <text class="mission-scene-item">👤 男，约60岁 · ❤ 心脏骤停，CPR 进行中</text>
      <text class="mission-scene-item">⏱ 每 2 分钟轮替 · 📞 120 预计 8 分钟到</text>
    </view>

    <!-- 操作按钮 -->
    <view class="mission-actions">
      <view class="mission-btn-accept" @click="acceptMission">接受 · 立即出发</view>
      <view class="mission-btn-decline" @click="declineMission">无法前往，转给他人</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/task'

const taskStore = useTaskStore()

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

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/home/index' })
}

function acceptMission() {
  taskStore.acceptMission()
  uni.showToast({ title: '任务已接受 · 开始导航', icon: 'success' })
  setTimeout(() => {
    uni.switchTab({ url: '/pages/aed/index' })
  }, 600)
}

function declineMission() {
  taskStore.finishMission()
  uni.showToast({ title: '已转给其他志愿者', icon: 'none' })
  setTimeout(() => {
    uni.switchTab({ url: '/pages/home/index' })
  }, 600)
}
</script>

<style lang="scss" scoped>
.page-mission {
  background: linear-gradient(180deg, #1A0907 0%, #2A0F0C 100%);
  color: #fff;
  min-height: 100vh;
  padding-bottom: 80rpx;
}

/* 顶栏 */
.mission-appbar {
  display: flex;
  align-items: center;
  padding: 28rpx 40rpx;
  gap: 24rpx;
  text { color: #fff; }
}
.mission-back {
  font-size: 48rpx;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mission-title {
  flex: 1;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 36rpx;
}

/* 紧急标识 */
.mission-tag-row {
  text-align: center;
  padding: 16rpx 40rpx 0;
}
.mission-tag {
  display: inline-flex;
  align-items: center;
  gap: 16rpx;
  background: rgba(192, 57, 43, 0.2);
  border: 1px solid rgba(192, 57, 43, 0.5);
  padding: 12rpx 28rpx;
  border-radius: 40rpx;
  font-family: var(--mono);
  font-size: 22rpx;
  letter-spacing: 4rpx;
  color: #FF8B5B;
}
.mission-tag-dot {
  width: 16rpx;
  height: 16rpx;
  background: #FF6B5B;
  border-radius: 50%;
  animation: blink 1s infinite;
  flex-shrink: 0;
}

/* 主任务卡 */
.mission-main-card {
  margin: 24rpx 40rpx 0;
  background: linear-gradient(135deg, rgba(192, 57, 43, 0.25), rgba(139, 42, 31, 0.2));
  border: 1.5px solid rgba(192, 57, 43, 0.5);
  border-radius: 40rpx;
  padding: 36rpx 40rpx;
  text-align: center;
}
.mission-main-headline {
  font-family: var(--serif);
  font-size: 52rpx;
  font-weight: 900;
  line-height: 1.3;
  margin-bottom: 12rpx;
  display: block;
}
.mission-main-desc {
  font-size: 26rpx;
  opacity: 0.85;
  display: block;
  margin-bottom: 20rpx;
}
.mission-squad-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  font-size: 22rpx;
  opacity: 0.8;
}
.squad-role {
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 700;
  font-size: 20rpx;
  &.compress { background: #C0392B; }
  &.aed { background: #F59E0B; color: #1A0907; }
  &.record { background: #4A90E2; }
}

/* 任务地图 */
.mission-map {
  margin: 32rpx 40rpx;
  background: linear-gradient(135deg, #2A2A2A, #1A1A1A);
  height: 320rpx;
  border-radius: 32rpx;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.mission-map-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 60rpx 60rpx;
}
.mission-map-pin {
  position: absolute;
  width: 64rpx;
  height: 64rpx;
  border: 4rpx solid #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
  z-index: 2;
  &.me { left: 12%; top: 55%; background: #34D277; }
  &.aed-pin { left: 42%; top: 30%; background: #F59E0B; }
  &.sos-pin { right: 8%; top: 60%; background: #C0392B; animation: pulse 1.4s infinite; }
}
.mission-map-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

/* 路径（紧凑一行） */
.mission-path-compact {
  margin: 0 40rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 24rpx;
  opacity: 0.85;
  flex-wrap: wrap;
  justify-content: center;
}
.path-dot {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 22rpx;
  flex-shrink: 0;
  &.step-1 { background: #34D277; }
  &.step-2 { background: #F59E0B; }
  &.step-3 { background: #C0392B; }
}
.path-arrow {
  color: #34D277;
  font-size: 28rpx;
}

/* 现场摘要 */
.mission-scene {
  margin: 32rpx 40rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
}
.mission-scene-item {
  font-size: 26rpx;
  line-height: 2;
  opacity: 0.85;
  display: block;
}

/* 操作按钮 */
.mission-actions {
  padding: 0 40rpx 48rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.mission-btn-accept {
  width: 100%;
  padding: 36rpx;
  background: #C0392B;
  color: #fff;
  border-radius: 32rpx;
  font-family: var(--serif);
  font-size: 34rpx;
  font-weight: 700;
  text-align: center;
  box-shadow: 0 16rpx 48rpx rgba(192, 57, 43, 0.4);
}
.mission-btn-decline {
  width: 100%;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.8);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 28rpx;
  font-size: 28rpx;
  text-align: center;
}
</style>
