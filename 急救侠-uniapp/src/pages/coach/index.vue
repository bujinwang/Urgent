<template>
  <view class="page-coach">
    <!-- Header -->
    <view class="coach-header">
      <text class="coach-header-title">急救教练</text>
      <text class="coach-header-sub">找到合适的教练，提升急救技能</text>
      <view class="coach-stats-row">
        <view class="coach-stat">
          <text class="coach-stat-num">{{ coachStore.list.length }}</text>
          <text class="coach-stat-lbl">认证教练</text>
        </view>
        <view class="coach-stat">
          <text class="coach-stat-num">{{ coachStore.availableCoaches.length }}</text>
          <text class="coach-stat-lbl">可预约</text>
        </view>
      </view>
    </view>

    <!-- Coach List -->
    <view v-if="coachStore.loading" class="coach-loading">
      <text>加载中...</text>
    </view>
    <view v-else class="coach-list">
      <view
        v-for="coach in coachStore.list"
        :key="coach.id"
        class="coach-card"
        :class="{ unavailable: !coach.available }"
        @click="openDetail(coach.id)"
      >
        <view class="coach-card-top">
          <view class="coach-avatar" :style="{ background: tierGradient(coach.tier) }">
            {{ coach.avatar }}
          </view>
          <view class="coach-info">
            <view class="coach-name-row">
              <text class="coach-name">{{ coach.name }}</text>
              <view class="coach-tier" :style="{ background: coachStore.tierColor(coach.tier) }">
                {{ coachStore.tierLabel(coach.tier) }}
              </view>
              <view v-if="!coach.available" class="coach-busy-badge">暂不可约</view>
            </view>
            <text class="coach-city">{{ coach.city }}</text>
            <view class="coach-stats">
              <text class="coach-stat-text">{{ coach.rescueCount }} 次救援</text>
              <text class="coach-stat-text">·</text>
              <text class="coach-stat-text">{{ coach.traineeCount }} 位学员</text>
            </view>
          </view>
        </view>
        <!-- Specialties -->
        <view class="coach-tags">
          <view v-for="s in coach.specialties" :key="s" class="coach-tag">
            {{ coachStore.specialtyLabel(s) }}
          </view>
        </view>
      </view>
    </view>

    <!-- Empty state -->
    <view v-if="!coachStore.loading && coachStore.list.length === 0" class="coach-empty">
      <text>暂无可用的急救教练</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useCoachStore } from '@/stores/coach'

const coachStore = useCoachStore()

onMounted(() => {
  coachStore.loadList()
})

function tierGradient(tier: string) {
  const colors: Record<string, string> = {
    gold: 'linear-gradient(135deg,#D4A017,#8B6914)',
    silver: 'linear-gradient(135deg,#8BA3B5,#5A6B78)',
    bronze: 'linear-gradient(135deg,#B87333,#8B5220)',
    diamond: 'linear-gradient(135deg,#4A90E2,#2563EB)',
  }
  return colors[tier] || 'linear-gradient(135deg,#6B7280,#4B5563)'
}

function openDetail(id: string) {
  uni.navigateTo({ url: `/pages/coach/detail?id=${id}` })
}
</script>

<style lang="scss" scoped>
.page-coach {
  padding-bottom: 60rpx;
}

.coach-header {
  padding: 60rpx 40rpx 40rpx;
  background: linear-gradient(180deg, #EBF5FB 0%, transparent 100%);
}

.coach-header-title {
  font-family: var(--serif);
  font-size: 48rpx;
  font-weight: 900;
  color: var(--ink);
  display: block;
}

.coach-header-sub {
  font-size: 24rpx;
  color: var(--ink-mute);
  display: block;
  margin-top: 8rpx;
}

.coach-stats-row {
  display: flex;
  gap: 48rpx;
  margin-top: 32rpx;
}

.coach-stat {
  text-align: center;
}

.coach-stat-num {
  font-family: var(--mono);
  font-size: 40rpx;
  font-weight: 700;
  color: var(--ink);
  display: block;
}

.coach-stat-lbl {
  font-size: 20rpx;
  color: var(--ink-mute);
}

.coach-loading {
  padding: 80rpx;
  text-align: center;
  color: var(--ink-mute);
  font-size: 24rpx;
}

.coach-list {
  padding: 0 40rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.coach-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 24rpx;
  padding: 24rpx;
  transition: all 0.2s;

  &.unavailable {
    opacity: 0.55;
  }
}

.coach-card-top {
  display: flex;
  gap: 20rpx;
  align-items: center;
}

.coach-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--serif);
  font-size: 36rpx;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.coach-info {
  flex: 1;
  min-width: 0;
}

.coach-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.coach-name {
  font-family: var(--serif);
  font-size: 30rpx;
  font-weight: 700;
  color: var(--ink);
}

.coach-tier {
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 18rpx;
  color: #fff;
  font-weight: 600;
  font-family: var(--mono);
}

.coach-busy-badge {
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-size: 18rpx;
  color: var(--ink-mute);
  background: rgba(0, 0, 0, 0.06);
  font-family: var(--mono);
}

.coach-city {
  font-size: 22rpx;
  color: var(--ink-mute);
  display: block;
  margin-top: 4rpx;
}

.coach-stats {
  display: flex;
  gap: 8rpx;
  margin-top: 6rpx;
}

.coach-stat-text {
  font-size: 20rpx;
  color: var(--ink-mute);
  font-family: var(--mono);
}

.coach-tags {
  display: flex;
  gap: 12rpx;
  margin-top: 20rpx;
  flex-wrap: wrap;
}

.coach-tag {
  padding: 8rpx 20rpx;
  background: #EBF5FB;
  border-radius: 32rpx;
  font-size: 20rpx;
  color: #2C5282;
  font-weight: 600;
}

.coach-empty {
  padding: 120rpx 40rpx;
  text-align: center;
  color: var(--ink-mute);
  font-size: 24rpx;
}
</style>
