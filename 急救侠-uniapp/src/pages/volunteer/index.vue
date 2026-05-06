<template>
  <view class="page-volunteer">
    <view class="volunteer-header">
      <text class="volunteer-rank">{{ user.tierLabel }} · 排名 #{{ rank }}</text>
      <text class="volunteer-score">{{ user.points }}</text>
      <text class="volunteer-score-label">累计积分</text>
      <view class="medals-row">
        <view class="medal medal-bronze">铜</view>
        <view class="medal medal-silver">银</view>
        <view class="medal medal-gold">金</view>
        <view class="medal medal-diamond medal-locked">钻</view>
      </view>
    </view>
    <view class="lb-tabs">
      <text class="lb-tab active">月度积分</text>
      <text class="lb-tab" style="color:var(--ink-mute);">救援次数</text>
    </view>
    <view class="leaderboard">
      <view v-for="(item, i) in leaderboard" :key="item.id" class="lb-item" :class="{ me: item.me }">
        <text class="lb-rank" :class="rankClass(i)">{{ i + 1 }}</text>
        <view class="lb-avatar">{{ item.avatar }}</view>
        <view class="lb-info">
          <text class="lb-name">{{ item.name }}</text>
          <text class="lb-meta">{{ item.meta }}</text>
        </view>
        <text class="lb-score">{{ item.score }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const user = ref({ tierLabel: '金牌', points: 2340, rank: 12 })
const rank = ref(12)

const leaderboard = [
  { id: 1, avatar: '张', name: '张医生', meta: 'SZ-001 · 32次', score: '5,890', me: false },
  { id: 2, avatar: '李', name: '李护士', meta: 'SZ-005 · 28次', score: '4,720', me: false },
  { id: 3, avatar: '王', name: '王教练', meta: 'SZ-018 · 19次', score: '3,450', me: false },
  { id: 4, avatar: '赵', name: '赵老师', meta: 'SZ-007 · 15次', score: '2,980', me: false },
  { id: 5, avatar: '陆', name: '陆远', meta: 'SZ-012 · 12次', score: '2,340', me: true },
  { id: 6, avatar: '陈', name: '陈同学', meta: 'SZ-031 · 9次', score: '1,890', me: false },
]

function rankClass(i: number) {
  if (i === 0) return 'top1'
  if (i === 1) return 'top2'
  if (i === 2) return 'top3'
  return ''
}
</script>

<style lang="scss" scoped>
.page-volunteer { padding-bottom: 60rpx; }
.volunteer-header { padding: 60rpx 40rpx 48rpx; text-align: center; background: linear-gradient(180deg, var(--rescue-red-soft) 0%, transparent 100%); }
.volunteer-rank { font-family: var(--mono); font-size: 22rpx; color: var(--rescue-red); letter-spacing: 4rpx; font-weight: 700; display: block; margin-bottom: 16rpx; }
.volunteer-score { font-family: var(--serif); font-size: 128rpx; font-weight: 900; color: var(--ink); line-height: 1; display: block; }
.volunteer-score-label { font-size: 24rpx; color: var(--ink-mute); margin-top: 16rpx; display: block; }
.medals-row { display: flex; gap: 24rpx; justify-content: center; padding: 40rpx 0 0; }
.medal { width: 112rpx; height: 112rpx; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-weight: 900; font-size: 36rpx; color: #fff; border: 6rpx solid #fff; box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.1); }
.medal-bronze { background: linear-gradient(135deg, var(--bronze), #8B5A2B); }
.medal-silver { background: linear-gradient(135deg, var(--silver), #6B7280); }
.medal-gold { background: linear-gradient(135deg, var(--gold), #8B7515); }
.medal-diamond { background: linear-gradient(135deg, var(--diamond), #2563EB); opacity: 0.3; }
.medal-locked { position: relative; &::after { content: '🔒'; position: absolute; font-size: 28rpx; } }

.lb-tabs { display: flex; gap: 16rpx; padding: 0 40rpx 32rpx; }
.lb-tab { padding: 16rpx 28rpx; border-radius: 40rpx; font-size: 24rpx; border: 1px solid var(--line); color: var(--ink-mute); &.active { background: var(--ink); color: #fff; border-color: var(--ink); } }

.leaderboard { padding: 0 40rpx; }
.lb-item { display: flex; align-items: center; gap: 28rpx; padding: 28rpx 0; border-bottom: 1px solid var(--line);
  &.me { background: var(--rescue-red-soft); margin: 0 -40rpx; padding-left: 40rpx; padding-right: 40rpx; border-radius: 24rpx; }
}
.lb-rank { width: 64rpx; font-family: var(--mono); font-size: 36rpx; font-weight: 700; color: var(--ink-mute); text-align: center; &.top1 { color: var(--gold); font-size: 44rpx; } &.top2 { color: var(--silver); font-size: 40rpx; } &.top3 { color: var(--bronze); font-size: 40rpx; } }
.lb-avatar { width: 80rpx; height: 80rpx; border-radius: 50%; background: linear-gradient(135deg, var(--rescue-red-soft), #F8E8E5); display: flex; align-items: center; justify-content: center; color: var(--rescue-red); font-weight: 700; font-family: var(--serif); }
.lb-info { flex: 1; }
.lb-name { font-family: var(--serif); font-weight: 700; font-size: 28rpx; display: block; }
.lb-meta { font-size: 22rpx; color: var(--ink-mute); font-family: var(--mono); display: block; }
.lb-score { font-family: var(--mono); font-size: 32rpx; font-weight: 700; color: var(--rescue-red); }
</style>
