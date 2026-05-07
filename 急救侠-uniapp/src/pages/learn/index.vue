<template>
  <view class="page-learn">
    <!-- Tab 切换 -->
    <view class="learn-tabs">
      <view class="learn-tab" :class="{ active: tab === 'knowledge' }" @click="tab = 'knowledge'">急救知识</view>
      <view class="learn-tab" :class="{ active: tab === 'training' }" @click="tab = 'training'">实操训练</view>
    </view>

    <!-- 知识模块 -->
    <view v-if="tab === 'knowledge'">
      <view class="learn-banner">
        <text class="learn-banner-tag">推荐课程</text>
        <text class="learn-banner-title">CPR 心肺复苏全流程</text>
        <text class="learn-banner-meta">25 分钟 · 12840 人已学</text>
        <view class="learn-banner-btn" @click="tab = 'training'">开始训练 →</view>
      </view>
      <view class="lesson-list">
        <view v-for="item in lessons" :key="item.id" class="lesson-item">
          <view class="lesson-thumb">{{ item.thumb }}</view>
          <view class="lesson-info">
            <text class="lesson-title">{{ item.title }}</text>
            <view class="lesson-meta"><text>{{ item.duration }}</text><text>{{ item.students }}人</text></view>
          </view>
          <view class="lesson-progress" :class="{ todo: !item.done }">{{ item.done ? '✓' : '>' }}</view>
        </view>
      </view>
    </view>

    <!-- 训练模块 -->
    <view v-if="tab === 'training'">
      <!-- 演习模式提示 -->
      <view class="training-notice">
        <text class="training-notice-icon">⚠️</text>
        <view class="training-notice-body">
          <text class="training-notice-title">演习模式</text>
          <text class="training-notice-sub">以下训练仅为流程演习，不会真实拨打 120 或调度志愿者</text>
        </view>
      </view>

      <view class="train-grid">
        <view v-for="item in trainings" :key="item.id" class="train-card" @click="startTraining(item.id)">
          <text class="train-card-icon">{{ item.icon }}</text>
          <text class="train-card-title">{{ item.title }}</text>
          <text class="train-card-desc">{{ item.desc }}</text>
          <view class="train-card-tag">演习</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const tab = ref('knowledge')

const lessons = [
  { id: 1, thumb: 'CPR', title: '成人心肺复苏 (CPR)', duration: '20min', students: 12840, done: true },
  { id: 2, thumb: 'AED', title: 'AED 使用与电极片贴法', duration: '8min', students: 9620, done: true },
  { id: 3, thumb: '🧒', title: '婴儿/儿童 CPR 差异', duration: '12min', students: 5430, done: false },
  { id: 4, thumb: '🫁', title: '海姆立克急救法全解', duration: '6min', students: 8120, done: false },
]

const trainings = [
  { id: 'cpr', icon: '❤️', title: '节拍器训练', desc: '110 BPM 按压节奏 · 全流程演习' },
  { id: 'aed', icon: '⚡', title: 'AED 模拟', desc: '设备操作流程 · 演习' },
  { id: 'heimlich', icon: '🫁', title: '海姆立克', desc: '分人群手法练习 · 演习' },
  { id: 'scenario', icon: '🎯', title: '场景模拟', desc: '地铁站情境挑战 · 演习' },
]

function startTraining(id: string) {
  const routes: Record<string, string> = {
    cpr: '/pages/rescue/index?mode=drill',
    aed: '/pages/aed/index',
    heimlich: '/pages/guide/index?type=heimlich',
    scenario: '/pages/guide/index?type=bleeding',
  }
  const url = routes[id]
  if (url) {
    if (id === 'aed') uni.switchTab({ url })
    else uni.navigateTo({ url })
  }
}
</script>

