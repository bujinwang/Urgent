<template>
  <view class="page-cert">
    <view class="profile-header">
      <view class="profile-avatar">{{ user.profile.avatar }}</view>
      <text class="profile-name">{{ user.profile.name }}</text>
      <text class="profile-id">{{ user.profile.volunteerId }}</text>
      <view class="profile-stats">
        <view class="profile-stat"><text class="profile-stat-num">{{ user.profile.rescueCount }}</text><text class="profile-stat-label">参与救援</text></view>
        <view class="profile-stat"><text class="profile-stat-num">{{ user.profile.points.toLocaleString() }}</text><text class="profile-stat-label">积分</text></view>
        <view class="profile-stat"><text class="profile-stat-num">{{ user.profile.certifications.length }}</text><text class="profile-stat-label">认证</text></view>
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
      <view class="qr-info"><text class="qr-info-title">电子证书验证</text><text class="qr-info-desc">扫码可在线验证证书真伪及志愿者资质</text></view>
    </view>

    <!-- 功能入口 — 不再显示"开发中" -->
    <view class="cert-actions">
      <view class="cert-action" @click="showCerts">
        <text class="cert-action-icon">📋</text>
        <text class="cert-action-label">认证记录</text>
        <text class="cert-action-sub">{{ user.profile.certifications.length }} 项</text>
      </view>
      <view class="cert-action" @click="showRescueStats">
        <text class="cert-action-icon">📊</text>
        <text class="cert-action-label">救援统计</text>
        <text class="cert-action-sub">{{ user.profile.rescueCount }} 次</text>
      </view>
      <view class="cert-action" @click="goVolunteer">
        <text class="cert-action-icon">🏆</text>
        <text class="cert-action-label">排行榜</text>
        <text class="cert-action-sub">{{ tierLabel }}</text>
      </view>
      <view class="cert-action" @click="goAtlas">
        <text class="cert-action-icon">📖</text>
        <text class="cert-action-label">急救手册</text>
        <text class="cert-action-sub">6 种急症</text>
      </view>
      <view class="cert-action" @click="goInterests">
        <text class="cert-action-icon">🎯</text>
        <text class="cert-action-label">兴趣方向</text>
        <text class="cert-action-sub">选择你的模块</text>
      </view>
      <view v-if="user.isOrgManager" class="cert-action cert-action-mgr" @click="goOrg">
        <text class="cert-action-icon">🏢</text>
        <text class="cert-action-label">机构管理</text>
        <text class="cert-action-sub">{{ user.orgRoles[0]?.orgName }}</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="cert-logout" @click="doLogout"><text>退出登录</text></view>

    <!-- AED 打卡记录 -->
    <view class="cert-section">
      <text class="cert-section-title">我的 AED 打卡</text>
      <view v-for="aed in checkedAeds" :key="aed.id" class="cert-checkin-item" @click="openAed(aed.id)">
        <view class="cert-checkin-icon">✓</view>
        <view class="cert-checkin-info">
          <text class="cert-checkin-name">{{ aed.name }}</text>
          <text class="cert-checkin-date">{{ aed.lastCheck }}</text>
        </view>
        <text class="cert-checkin-count">{{ aed.checkIns.length }} 次</text>
      </view>
      <view v-if="checkedAeds.length === 0" class="cert-empty">
        <text>还没有 AED 打卡记录</text>
        <text class="cert-empty-link" @click="goAed">去探索 AED →</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useAedStore } from '@/stores/aed'
import { useAuthStore } from '@/stores/auth'

const user = useUserStore()
const aedStore = useAedStore()

const tierLabel = computed(() => {
  const m: Record<string, string> = { gold: '金牌', silver: '银牌', bronze: '铜牌', diamond: '钻石' }
  return m[user.profile.tier] || user.profile.tier
})

const checkedAeds = computed(() => aedStore.aeds.filter(a => a.checkIns.length > 0))

function showCerts() {
  uni.showModal({ title: '认证记录', content: user.profile.certifications.join('\n') + '\n\n所有认证均在有效期内。', showCancel: false, confirmText: '知道了' })
}
function showRescueStats() {
  uni.navigateTo({ url: '/pages/records/index' })
}
function goVolunteer() { uni.navigateTo({ url: '/pages/volunteer/index' }) }
function goAtlas() { uni.navigateTo({ url: '/pages/atlas/index' }) }
function goAed() { uni.switchTab({ url: '/pages/aed/index' }) }
function openAed(id: string) { uni.navigateTo({ url: `/pages/aed/detail?id=${id}` }) }
function goOrg() {
  const orgId = user.orgRoles[0]?.orgId
  if (orgId) uni.navigateTo({ url: `/pages/org/dashboard?id=${orgId}` })
}
function goInterests() { uni.navigateTo({ url: '/pages/cert/interests' }) }

