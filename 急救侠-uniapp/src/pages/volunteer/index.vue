<template>
  <view class="page-volunteer">
    <!-- 头部 -->
    <view class="volunteer-header">
      <text class="volunteer-rank-label">{{ user.tierLabel }} 急救侠 · 排名 #{{ rank }}</text>
      <text class="volunteer-score">{{ user.profile.points.toLocaleString() }}</text>
      <text class="volunteer-score-label">累计积分</text>
      <view class="volunteer-mini-stats">
        <view class="vmini-item">
          <text class="vmini-num">{{ user.profile.rescueCount }}</text>
          <text class="vmini-lbl">参与救援</text>
        </view>
        <view class="vmini-item">
          <text class="vmini-num">{{ aedStore.discoveredCount }}</text>
          <text class="vmini-lbl">发现 AED</text>
        </view>
        <view class="vmini-item">
          <text class="vmini-num">{{ aedStore.verifiedCount }}</text>
          <text class="vmini-lbl">已打卡</text>
        </view>
      </view>
      <!-- 勋章 -->
      <view class="medals-row">
        <view class="medal medal-bronze" :class="{ locked: !hasTier('bronze') }">铜</view>
        <view class="medal medal-silver" :class="{ locked: !hasTier('silver') }">银</view>
        <view class="medal medal-gold" :class="{ locked: !hasTier('gold') }">金</view>
        <view class="medal medal-diamond" :class="{ locked: !hasTier('diamond') }">钻</view>
      </view>
    </view>

    <!-- Tab -->
    <view class="lb-tabs">
      <view class="lb-tab" :class="{ active: volStore.currentTab === 'points' }" @click="volStore.setTab('points')">积分排行</view>
      <view class="lb-tab" :class="{ active: volStore.currentTab === 'rescue' }" @click="volStore.setTab('rescue')">救援次数</view>
    </view>

    <!-- 排行榜 -->
    <view class="leaderboard">
      <view v-for="(item, i) in volStore.leaderboard" :key="item.id" class="lb-item" :class="{ me: item.me }">
        <text class="lb-rank" :class="rankClass(i)">{{ i + 1 }}</text>
        <view class="lb-avatar" :style="{ background: item.color || 'var(--rescue-red-soft)' }">{{ item.avatar }}</view>
        <view class="lb-info">
          <text class="lb-name">{{ item.name }}</text>
          <text class="lb-meta">{{ item.meta }}</text>
        </view>
        <text class="lb-score">{{ item.score }}</text>
      </view>
    </view>

    <!-- 我的 AED 探索 -->
    <view class="lb-section">
      <text class="lb-section-title">我的 AED 探索</text>
      <view class="aed-explore-list">
        <view v-for="aed in aedStore.aeds" :key="aed.id" class="aed-explore-item" @click="openAed(aed.id)">
          <view class="aed-explore-status" :class="{ verified: aed.verified, discovered: aed.discovered }">
            {{ aed.verified ? '✓' : aed.discovered ? '📍' : '?' }}
          </view>
          <view class="aed-explore-info">
            <text class="aed-explore-name">{{ aed.name }}</text>
            <text class="aed-explore-stat">{{ aed.checkIns.length }} 次打卡</text>
          </view>
          <text class="aed-explore-pts">{{ aed.verified ? '+30' : aed.discovered ? '+10' : '未发现' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useAedStore } from '@/stores/aed'
import { useVolunteerStore } from '@/stores/volunteer'

const user = useUserStore()
const aedStore = useAedStore()
const volStore = useVolunteerStore()

const rank = computed(() => volStore.myRank)

function hasTier(tier: string) {
  const tiers = ['bronze', 'silver', 'gold', 'diamond']
  const userIdx = tiers.indexOf(user.profile.tier)
  const checkIdx = tiers.indexOf(tier)
  return userIdx >= checkIdx && user.profile.tier !== 'bronze'
}

function rankClass(i: number) { return volStore.rankClass(i) }

function openAed(id: string) {
  uni.navigateTo({ url: `/pages/aed/detail?id=${id}` })
}
</script>

<style lang="scss" scoped>
.page-volunteer { padding-bottom: 60rpx; }
.volunteer-header { padding: 60rpx 40rpx 40rpx; text-align: center; background: linear-gradient(180deg, var(--rescue-red-soft) 0%, transparent 100%); }
.volunteer-rank-label { font-family: var(--mono); font-size: 22rpx; color: var(--rescue-red); letter-spacing: 4rpx; font-weight: 700; display: block; margin-bottom: 16rpx; }
.volunteer-score { font-family: var(--serif); font-size: 96rpx; font-weight: 900; color: var(--ink); line-height: 1; display: block; }
.volunteer-score-label { font-size: 24rpx; color: var(--ink-mute); margin-top: 8rpx; display: block; }
.volunteer-mini-stats { display: flex; justify-content: center; gap: 48rpx; padding: 32rpx 0; }
.vmini-item { text-align: center; }
.vmini-num { font-family: var(--mono); font-size: 40rpx; font-weight: 700; color: var(--ink); display: block; }
.vmini-lbl { font-size: 20rpx; color: var(--ink-mute); display: block; margin-top: 4rpx; }

.medals-row { display: flex; gap: 24rpx; justify-content: center; }
.medal { width: 96rpx; height: 96rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-weight: 900; font-size: 32rpx; color: #fff; border: 6rpx solid #fff; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.1); transition: all 0.3s; }
.medal-bronze { background: linear-gradient(135deg, var(--bronze), #8B5A2B); }
.medal-silver { background: linear-gradient(135deg, var(--silver), #6B7280); }
.medal-gold { background: linear-gradient(135deg, var(--gold), #8B7515); }
.medal-diamond { background: linear-gradient(135deg, var(--diamond), #2563EB); }
.medal.locked { opacity: 0.25; }

.lb-tabs { display: flex; gap: 16rpx; padding: 0 40rpx 32rpx; }
.lb-tab { padding: 16rpx 28rpx; border-radius: 40rpx; font-size: 24rpx; border: 1px solid var(--line); color: var(--ink-mute); &.active { background: var(--ink); color: #fff; border-color: var(--ink); } }

.leaderboard { padding: 0 40rpx; }
.lb-item { display: flex; align-items: center; gap: 24rpx; padding: 24rpx 0; border-bottom: 1px solid var(--line);
  &.me { background: var(--rescue-red-soft); margin: 0 -40rpx; padding-left: 40rpx; padding-right: 40rpx; border-radius: 24rpx; }
}
.lb-rank { width: 56rpx; font-family: var(--mono); font-size: 32rpx; font-weight: 700; color: var(--ink-mute); text-align: center; &.top1 { color: var(--gold); font-size: 40rpx; } &.top2 { color: var(--silver); font-size: 36rpx; } &.top3 { color: var(--bronze); font-size: 36rpx; } }
.lb-avatar { width: 72rpx; height: 72rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-family: var(--serif); font-size: 28rpx; }
.lb-info { flex: 1; }
.lb-name { font-family: var(--serif); font-weight: 700; font-size: 26rpx; display: block; }
.lb-meta { font-size: 20rpx; color: var(--ink-mute); font-family: var(--mono); display: block; }
.lb-score { font-family: var(--mono); font-size: 28rpx; font-weight: 700; color: var(--rescue-red); }

.lb-section { padding: 40rpx; }
.lb-section-title { font-family: var(--serif); font-size: 28rpx; font-weight: 700; display: block; margin-bottom: 20rpx; }
.aed-explore-list { display: flex; flex-direction: column; gap: 12rpx; }
.aed-explore-item { display: flex; align-items: center; gap: 16rpx; padding: 20rpx; background: #fff; border: 1px solid var(--line); border-radius: 20rpx; }
.aed-explore-status { width: 48rpx; height: 48rpx; border-radius: 50%; background: rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: center; font-size: 22rpx;
  &.discovered { background: rgba(245,158,11,0.1); color: #F59E0B; }
  &.verified { background: rgba(52,210,119,0.1); color: var(--green); }
}
.aed-explore-info { flex: 1; }
.aed-explore-name { font-size: 24rpx; font-weight: 600; display: block; }
.aed-explore-stat { font-size: 20rpx; color: var(--ink-mute); }
.aed-explore-pts { font-family: var(--mono); font-size: 22rpx; color: var(--gold); font-weight: 700; }
</style>
