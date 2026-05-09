<template>
  <view class="page-running">
    <!-- 顶栏 -->
    <view class="running-appbar">
      <text class="running-back" @click="cancelMission">‹</text>
      <view class="running-tag">
        <view class="running-tag-dot" />
        <text>前往现场</text>
      </view>
    </view>

    <!-- 任务地图 -->
    <view class="running-map">
      <view class="running-map-grid" />
      <!-- 定点 Pin -->
      <view class="running-pin me" :style="markerStyle">你</view>
      <view class="running-pin aed-pin">⚡</view>
      <view class="running-pin sos-pin">SOS</view>
      <!-- SVG 路径线 -->
      <svg class="running-map-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="14" y1="58" x2="44" y2="33" stroke="#34D277" stroke-width="0.6" stroke-dasharray="2,1.5" />
        <line x1="44" y1="33" x2="90" y2="62" stroke="#F59E0B" stroke-width="0.6" stroke-dasharray="2,1.5" />
      </svg>
    </view>

    <!-- 距离 & 时间 -->
    <view class="running-stats">
      <view class="running-stat">
        <text class="running-stat-value">{{ displayDistance }}m</text>
        <text class="running-stat-label">剩余距离</text>
      </view>
      <view class="running-stat-divider" />
      <view class="running-stat">
        <text class="running-stat-value">{{ displayTime }}</text>
        <text class="running-stat-label">预计到达</text>
      </view>
    </view>

    <!-- 语音提示文本 -->
    <view class="running-voice-tip">
      <text>{{ voiceTip }}</text>
    </view>

    <!-- 底部操作 -->
    <view class="running-actions">
      <view class="running-btn-cancel" @click="cancelMission">放弃任务 · 转给他人</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/task'
import { voice } from '@/utils/voice'

const taskStore = useTaskStore()

const distance = ref(240)
const timeRemaining = ref(100)
const voiceTip = ref('已接受任务 · 请保持步伐')
let timer: number | null = null

const displayDistance = computed(() => Math.max(0, distance.value))
const displayTime = computed(() => {
  const t = Math.max(0, timeRemaining.value)
  const min = Math.floor(t / 60)
  const sec = t % 60
  return min > 0 ? `${min} 分 ${sec} 秒` : `${sec} 秒`
})

/** marker 沿两段路径移动：(12%,55%) → (42%,30%) → (92%,60%) */
const markerStyle = computed(() => {
  const progress = (240 - distance.value) / 240
  let x: number, y: number
  if (progress <= 0.4) {
    const p = progress / 0.4
    x = 12 + (42 - 12) * p
    y = 55 + (30 - 55) * p
  } else {
    const p = (progress - 0.4) / 0.6
    x = 42 + (92 - 42) * p
    y = 30 + (60 - 30) * p
  }
  return { left: x + '%', top: y + '%' }
})

function tick() {
  if (distance.value <= 0) {
    stopTimer()
    voice.stop()
    taskStore.arrive()
    uni.redirectTo({ url: '/pages/mission/arrived' })
    return
  }
  distance.value -= 6
  timeRemaining.value -= 1

  // 同步回 store
  taskStore.updateRunning(distance.value, timeRemaining.value)

  // 里程碑语音
  if (distance.value <= 180 && distance.value > 174) {
    voiceTip.value = '继续保持步伐，距离现场 180 米'
    voice.speak('继续保持步伐，距离现场 180 米', { rate: 1.1 })
  } else if (distance.value <= 120 && distance.value > 114) {
    voiceTip.value = '还有 120 米，准备好贴 AED 电极片'
    voice.speak('还有 120 米，准备好贴 A E D 电极片，并在两分钟后轮替', { rate: 1.05 })
  } else if (distance.value <= 30 && distance.value > 24) {
    voiceTip.value = '即将到达现场！大声喊：继续按压，我来贴片'
    voice.speak('即将到达现场，请大声喊：继续按压，我来贴片', { rate: 1.2, pitch: 1.1 })
  } else if (distance.value <= 0) {
    voiceTip.value = ''
  }
}

function startTimer() {
  stopTimer()
  timer = setInterval(tick, 1000) as unknown as number
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null }
}

