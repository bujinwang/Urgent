<template>
  <view class="page-aed-mgr">
    <view v-if="mgrStore.loading" class="mgr-loading">加载中...</view>
    <template v-else>
      <!-- Header -->
      <view class="mgr-header">
        <text class="mgr-title">我的 AED</text>
        <text class="mgr-sub">管理 {{ mgrStore.myAeds.length }} 台设备</text>
      </view>

      <!-- Alerts -->
      <view v-if="mgrStore.aedsNeedingAttention.length" class="mgr-alert">
        <text class="mgr-alert-icon">⚠️</text>
        <text class="mgr-alert-text">{{ mgrStore.aedsNeedingAttention.length }} 台设备需要关注</text>
      </view>

      <!-- AED List -->
      <view class="mgr-list">
        <view v-for="aed in mgrStore.myAeds" :key="aed.id" class="mgr-card" @click="openDetail(aed)">
          <view class="mgr-card-top">
            <view class="mgr-status-dot" :style="{ background: mgrStore.statusColor(aed.status) }"></view>
            <view class="mgr-card-body">
              <text class="mgr-card-name">{{ aed.name }}</text>
              <text class="mgr-card-addr">{{ aed.address }}</text>
            </view>
            <text class="mgr-card-status">{{ mgrStore.statusLabel(aed.status) }}</text>
          </view>
          <view class="mgr-card-meta">
            <text>电池到期 {{ aed.batteryExpiry || '-' }}</text>
            <text>电极到期 {{ aed.electrodeExpiry || '-' }}</text>
            <text v-if="aed.activePickups > 0" style="color:#4A90E2;font-weight:600">{{ aed.activePickups }} 人取用中</text>
          </view>
        </view>
      </view>

      <view v-if="mgrStore.myAeds.length === 0" class="mgr-empty">
        <text>你还没有管理的 AED 设备</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAedMgrStore } from '@/stores/aed-mgr'
import { useUserStore } from '@/stores/user'

const mgrStore = useAedMgrStore()
const userStore = useUserStore()

onMounted(() => {
  mgrStore.loadMyAeds(userStore.profile.id)
})

function openDetail(aed: any) {
  uni.navigateTo({ url: `/pages/aed/detail?id=${aed.id}` })
}
</script>

<style lang="scss" scoped>
.page-aed-mgr { padding-bottom: 60rpx; }
.mgr-loading { padding: 160rpx 40rpx; text-align: center; color: var(--ink-mute); font-size: 24rpx; }
.mgr-header { padding: 60rpx 40rpx 24rpx; background: linear-gradient(180deg, #EBF5FB, transparent); }
.mgr-title { font-family: var(--serif); font-size: 44rpx; font-weight: 900; display: block; }
.mgr-sub { font-size: 22rpx; color: var(--ink-mute); margin-top: 4rpx; display: block; }
.mgr-alert { margin: 0 40rpx 24rpx; padding: 20rpx; background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 14rpx; display: flex; align-items: center; gap: 10rpx; }
.mgr-alert-icon { font-size: 24rpx; }
.mgr-alert-text { font-size: 22rpx; font-weight: 600; color: #92400E; }
.mgr-list { padding: 0 40rpx; display: flex; flex-direction: column; gap: 16rpx; }
.mgr-card { background: #fff; border: 1px solid var(--line); border-radius: 20rpx; padding: 24rpx; }
.mgr-card-top { display: flex; align-items: center; gap: 14rpx; }
.mgr-status-dot { width: 14rpx; height: 14rpx; border-radius: 50%; flex-shrink: 0; }
.mgr-card-body { flex: 1; }
.mgr-card-name { font-size: 26rpx; font-weight: 600; display: block; }
.mgr-card-addr { font-size: 20rpx; color: var(--ink-mute); }
.mgr-card-status { font-size: 20rpx; font-family: var(--mono); }
.mgr-card-meta { display: flex; gap: 24rpx; margin-top: 16rpx; padding-top: 16rpx; border-top: 1px solid var(--line); font-size: 20rpx; color: var(--ink-mute); font-family: var(--mono); }
.mgr-empty { padding: 120rpx 40rpx; text-align: center; color: var(--ink-mute); font-size: 24rpx; }
</style>
