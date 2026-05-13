<template>
  <view class="page-org">
    <!-- Loading -->
    <view v-if="orgStore.loading" class="org-loading">
      <text>加载中...</text>
    </view>

    <!-- Dashboard -->
    <template v-else-if="orgStore.dashboard">
      <!-- Header -->
      <view class="org-header">
        <text class="org-name">{{ orgStore.dashboard.org.name }}</text>
        <text class="org-type">{{ orgStore.dashboard.org.type === 'school' ? '学校' : '企业' }}</text>
      </view>

      <!-- Stats -->
      <view class="org-stats">
        <view class="org-stat">
          <text class="org-stat-num">{{ orgStore.dashboard.totalMembers }}</text>
          <text class="org-stat-lbl">员工人数</text>
        </view>
        <view class="org-stat">
          <text class="org-stat-num green">{{ orgStore.dashboard.activeCertificates }}</text>
          <text class="org-stat-lbl">有效证书</text>
        </view>
        <view class="org-stat">
          <text class="org-stat-num warn">{{ orgStore.dashboard.expiringCertificates }}</text>
          <text class="org-stat-lbl">即将到期</text>
        </view>
        <view class="org-stat">
          <text class="org-stat-num danger">{{ orgStore.dashboard.expiredCertificates }}</text>
          <text class="org-stat-lbl">已过期</text>
        </view>
      </view>

      <!-- Expiring Alert -->
      <view v-if="orgStore.expiringCerts.length > 0" class="org-alert" @click="tab = 'expiring'">
        <text class="org-alert-icon">⚠️</text>
        <text class="org-alert-text">{{ orgStore.expiringCerts.length }} 张证书即将到期</text>
        <text class="org-alert-arrow">›</text>
      </view>

      <!-- Tabs -->
      <view class="org-tabs">
        <view class="org-tab" :class="{ active: tab === 'all' }" @click="switchTab('all')">
          全部证书
        </view>
        <view class="org-tab" :class="{ active: tab === 'expiring' }" @click="switchTab('expiring')">
          即将到期
        </view>
        <view class="org-tab" :class="{ active: tab === 'members' }" @click="switchTab('members')">
          员工列表
        </view>
      </view>

      <!-- Certificate List -->
      <view v-if="tab !== 'members'" class="org-list">
        <view v-for="cert in displayCerts" :key="cert.id" class="cert-item">
          <view class="cert-status-dot" :style="{ background: orgStore.statusColor(cert.status) }"></view>
          <view class="cert-info">
            <text class="cert-type">{{ orgStore.certificateTypeLabel(cert.type) }}</text>
            <text class="cert-person">{{ cert.userName || cert.userId }}</text>
          </view>
          <view class="cert-dates">
            <text class="cert-expiry" :class="cert.status">
              {{ cert.status === 'expired' ? '已过期' : cert.status === 'expiring' ? orgStore.daysUntilExpiry(cert.expiryDate) + '天后到期' : cert.expiryDate }}
            </text>
          </view>
          <view class="cert-issuer">{{ cert.issuer }}</view>
        </view>
      </view>

      <!-- Member List -->
      <view v-else class="org-list">
        <view v-for="m in orgStore.members" :key="m.id" class="member-item">
          <view class="member-avatar" :style="{ background: tierGradient(m.userTier) }">
            {{ m.userAvatar }}
          </view>
          <view class="member-info">
            <view class="member-name-row">
              <text class="member-name">{{ m.userName }}</text>
              <view class="member-role">{{ roleLabel(m.role) }}</view>
            </view>
            <text class="member-certs">
              {{ m.activeCertificates }} 有效 · {{ m.expiringCertificates }} 即将到期
            </text>
          </view>
          <text class="member-rescue">{{ m.rescueCount }}次救援</text>
        </view>
      </view>

      <!-- Empty -->
      <view v-if="displayCerts.length === 0 && tab !== 'members'" class="org-empty">
        <text>暂无证书记录</text>
      </view>
    </template>

    <view v-else class="org-empty">
      <text>机构信息加载失败</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useOrgStore } from '@/stores/org'
import { useUserStore } from '@/stores/user'
import { onLoad } from '@dcloudio/uni-app'

const orgStore = useOrgStore()
const userStore = useUserStore()
const tab = ref<'all' | 'expiring' | 'members'>('all')

