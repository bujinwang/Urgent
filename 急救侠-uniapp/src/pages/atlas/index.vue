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
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
const cards = [
  { id: 'cpr', num: '01', icon: '❤️', title: '心脏骤停', desc: 'CPR + AED 全流程', featured: true },
  { id: 'choking', num: '02', icon: '🫁', title: '异物窒息', desc: '海姆立克急救法', featured: false },
  { id: 'aed', num: '03', icon: '⚡', title: 'AED 使用', desc: '自动体外除颤器', featured: false },
  { id: 'bleeding', num: '04', icon: '🩸', title: '出血止血', desc: '直接压迫止血法', featured: false },
  { id: 'fracture', num: '05', icon: '🦴', title: '骨折固定', desc: '原位固定与搬运', featured: false },
  { id: 'epilepsy', num: '06', icon: '🧠', title: '癫痫急救', desc: '保护与侧卧位', featured: false },
]

function showDetail(id: string) {
  const routes: Record<string, string> = {
    cpr: '/pages/rescue/index',
    choking: '/pages/guide/index?type=heimlich',
    aed: '/pages/aed/index',
    bleeding: '/pages/guide/index?type=bleeding',
    fracture: '/pages/guide/index?type=fracture',
    epilepsy: '/pages/guide/index?type=seizure',
  }
  const url = routes[id]
  if (url) {
    if (id === 'aed') uni.switchTab({ url })
    else uni.navigateTo({ url })
  }
}
</script>

<style lang="scss" scoped>
.page-atlas { padding: 40rpx; padding-bottom: 60rpx; }
.atlas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28rpx; }
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
</style>
