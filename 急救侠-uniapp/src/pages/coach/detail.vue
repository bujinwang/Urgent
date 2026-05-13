<template>
  <view class="page-coach-detail">
    <!-- Loading -->
    <view v-if="coachStore.loading" class="detail-loading">
      <text>加载中...</text>
    </view>

    <!-- Not found -->
    <view v-else-if="!coachStore.detail" class="detail-empty">
      <text>教练信息不存在</text>
    </view>

    <!-- Detail -->
    <template v-else>
      <view class="detail-hero">
        <view class="detail-avatar" :style="{ background: tierGradient(coachStore.detail.tier) }">
          {{ coachStore.detail.avatar }}
        </view>
        <text class="detail-name">{{ coachStore.detail.name }}</text>
        <view class="detail-tier-row">
          <view class="detail-tier-badge" :style="{ background: coachStore.tierColor(coachStore.detail.tier) }">
            {{ coachStore.tierLabel(coachStore.detail.tier) }} 急救侠
          </view>
          <view v-if="coachStore.detail.available" class="detail-available">
            ● 可预约
          </view>
          <view v-else class="detail-unavailable">
            ● 暂不可约
          </view>
        </view>
        <text class="detail-city">{{ coachStore.detail.city }}</text>
      </view>

      <!-- Stats -->
      <view class="detail-stats">
        <view class="detail-stat">
          <text class="detail-stat-num">{{ coachStore.detail.rescueCount }}</text>
          <text class="detail-stat-lbl">参与救援</text>
        </view>
        <view class="detail-stat">
          <text class="detail-stat-num">{{ coachStore.detail.traineeCount }}</text>
          <text class="detail-stat-lbl">培训学员</text>
        </view>
        <view class="detail-stat">
          <text class="detail-stat-num">{{ coachStore.detail.points }}</text>
          <text class="detail-stat-lbl">积分</text>
        </view>
      </view>

      <!-- Bio -->
      <view class="detail-section">
        <text class="detail-section-title">个人简介</text>
        <text class="detail-bio">{{ coachStore.detail.bio }}</text>
      </view>

      <!-- Specialties -->
      <view class="detail-section">
        <text class="detail-section-title">培训专长</text>
        <view class="detail-tags">
          <view v-for="s in coachStore.detail.specialties" :key="s" class="detail-tag">
            {{ coachStore.specialtyLabel(s) }}
          </view>
        </view>
      </view>

      <!-- Certifications -->
      <view class="detail-section">
        <text class="detail-section-title">资质认证</text>
        <view class="detail-certs">
          <view v-for="c in coachStore.detail.certifications" :key="c" class="detail-cert-item">
            <view class="cert-dot"></view>
            <text class="cert-text">{{ c }}</text>
          </view>
        </view>
      </view>

      <!-- CTA -->
      <view class="detail-cta">
        <view class="detail-btn" :class="{ disabled: !coachStore.detail.available }">
          <text>📩 申请培训</text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useCoachStore } from '@/stores/coach'
import { onLoad } from '@dcloudio/uni-app'

const coachStore = useCoachStore()

onLoad((options) => {
  const id = (options as any)?.id
  if (id) {
    coachStore.loadDetail(id)
  }
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
</script>

<style lang="scss" scoped>
.page-coach-detail {
  padding-bottom: 80rpx;
}

.detail-loading,
.detail-empty {
  padding: 160rpx 40rpx;
  text-align: center;
  color: var(--ink-mute);
  font-size: 24rpx;
}

.detail-hero {
  padding: 80rpx 40rpx 40rpx;
  text-align: center;
  background: linear-gradient(180deg, #EBF5FB 0%, transparent 100%);
}

.detail-avatar {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--serif);
  font-size: 56rpx;
  font-weight: 700;
  color: #fff;
  margin: 0 auto 20rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
}

.detail-name {
  font-family: var(--serif);
  font-size: 44rpx;
  font-weight: 900;
  color: var(--ink);
  display: block;
}

.detail-tier-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-top: 12rpx;
}

.detail-tier-badge {
  padding: 6rpx 20rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  color: #fff;
  font-weight: 600;
  font-family: var(--mono);
}

.detail-available {
  font-size: 20rpx;
  color: var(--green);
  font-weight: 600;
}

.detail-unavailable {
  font-size: 20rpx;
  color: var(--ink-mute);
}

.detail-city {
  font-size: 24rpx;
  color: var(--ink-mute);
  display: block;
  margin-top: 8rpx;
}

.detail-stats {
  display: flex;
  justify-content: center;
  gap: 64rpx;
  padding: 40rpx;
}

.detail-stat {
  text-align: center;
}

.detail-stat-num {
  font-family: var(--mono);
  font-size: 44rpx;
  font-weight: 700;
  color: var(--ink);
  display: block;
}

.detail-stat-lbl {
  font-size: 20rpx;
  color: var(--ink-mute);
  display: block;
  margin-top: 4rpx;
}

.detail-section {
  padding: 32rpx 40rpx;
  border-top: 1px solid var(--line);
}

.detail-section-title {
  font-family: var(--serif);
  font-size: 26rpx;
  font-weight: 700;
  color: var(--ink);
  display: block;
  margin-bottom: 16rpx;
}

.detail-bio {
  font-size: 24rpx;
  color: var(--ink-mute);
  line-height: 1.8;
}

.detail-tags {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}

.detail-tag {
  padding: 10rpx 24rpx;
  background: #EBF5FB;
  border-radius: 32rpx;
  font-size: 22rpx;
  color: #2C5282;
  font-weight: 600;
}

.detail-certs {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.detail-cert-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.cert-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--gold);
}

.cert-text {
  font-size: 22rpx;
  color: var(--ink-mute);
  font-family: var(--mono);
}

.detail-cta {
  padding: 40rpx;
  display: flex;
  justify-content: center;
}

.detail-btn {
  width: 100%;
  max-width: 500rpx;
  padding: 28rpx;
  background: var(--rescue-red);
  border-radius: 48rpx;
  text-align: center;
  font-size: 28rpx;
  color: #fff;
  font-weight: 700;
  font-family: var(--serif);

  &.disabled {
    background: rgba(0, 0, 0, 0.08);
    color: var(--ink-mute);
  }
}
</style>