function startVoiceGuide() {
  voice.speakSequence([
    { text: '已接受任务', rate: 1.05, pause: 200 },
    { text: '请保持步伐', rate: 1.1, pitch: 1.05, pause: 800 },
    { text: '现在边跑边听', rate: 1.05, pause: 400 },
    { text: '我会告诉您 AED 怎么用，以及什么时候轮替', rate: 1.05, pause: 1200 },
    { text: '揭开盖子', rate: 1.1, pause: 200 },
    { text: 'AED 自动开机', rate: 1.1, pause: 800 },
    { text: '电极片', rate: 1.1, pause: 100 },
    { text: '一片贴右胸上方', rate: 1.05, pause: 200 },
    { text: '一片贴左侧腋下', rate: 1.05, pause: 1000 },
    { text: '到现场后', rate: 1.05, pause: 200 },
    { text: '告诉压缩手', rate: 1.05, pause: 200 },
    { text: '继续按压不要停，我来贴片！', rate: 1.2, pitch: 1.1, pause: 800 },
    { text: '两分钟后准备轮替压缩', rate: 1.05 },
  ])
}

function cancelMission() {
  stopTimer()
  voice.stop()
  taskStore.finishMission()
  uni.showToast({ title: '已转给其他志愿者', icon: 'none' })
  setTimeout(() => {
    uni.switchTab({ url: '/pages/home/index' })
  }, 600)
}

onMounted(() => {
  // 同步 store 初始值
  distance.value = taskStore.runningDistance
  timeRemaining.value = taskStore.runningTimeRemaining
  startVoiceGuide()
  // 稍等语音开始后再启动计时（避免同时说话）
  setTimeout(() => startTimer(), 1500)
})

onUnmounted(() => {
  stopTimer()
  voice.stop()
})
</script>

<style lang="scss" scoped>
.page-running {
  background: linear-gradient(180deg, #1A0907 0%, #2A0F0C 100%);
  color: #fff;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* 顶栏 */
.running-appbar {
  display: flex;
  align-items: center;
  padding: 28rpx 40rpx;
  gap: 24rpx;
}
.running-back {
  font-size: 48rpx;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.running-tag {
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
.running-tag-dot {
  width: 16rpx;
  height: 16rpx;
  background: #FF6B5B;
  border-radius: 50%;
  animation: blink 1s infinite;
  flex-shrink: 0;
}

/* 任务地图 */
.running-map {
  margin: 20rpx 40rpx 0;
  background: linear-gradient(135deg, #2A2A2A, #1A1A1A);
  height: 440rpx;
  border-radius: 32rpx;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}
.running-map-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 60rpx 60rpx;
}
.running-pin {
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
  transition: left 0.5s ease, top 0.5s ease;

  &.me {
    left: 12%;
    top: 55%;
    background: #34D277;
    box-shadow: 0 4rpx 20rpx rgba(52, 210, 119, 0.5);
  }
  &.aed-pin {
    left: 42%;
    top: 30%;
    background: #F59E0B;
  }
  &.sos-pin {
    right: 8%;
    top: 60%;
    background: #C0392B;
    animation: pulse 1.4s infinite;
  }
}
.running-map-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

/* 距离 + 时间 */
.running-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48rpx;
  padding: 40rpx 40rpx 20rpx;
  flex-shrink: 0;
}
.running-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.running-stat-value {
  font-family: var(--mono);
  font-size: 56rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}
.running-stat-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--mono);
  letter-spacing: 2rpx;
}
.running-stat-divider {
  width: 1px;
  height: 80rpx;
  background: rgba(255, 255, 255, 0.12);
}

/* 语音提示 */
.running-voice-tip {
  margin: 24rpx 40rpx;
  padding: 28rpx 32rpx;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 24rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
  text-align: center;
  line-height: 1.6;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 底部操作 */
.running-actions {
  padding: 32rpx 40rpx calc(32rpx + env(safe-area-inset-bottom));
  flex-shrink: 0;
}
.running-btn-cancel {
  width: 100%;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.65);
  border: 1.5px solid rgba(255, 255, 255, 0.12);
  border-radius: 28rpx;
  font-size: 26rpx;
  text-align: center;
}

/* 动画 */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(192, 57, 43, 0.6); }
  50% { box-shadow: 0 0 0 24rpx rgba(192, 57, 43, 0); }
}
</style>
