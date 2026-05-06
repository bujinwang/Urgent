<template>
  <view class="page-cert">
    <view class="profile-header">
      <view class="profile-avatar">{{ user.avatar }}</view>
      <text class="profile-name">{{ user.name }}</text>
      <text class="profile-id">{{ user.volunteerId }}</text>
      <view class="profile-stats">
        <view class="profile-stat"><text class="profile-stat-num">{{ user.rescueCount }}</text><text class="profile-stat-label">参与救援</text></view>
        <view class="profile-stat"><text class="profile-stat-num">{{ user.points }}</text><text class="profile-stat-label">积分</text></view>
        <view class="profile-stat"><text class="profile-stat-num">{{ user.certifications.length }}</text><text class="profile-stat-label">认证</text></view>
      </view>
    </view>
    <view class="cert-card">
      <view class="cert-tier">{{ tierLabel }} 急救侠</view>
      <text class="cert-name">CPR / AED 认证</text>
      <text class="cert-issuer">深圳急救中心 · AHA 联合认证</text>
      <view class="cert-meta">
        <view class="cert-meta-item">签发日期<text class="cert-meta-value">2025-08-15</text></view>
        <view class="cert-meta-item">到期日期<text class="cert-meta-value">2027-08-15</text></view>
      </view>
    </view>
    <view class="cert-qr">
      <view class="qr-box" />
      <view class="qr-info">
        <text class="qr-info-title">电子证书验证</text>
        <text class="qr-info-desc">扫码可在线验证证书真伪及志愿者资质</text>
      </view>
    </view>
    <!-- 功能入口 -->
    <view class="cert-actions">
      <view v-for="a in actions" :key="a.label" class="cert-action" @click="handleAction(a.label)">
        <text class="cert-action-icon">{{ a.icon }}</text>
        <text class="cert-action-label">{{ a.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getProfile } from '@/api/user'

const user = ref(getProfile())
const tierLabel = computed(() => {
  const m: Record<string, string> = { gold: '金牌', silver: '银牌', bronze: '铜牌', diamond: '钻石' }
  return m[user.value.tier] || user.value.tier
})

const actions = [
  { icon: '📋', label: '认证记录' }, { icon: '📊', label: '救援统计' },
  { icon: '⚙️', label: '账号设置' }, { icon: '📖', label: '急救手册' },
]

function handleAction(label: string) {
  uni.showToast({ title: '「' + label + '」开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.page-cert { padding-bottom: 60rpx; }
.profile-header {
  background: linear-gradient(165deg, #2C3E50 0%, #1A2530 100%);
  color: #fff; padding: 64rpx 48rpx 160rpx; position: relative;
}
.profile-avatar { width: 128rpx; height: 128rpx; border-radius: 50%; background: linear-gradient(135deg, var(--rescue-red), var(--rescue-red-deep)); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 48rpx; font-weight: 700; margin-bottom: 32rpx; }
.profile-name { font-family: var(--serif); font-size: 44rpx; font-weight: 700; display: block; margin-bottom: 8rpx; }
.profile-id { font-family: var(--mono); font-size: 22rpx; opacity: 0.6; margin-bottom: 32rpx; display: block; }
.profile-stats { display: flex; gap: 24rpx; }
.profile-stat { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 24rpx; padding: 24rpx; text-align: center; }
.profile-stat-num { font-family: var(--mono); font-size: 40rpx; font-weight: 700; display: block; }
.profile-stat-label { font-size: 20rpx; opacity: 0.7; margin-top: 8rpx; display: block; }

.cert-card {
  margin: -128rpx 40rpx 32rpx; background: #fff; border-radius: 36rpx;
  padding: 48rpx; box-shadow: 0 16rpx 64rpx rgba(0,0,0,0.08); position: relative; overflow: hidden;
}
.cert-tier { display: inline-flex; align-items: center; gap: 12rpx; background: linear-gradient(135deg, var(--gold), #B8941A); color: #fff; padding: 12rpx 28rpx; border-radius: 40rpx; font-family: var(--mono); font-size: 22rpx; font-weight: 700; letter-spacing: 2rpx; margin-bottom: 32rpx; }
.cert-name { font-family: var(--serif); font-size: 48rpx; font-weight: 900; display: block; margin-bottom: 16rpx; }
.cert-issuer { font-size: 24rpx; color: var(--ink-mute); margin-bottom: 48rpx; display: block; }
.cert-meta { display: flex; justify-content: space-between; padding-top: 32rpx; border-top: 1px dashed var(--line); }
.cert-meta-item { font-size: 22rpx; color: var(--ink-mute); }
.cert-meta-value { font-family: var(--mono); font-size: 26rpx; font-weight: 700; color: var(--ink); display: block; margin-top: 4rpx; }

.cert-qr { margin: 0 40rpx 32rpx; background: #fff; border: 1px solid var(--line); border-radius: 32rpx; padding: 40rpx; display: flex; align-items: center; gap: 32rpx; }
.qr-box { width: 180rpx; height: 180rpx; background: repeating-linear-gradient(0deg, var(--ink) 0 4rpx, transparent 4rpx 8rpx), repeating-linear-gradient(90deg, var(--ink) 0 4rpx, transparent 4rpx 8rpx); background-size: 16rpx 16rpx; border-radius: 16rpx; position: relative; flex-shrink: 0; }
.qr-box::after { content: ''; position: absolute; inset: 60rpx; background: #fff; border-radius: 12rpx; border: 8rpx solid var(--ink); }
.qr-info { flex: 1; }
.qr-info-title { font-family: var(--serif); font-weight: 700; font-size: 28rpx; display: block; margin-bottom: 8rpx; }
.qr-info-desc { font-size: 24rpx; color: var(--ink-mute); display: block; }

.cert-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; padding: 0 40rpx; }
.cert-action { display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 40rpx 0; background: #fff; border: 1px solid var(--line); border-radius: 24rpx; }
.cert-action-icon { font-size: 48rpx; }
.cert-action-label { font-size: 24rpx; color: var(--ink-soft); font-weight: 600; }
</style>