<style lang="scss" scoped>
.page-learn { padding-bottom: 60rpx; }
.learn-tabs { display: flex; gap: 16rpx; padding: 32rpx 40rpx 24rpx; }
.learn-tab {
  flex: 1; padding: 24rpx; border-radius: 20rpx; text-align: center;
  font-size: 28rpx; font-weight: 600; border: 1px solid var(--line);
  color: var(--ink-mute); background: #fff;
  &.active { background: var(--rescue-red); color: #fff; border-color: var(--rescue-red); }
}
.learn-banner {
  margin: 0 40rpx 32rpx; background: linear-gradient(135deg, #1F2937 0%, #111827 100%);
  color: #fff; padding: 48rpx 40rpx; border-radius: 40rpx; position: relative; overflow: hidden;
}
.learn-banner-tag { font-family: var(--mono); font-size: 22rpx; letter-spacing: 3rpx; opacity: 0.7; margin-bottom: 16rpx; display: block; }
.learn-banner-title { font-family: var(--serif); font-size: 44rpx; font-weight: 700; line-height: 1.3; margin-bottom: 16rpx; display: block; }
.learn-banner-meta { font-size: 24rpx; opacity: 0.7; margin-bottom: 32rpx; display: block; }
.learn-banner-btn { display: inline-flex; align-items: center; gap: 12rpx; background: var(--rescue-red); color: #fff; padding: 20rpx 36rpx; border-radius: 48rpx; font-size: 26rpx; font-weight: 600; }
.lesson-list { padding: 0 40rpx; display: flex; flex-direction: column; gap: 20rpx; }
.lesson-item { display: flex; gap: 28rpx; padding: 28rpx; background: #fff; border: 1px solid var(--line); border-radius: 28rpx; align-items: center; }
.lesson-thumb { width: 160rpx; height: 112rpx; border-radius: 16rpx; background: linear-gradient(135deg, var(--rescue-red-deep), var(--rescue-red)); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28rpx; font-weight: 700; font-family: var(--mono); flex-shrink: 0; }
.lesson-info { flex: 1; }
.lesson-title { font-family: var(--serif); font-weight: 700; font-size: 28rpx; display: block; margin-bottom: 8rpx; }
.lesson-meta { font-size: 22rpx; color: var(--ink-mute); display: flex; gap: 16rpx; }
.lesson-progress { width: 64rpx; height: 64rpx; border-radius: 50%; border: 6rpx solid var(--green); display: flex; align-items: center; justify-content: center; color: var(--green); font-size: 28rpx; font-weight: 700; &.todo { border-color: var(--line); color: var(--ink-mute); } }

/* 演习模式提示 */
.training-notice {
  display: flex;
  gap: 20rpx;
  align-items: flex-start;
  margin: 0 40rpx 32rpx;
  padding: 28rpx 32rpx;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 24rpx;
}
.training-notice-icon {
  font-size: 36rpx;
  flex-shrink: 0;
}
.training-notice-body {
  flex: 1;
}
.training-notice-title {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #D97706;
  margin-bottom: 4rpx;
}
.training-notice-sub {
  font-size: 22rpx;
  color: var(--ink-mute);
  line-height: 1.5;
}

.train-grid { padding: 40rpx; display: grid; grid-template-columns: 1fr 1fr; gap: 28rpx; }
.train-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 32rpx;
  padding: 48rpx 32rpx;
  text-align: center;
  position: relative;
  overflow: hidden;
}
.train-card-icon { font-size: 64rpx; display: block; margin-bottom: 20rpx; }
.train-card-title { font-family: var(--serif); font-size: 30rpx; font-weight: 700; display: block; margin-bottom: 8rpx; }
.train-card-desc { font-size: 22rpx; color: var(--ink-mute); display: block; }

.train-card-tag {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  background: rgba(245, 158, 11, 0.12);
  color: #D97706;
  font-size: 18rpx;
  font-family: var(--mono);
  font-weight: 700;
  padding: 4rpx 12rpx;
  border-radius: 10rpx;
  letter-spacing: 1rpx;
}
</style>
