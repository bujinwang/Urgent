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
      <text class="mission-main-headline">{{ taskHeadline }}</text>
      <text class="mission-main-desc">{{ taskDesc }}</text>
      <view class="mission-squad-line">
        <text>小队 {{ squadFilled }}/{{ squadNeeded }}：</text>
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
      <text class="path-dot step-1">1</text><text>取 AED（{{ aedDistance }}m）</text>
      <text class="path-arrow">→</text>
      <text class="path-dot step-2">2</text><text>已远程开柜</text>
      <text class="path-arrow">→</text>
      <text class="path-dot step-3">3</text><text>送现场（{{ sceneDistance }}m）</text>
    </view>

    <!-- 现场摘要：只保留关键 3 条 -->
    <view class="mission-scene">
      <text class="mission-scene-item">📍 {{ sceneAddress }}</text>
      <text class="mission-scene-item">{{ sceneType }}</text>
      <text class="mission-scene-item">⏱ 每 2 分钟轮替 · 📞 120 预计 8 分钟到</text>
    </view>

    <!-- 操作按钮 -->
    <view class="mission-actions">
      <view class="mission-btn-accept" @click="showConfirmSheet">接受 · 立即出发</view>
      <view class="mission-btn-decline" @click="declineMission">无法前往，转给他人</view>
    </view>

    <!-- === 责任确认弹层 === -->
    <BottomSheet :visible="confirmVisible" dark title="任务确认" @close="confirmVisible = false">
      <view class="confirm-body">
        <!-- 责任与义务 -->
        <view class="confirm-warn-box">
          <view class="confirm-warn-header">
            <text>⚠️</text>
            <text class="confirm-warn-title">责任与义务确认</text>
          </view>
          <text class="confirm-warn-text">
            这是一个<strong>真实</strong>的急救任务。恶意抢单、虚假响应将导致救援资源浪费，情节严重者将承担法律责任及治安处罚。
          </text>
        </view>

        <!-- 系统将记录 -->
        <view class="confirm-records">
          <text class="confirm-records-title">系统将记录并开启：</text>
          <view class="confirm-records-list">
            <view class="confirm-record-item">
              <text class="confirm-record-check">✓</text>
              <text>您的实时地理位置 (GPS)</text>
            </view>
            <view class="confirm-record-item">
              <text class="confirm-record-check">✓</text>
              <text>AED 取用、到场与电击时间戳</text>
            </view>
            <view class="confirm-record-item">
              <text class="confirm-record-check">✓</text>
              <text>小队分工、轮替与现场记录同步</text>
            </view>
          </view>
        </view>

        <!-- 免责声明 -->
        <text class="confirm-disclaimer">
          点击"确认前往"即代表您接受 AED 准备/轮替角色并承诺尽力施救
        </text>

        <!-- 按钮 -->
        <view class="confirm-buttons">
          <view class="confirm-btn-cancel" @click="confirmVisible = false">取消</view>
          <view class="confirm-btn-go" @click="acceptAndGo">确认前往</view>
        </view>
      </view>
    </BottomSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/task'
import BottomSheet from '@/components/BottomSheet/index.vue'

const taskStore = useTaskStore()

const countdown = ref(30)
const confirmVisible = ref(false)
let timer: number | null = null

// --- 从 store 读取真实任务数据 ---
const task = computed(() => taskStore.activeTask)
const aedDistance = computed(() => {
  if (!task.value) return 80
  // 取 AED 距离约为任务距离的 30%
  return Math.round(task.value.distance * 0.3)
})
const sceneDistance = computed(() => task.value?.distance ?? 280)

const taskHeadline = computed(() => {
  const map: Record<string, string> = {
    cpr: 'CPR 协作 · 携带 AED',
    aed: '取 AED · 送到现场',
    assist: '协助救援现场',
  }
  return task.value ? (map[task.value.type] || '紧急任务') : '取 AED · 送到现场'
})

const taskDesc = computed(() => {
  if (!task.value) return '80m 取设备 → 280m 送现场'
  const aed = aedDistance.value
  const scene = sceneDistance.value
  return `${aed}m 取设备 → ${scene}m 送现场`
})

const squadFilled = computed(() => task.value?.volunteersResponded ?? 3)
const squadNeeded = computed(() => task.value?.volunteersNeeded ?? 3)
const sceneAddress = computed(() => task.value?.address ?? '事发地点')
const sceneType = computed(() => {
  if (!task.value) return '❤ 心脏骤停，CPR 进行中'
  const map: Record<string, string> = {
    cpr: '❤ 心脏骤停，CPR 进行中',
    aed: '⚡ 需要 AED 支援',
    assist: '🆘 需要急救协助',
  }
  return map[task.value.type] || '❤ 心脏骤停，CPR 进行中'
})

const initialCountdown = computed(() => {
  if (!task.value) return 30
  // 倒计时与距离相关：100m ≈ 23s, 动态区间 20-35s
  return Math.min(35, Math.max(20, Math.round(task.value.distance / 4)))
})

onMounted(() => {
  countdown.value = initialCountdown.value
  timer = setInterval(() => {
    countdown.value = countdown.value > 0 ? countdown.value - 1 : initialCountdown.value
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

/** 弹确认弹窗 */
function showConfirmSheet() {
  confirmVisible.value = true
}

/** 确认 → 接受 + 跳转跑动页 */
function acceptAndGo() {
  confirmVisible.value = false
  taskStore.acceptMission()
  uni.showToast({ title: '任务已接受 · 开始导航', icon: 'success' })
  setTimeout(() => {
    uni.navigateTo({ url: '/pages/mission/running' })
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

/* ============ 确认弹层内容 ============ */
.confirm-body {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.confirm-warn-box {
  background: rgba(192, 57, 43, 0.1);
  border: 1px solid rgba(192, 57, 43, 0.2);
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
}
.confirm-warn-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 16rpx;
  font-size: 28rpx;
}
.confirm-warn-title {
  color: var(--rescue-red);
  font-weight: 700;
  font-size: 28rpx;
}
.confirm-warn-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
}

.confirm-records {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
}
.confirm-records-title {
  font-size: 26rpx;
  font-weight: 700;
  display: block;
  margin-bottom: 20rpx;
}
.confirm-records-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.confirm-record-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.6);
}
.confirm-record-check {
  color: var(--green);
  font-weight: 700;
  font-size: 24rpx;
}

.confirm-disclaimer {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  line-height: 1.5;
}

.confirm-buttons {
  display: flex;
  gap: 20rpx;
  margin-top: 8rpx;
}
.confirm-btn-cancel {
  flex: 1;
  padding: 28rpx;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 24rpx;
  font-weight: 700;
  font-size: 28rpx;
  text-align: center;
}
.confirm-btn-go {
  flex: 1;
  padding: 28rpx;
  background: var(--rescue-red);
  color: #fff;
  border-radius: 24rpx;
  font-weight: 700;
  font-size: 28rpx;
  text-align: center;
  box-shadow: 0 12rpx 32rpx rgba(192, 57, 43, 0.35);
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