const authStore = useAuthStore()
function doLogout() {
  uni.showModal({ title: '退出登录', content: '确定退出当前账号？', success: (res) => {
    if (res.confirm) { authStore.logout(); uni.showToast({ title: '已退出', icon: 'none' }) }
  }})
}

onMounted(() => {
  user.loadOrgRoles()
})
</script>

<style lang="scss" scoped>
.page-cert { padding-bottom: 60rpx; }
.profile-header { background: linear-gradient(165deg, #2C3E50 0%, #1A2530 100%); color: #fff; padding: 64rpx 48rpx 160rpx; }
.profile-avatar { width: 128rpx; height: 128rpx; border-radius: 50%; background: linear-gradient(135deg, var(--rescue-red), var(--rescue-red-deep)); display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-size: 48rpx; font-weight: 700; margin-bottom: 32rpx; }
.profile-name { font-family: var(--serif); font-size: 44rpx; font-weight: 700; display: block; margin-bottom: 8rpx; }
.profile-id { font-family: var(--mono); font-size: 22rpx; opacity: 0.6; margin-bottom: 32rpx; display: block; }
.profile-stats { display: flex; gap: 24rpx; }
.profile-stat { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 24rpx; padding: 24rpx; text-align: center; }
.profile-stat-num { font-family: var(--mono); font-size: 40rpx; font-weight: 700; display: block; }
.profile-stat-label { font-size: 20rpx; opacity: 0.7; margin-top: 8rpx; display: block; }

.cert-card { margin: -128rpx 40rpx 32rpx; background: #fff; border-radius: 36rpx; padding: 48rpx; box-shadow: 0 16rpx 64rpx rgba(0,0,0,0.08); }
.cert-tier { display: inline-flex; gap: 12rpx; background: linear-gradient(135deg, var(--gold), #B8941A); color: #fff; padding: 12rpx 28rpx; border-radius: 40rpx; font-family: var(--mono); font-size: 22rpx; font-weight: 700; letter-spacing: 2rpx; margin-bottom: 32rpx; }
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

.cert-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; padding: 0 40rpx 40rpx; }
.cert-action { display: flex; flex-direction: column; align-items: center; gap: 8rpx; padding: 36rpx 0; background: #fff; border: 1px solid var(--line); border-radius: 24rpx; }
.cert-action-icon { font-size: 44rpx; }
.cert-action-label { font-size: 22rpx; color: var(--ink-soft); font-weight: 600; }
.cert-action-sub { font-size: 18rpx; color: var(--ink-mute); font-family: var(--mono); }

.cert-section { padding: 0 40rpx 40rpx; }
.cert-section-title { font-family: var(--serif); font-size: 28rpx; font-weight: 700; display: block; margin-bottom: 20rpx; }
.cert-checkin-item { display: flex; align-items: center; gap: 16rpx; padding: 20rpx; background: #fff; border: 1px solid var(--line); border-radius: 20rpx; margin-bottom: 12rpx; }
.cert-checkin-icon { width: 48rpx; height: 48rpx; border-radius: 50%; background: var(--green-soft); color: var(--green); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22rpx; }
.cert-checkin-info { flex: 1; }
.cert-checkin-name { font-size: 24rpx; font-weight: 600; display: block; }
.cert-checkin-date { font-size: 20rpx; color: var(--ink-mute); }
.cert-checkin-count { font-family: var(--mono); font-size: 22rpx; color: var(--gold); font-weight: 700; }
.cert-empty { text-align: center; padding: 40rpx 0; color: var(--ink-mute); font-size: 24rpx; }
.cert-empty-link { color: var(--rescue-red); font-weight: 600; display: block; margin-top: 8rpx; }
.cert-action-mgr { border-color: var(--gold); background: linear-gradient(135deg, #FFFDF5, #FFF8E1); }
.cert-logout { margin: 0 40rpx 20rpx; padding: 20rpx; text-align: center; background: #FEE2E2; border: 1px solid #FECACA; border-radius: 16rpx; font-size: 24rpx; color: #991B1B; font-weight: 600; }
</style>