onLoad(async (options) => {
  await userStore.loadOrgRoles()
  if (!userStore.isOrgManager) {
    uni.showToast({ title: '无机构管理权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 1500)
    return
  }
  const id = (options as any)?.id || userStore.orgRoles[0]?.orgId || 'org_001'
  orgStore.loadDashboard(id)
  orgStore.loadCertificates()
  orgStore.loadExpiringCerts()
  orgStore.loadMembers()
})

const displayCerts = computed(() => {
  return tab.value === 'expiring' ? orgStore.expiringCerts : orgStore.certificates
})

function switchTab(t: typeof tab.value) {
  tab.value = t
}

function tierGradient(tier: string) {
  const map: Record<string, string> = {
    gold: 'linear-gradient(135deg,#D4A017,#8B6914)',
    silver: 'linear-gradient(135deg,#8BA3B5,#5A6B78)',
    bronze: 'linear-gradient(135deg,#B87333,#8B5220)',
    diamond: 'linear-gradient(135deg,#4A90E2,#2563EB)',
  }
  return map[tier] || 'linear-gradient(135deg,#6B7280,#4B5563)'
}

function roleLabel(role: string) {
  const map: Record<string, string> = { admin: '管理员', manager: '安全主管', member: '员工' }
  return map[role] || role
}
</script>

<style lang="scss" scoped>
.page-org { padding-bottom: 60rpx; }

.org-loading { padding: 160rpx 40rpx; text-align: center; color: var(--ink-mute); font-size: 24rpx; }

.org-header {
  padding: 60rpx 40rpx 24rpx;
  background: linear-gradient(180deg, #FEF3C7 0%, transparent 100%);
}
.org-name { font-family: var(--serif); font-size: 44rpx; font-weight: 900; color: var(--ink); display: block; }
.org-type { font-size: 22rpx; color: var(--ink-mute); display: block; margin-top: 4rpx; }

.org-stats {
  display: flex; justify-content: center; gap: 40rpx; padding: 32rpx 40rpx;
}
.org-stat { text-align: center; }
.org-stat-num {
  font-family: var(--mono); font-size: 44rpx; font-weight: 700; color: var(--ink); display: block;
  &.green { color: #34D277; } &.warn { color: #F59E0B; } &.danger { color: #EF4444; }
}
.org-stat-lbl { font-size: 20rpx; color: var(--ink-mute); }

.org-alert {
  margin: 0 40rpx; padding: 24rpx; background: #FEF3C7; border: 1px solid #FCD34D;
  border-radius: 16rpx; display: flex; align-items: center; gap: 12rpx;
}
.org-alert-icon { font-size: 28rpx; }
.org-alert-text { flex: 1; font-size: 24rpx; font-weight: 600; color: #92400E; }
.org-alert-arrow { font-size: 32rpx; color: #92400E; }

.org-tabs {
  display: flex; gap: 12rpx; padding: 32rpx 40rpx 16rpx;
}
.org-tab {
  padding: 14rpx 24rpx; border-radius: 32rpx; font-size: 22rpx;
  border: 1px solid var(--line); color: var(--ink-mute);
  &.active { background: var(--ink); color: #fff; border-color: var(--ink); }
}

.org-list { padding: 0 40rpx; }

.cert-item {
  display: flex; align-items: center; gap: 16rpx; padding: 24rpx 0;
  border-bottom: 1px solid var(--line);
}
.cert-status-dot { width: 16rpx; height: 16rpx; border-radius: 50%; flex-shrink: 0; }
.cert-info { flex: 1; min-width: 0; }
.cert-type { font-size: 26rpx; font-weight: 600; color: var(--ink); display: block; }
.cert-person { font-size: 20rpx; color: var(--ink-mute); }
.cert-dates { flex-shrink: 0; text-align: right; }
.cert-expiry { font-size: 20rpx; font-family: var(--mono);
  &.expired { color: #EF4444; } &.expiring { color: #F59E0B; }
  &:not(.expired):not(.expiring) { color: var(--ink-mute); }
}
.cert-issuer { font-size: 18rpx; color: var(--ink-mute); font-family: var(--mono); flex-shrink: 0; }

.member-item { display: flex; align-items: center; gap: 16rpx; padding: 24rpx 0; border-bottom: 1px solid var(--line); }
.member-avatar {
  width: 72rpx; height: 72rpx; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; color: #fff; font-weight: 700; font-size: 28rpx; flex-shrink: 0;
}
.member-info { flex: 1; }
.member-name-row { display: flex; align-items: center; gap: 8rpx; }
.member-name { font-size: 26rpx; font-weight: 600; }
.member-role { padding: 2rpx 12rpx; border-radius: 8rpx; font-size: 18rpx; background: rgba(0,0,0,0.06); color: var(--ink-mute); }
.member-certs { font-size: 20rpx; color: var(--ink-mute); }
.member-rescue { font-size: 20rpx; color: var(--ink-mute); font-family: var(--mono); }

.org-empty { padding: 120rpx 40rpx; text-align: center; color: var(--ink-mute); font-size: 24rpx; }
</style>
