<template>
  <view class="page-atlas">
    <view class="atlas-grid">
      <view v-for="card in cards" :key="card.id"
        class="atlas-card" :class="{ featured: card.featured }"
        @click="showDetail(card.id)">
        <text class="atlas-card-num">{{ card.num }}</text>
        <text class="atlas-card-icon">{{ card.icon }}</text>
        <text class="atlas-card-title">{{ card.title }}</text>
        <text class="atlas-card-desc">{{ card.desc }}</text>
        <view class="atlas-card-badge" v-if="card.badge">{{ card.badge }}</view>
      </view>
    </view>

    <!-- AED 巡检快捷入口 -->
    <view class="atlas-patrol" @click="goAedPatrol">
      <text class="atlas-patrol-icon">🔍</text>
      <view class="atlas-patrol-body">
        <text class="atlas-patrol-title">AED 设备巡检</text>
        <text class="atlas-patrol-sub">每月 15 日是 AED 巡检日 · 前往打卡验证</text>
      </view>
      <text class="atlas-patrol-arrow">→</text>
    </view>
  </view>
</template>

<script setup lang="ts">
const cards = [
  { id: 'cpr', num: '01', icon: '❤️', title: '心脏骤停', desc: 'CPR + AED 全流程', featured: true },
  { id: 'choking', num: '02', icon: '🫁', title: '异物窒息', desc: '海姆立克急救法', badge: '分人群' },
  { id: 'aed', num: '03', icon: '⚡', title: 'AED 使用', desc: '自动体外除颤器' },
  { id: 'bleeding', num: '04', icon: '🩸', title: '出血止血', desc: '加压包扎+止血带' },
  { id: 'fracture', num: '05', icon: '🦴', title: '骨折固定', desc: '原位固定与搬运' },
  { id: 'epilepsy', num: '06', icon: '🧠', title: '癫痫急救', desc: '保护与侧卧位' },
  { id: 'psychological', num: '07', icon: '💬', title: '心理干预', desc: '情绪安抚与陪伴', badge: '新增' },
  { id: 'transport', num: '08', icon: '🚑', title: '伤员搬运', desc: '轴线翻身与平移', badge: '新增' },
]

function showDetail(id: string) {
  const routes: Record<string, string> = {
    cpr: '/pages/rescue/index',
    choking: '/pages/guide/index?type=heimlich',
    aed: '/pages/aed/index',
    bleeding: '/pages/guide/index?type=bleeding',
    fracture: '/pages/guide/index?type=fracture',
    epilepsy: '/pages/guide/index?type=seizure',
    psychological: '/pages/guide/index?type=psychological',
    transport: '/pages/guide/index?type=transport',
  }
  const url = routes[id]
  if (url) {
    if (id === 'aed') uni.switchTab({ url })
    else uni.navigateTo({ url })
  }
}

function goAedPatrol() {
  uni.switchTab({ url: '/pages/aed/index' })
}
</script>

<style lang="scss" scoped>
.page-atlas { padding: 40rpx; padding-bottom: 60rpx; }
.atlas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28rpx; margin-bottom: 32rpx; }
.atlas-card {
  background: #fff; border: 1px solid var(--line); border-radius: 32rpx;
  padding: 40rpx 32rpx; text-align: left; position: relative; overflow: hidden;
  &.featured { background: var(--rescue-red); color: #fff; border-color: var(--rescue-red);
    .atlas-card-num, .atlas-card-desc { color: rgba(255,255,255,0.85); }
  }
}
.atlas-card-num { font-family: var(--mono); font-size: 22rpx; letter-spacing: 2rpx; margin-bottom: 16rpx; display: block; }
.atlas-card-icon { font-size: 72rpx; margin-bottom: 24rpx; display: block; }
.atlas-card-title { font-family: var(--serif); font-size: 32rpx; font-weight: 700; margin-bottom: 8rpx; display: block; }
.atlas-card-desc { font-size: 22rpx; color: var(--ink-mute); line-height: 1.4; display: block; }
.atlas-card-badge { position: absolute; top: 16rpx; right: 16rpx; background: rgba(245,158,11,0.12); color: #D97606; font-size: 18rpx; font-family: var(--mono); font-weight: 700; padding: 4rpx 12rpx; border-radius: 10rpx; }
.atlas-card.featured .atlas-card-badge { background: rgba(255,255,255,0.2); color: #fff; }

.atlas-patrol {
  display: flex; align-items: center; gap: 20rpx;
  padding: 32rpx; background: linear-gradient(135deg, rgba(52,210,119,0.08), rgba(31,138,91,0.04));
  border: 1.5px solid rgba(52,210,119,0.2); border-radius: 28rpx;
}
.atlas-patrol-icon { font-size: 48rpx; }
.atlas-patrol-body { flex: 1; }
.atlas-patrol-title { font-family: var(--serif); font-size: 28rpx; font-weight: 700; color: var(--green); display: block; margin-bottom: 4rpx; }
.atlas-patrol-sub { font-size: 22rpx; color: var(--ink-mute); display: block; }
.atlas-patrol-arrow { font-size: 32rpx; color: var(--green); }
</style>
