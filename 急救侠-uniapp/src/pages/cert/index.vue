<template>
  <view class="page-cert">
    <view class="profile-header">
      <view class="profile-avatar">{{ user.profile.avatar }}</view>
      <text class="profile-name">{{ user.profile.name }}</text>
      <text v-if="user.profile.volunteerId" class="profile-id">{{ user.profile.volunteerId }}</text>
      <view class="profile-stats">
        <view class="profile-stat"><text class="profile-stat-num">{{ user.profile.rescueCount }}</text><text class="profile-stat-label">{{ $t('mine.statRescues') }}</text></view>
        <view class="profile-stat"><text class="profile-stat-num">{{ user.profile.points.toLocaleString() }}</text><text class="profile-stat-label">{{ $t('mine.statPoints') }}</text></view>
        <view class="profile-stat"><text class="profile-stat-num">{{ user.profile.certifications.length }}</text><text class="profile-stat-label">{{ $t('mine.statCerts') }}</text></view>
      </view>
    </view>

    <template v-if="user.profile.id">
    <view v-if="user.profile.certifications.length>0" class="cert-card">
      <view class="cert-tier">{{ $t('mine.certTier', { tier: tierLabel }) }}</view>
      <text class="cert-name">{{ user.profile.certifications[0] || $t('mine.certFallbackName') }}</text>
      <text class="cert-issuer">{{ $t('mine.issuer') }}</text>
      <view class="cert-meta"><view class="cert-meta-item">{{ $t('mine.certsHeld') }}<text class="cert-meta-value">{{ $t('mine.certCountValue', { n: user.profile.certifications.length }) }}</text></view><view class="cert-meta-item">{{ $t('mine.level') }}<text class="cert-meta-value">{{ tierLabel }}</text></view></view>
    </view>
    <view v-else class="cert-card"><view class="cert-tier">{{ $t('mine.newcomer') }}</view><text class="cert-name">{{ $t('mine.noCert') }}</text><text class="cert-issuer">{{ $t('mine.noCertHint') }}</text></view>
    <view class="cert-qr"><view class="qr-box"/><view class="qr-info"><text class="qr-info-title">{{ $t('mine.qrTitle') }}</text><text class="qr-info-desc">{{ $t('mine.qrDesc') }}</text></view></view>
    <view class="cert-actions">
      <view class="cert-action" @click="showCerts"><text class="cert-action-icon">📋</text><text class="cert-action-label">{{ $t('mine.actions.certs') }}</text><text class="cert-action-sub">{{ $t('mine.certCountValue', { n: user.profile.certifications.length }) }}</text></view>
      <view class="cert-action" @click="showRescueStats"><text class="cert-action-icon">📊</text><text class="cert-action-label">{{ $t('mine.actions.rescueStats') }}</text><text class="cert-action-sub">{{ $t('mine.countTimes', { n: user.profile.rescueCount }) }}</text></view>
      <view class="cert-action" @click="goVolunteer"><text class="cert-action-icon">🏆</text><text class="cert-action-label">{{ $t('mine.actions.leaderboard') }}</text><text class="cert-action-sub">{{ tierLabel }}</text></view>
      <view class="cert-action" @click="goAtlas"><text class="cert-action-icon">📖</text><text class="cert-action-label">{{ $t('mine.actions.manual') }}</text><text class="cert-action-sub">{{ $t('mine.manualSub') }}</text></view>
      <view class="cert-action" @click="goInterests"><text class="cert-action-icon">🎯</text><text class="cert-action-label">{{ $t('mine.actions.interests') }}</text><text class="cert-action-sub">{{ $t('mine.interestsSub') }}</text></view>
      <view class="cert-action" @click="goUpload"><text class="cert-action-icon">📜</text><text class="cert-action-label">{{ $t('mine.actions.uploadCert') }}</text><text class="cert-action-sub">{{ $t('mine.uploadCertSub') }}</text></view>
      <view class="cert-action" @click="goPushSettings"><text class="cert-action-icon">🔔</text><text class="cert-action-label">{{ $t('mine.actions.pushSettings') }}</text><text class="cert-action-sub">{{ $t('mine.pushSettingsSub') }}</text></view>
      <view v-if="user.isOrgManager" class="cert-action cert-action-mgr" @click="goOrg"><text class="cert-action-icon">🏢</text><text class="cert-action-label">{{ $t('mine.actions.org') }}</text><text class="cert-action-sub">{{ user.orgRoles[0]?.orgName }}</text></view>
    </view>
    <view class="cert-logout" @click="doLogout"><text>{{ $t('mine.logout') }}</text></view>
    <view class="cert-logout" style="background:#F0F0F0;border-color:#DDD;color:#666;margin-bottom:8rpx" @click="goChangePwd"><text>{{ $t('mine.changePwd') }}</text></view>
    <view class="cert-section"><text class="cert-section-title">{{ $t('mine.checkinTitle') }}</text>
      <view v-for="aed in checkedAeds" :key="aed.id" class="cert-checkin-item" @click="openAed(aed.id)"><view class="cert-checkin-icon">✓</view><view class="cert-checkin-info"><text class="cert-checkin-name">{{ aed.name }}</text><text class="cert-checkin-date">{{ aed.lastCheck }}</text></view><text class="cert-checkin-count">{{ $t('mine.countTimes', { n: aed.checkIns.length }) }}</text></view>
      <view v-if="checkedAeds.length===0" class="cert-empty"><text>{{ $t('mine.checkinEmpty') }}</text><text class="cert-empty-link" @click="goAed">{{ $t('mine.checkinExplore') }}</text></view>
    </view>
    </template>

    <template v-else>
    <view class="cert-guest-cta" @click="goLogin">
      <text class="cert-guest-icon">🔐</text>
      <text class="cert-guest-title">{{ $t('mine.guestTitle') }}</text>
      <text class="cert-guest-desc">{{ $t('mine.guestDesc') }}</text>
      <view class="cert-guest-btn">{{ $t('mine.guestBtn') }}</view>
    </view>
    <view class="cert-guest-links">
      <view class="cert-guest-link" @click="goAtlas">📖 {{ $t('mine.actions.manual') }}</view>
      <view class="cert-guest-link" @click="goVolunteer">🏆 {{ $t('mine.actions.leaderboard') }}</view>
    </view>
    </template>

    <!-- 语言切换入口：放在「我的」页 ⇒ **不进 SOS 主流程**（PRD §8 / 设计 §6 P1）。
         登录与游客都渲染（游客也要能切语言）。 -->
    <view class="cert-lang">
      <text class="cert-lang-title">{{ $t('mine.lang.title') }}</text>
      <view class="cert-lang-options">
        <view class="cert-lang-option" :class="{ active: locale === 'zh-CN' }" @click="switchLang('zh-CN')">{{ $t('mine.lang.zh') }}</view>
        <view class="cert-lang-option" :class="{ active: locale === 'en-US' }" @click="switchLang('en-US')">{{ $t('mine.lang.en') }}</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useAedStore } from '@/stores/aed'
import { useAuthStore } from '@/stores/auth'
import { i18n, setLocale, getLocale, type Locale } from '@/i18n'

const user=useUserStore(),aedStore=useAedStore(),authStore=useAuthStore()

/**
 * 全局组合式 i18n 实例（`t` **只能**在 computed / 函数体 / 回调里调用；
 * 顶层取值会冻结语言，见设计 §3.5 / §11.1）。cast 范式与 drill / rescue 页一致。
 */
const i18nGlobal = i18n.global as unknown as {
  locale: { value: string }
  t: (key: string, named?: Record<string, unknown>) => string
}
function t(key: string, named?: Record<string, unknown>): string {
  return i18nGlobal.t(key, named)
}

/**
 * 等级名 —— **在 `computed` 内调 `t()`**（不是模块级字面量映射）：
 * 后者只在 setup 期求值一次 ⇒ 语言切换后不重算 = 典型「语言冻结」（设计 §3.5 / §11.1）。
 * 未收录的 `tier` 回落原始值（保持原 `|| tier` 语义，且绝不显示裸 key）。
 */
const tierKeys: Record<string, string> = {
  gold: 'mine.tier.gold', silver: 'mine.tier.silver', bronze: 'mine.tier.bronze', diamond: 'mine.tier.diamond',
}
const tierLabel = computed(() => {
  const tier = user.profile.tier as string
  const key = tierKeys[tier] as string | undefined
  return key ? t(key) : tier
})
const checkedAeds=computed(()=>aedStore.aeds.filter((a:any)=>a.checkIns.length>0))

/** 当前语言（响应式：内部读 `i18n.global.locale.value`）⇒ 切换后重算，用于高亮选中项。 */
const locale = computed<Locale>(() => getLocale())

/**
 * 切换语言 —— 唯一的 UI 入口。
 * `setLocale` 负责：改全局 locale + 持久化 + **同步原生 tabBar**。
 * 之后用**新语言**弹确认 toast（`{lang}` 用语言自名）。
 */
function switchLang(target: Locale): void {
  if (target === locale.value) return
  setLocale(target)
  const langName = t(target === 'en-US' ? 'mine.lang.en' : 'mine.lang.zh')
  uni.showToast({ title: t('mine.lang.switched', { lang: langName }), icon: 'none' })
}

function showCerts(){uni.showModal({title:t('mine.actions.certs'),content:user.profile.certifications.join('\n')+'\n\n'+t('mine.certsModalBody'),showCancel:false,confirmText:t('mine.gotIt')})}
function showRescueStats(){uni.navigateTo({url:'/pages/records/index'})}
function goVolunteer(){uni.navigateTo({url:'/pages/volunteer/index'})}
function goAtlas(){uni.navigateTo({url:'/pages/atlas/index'})}
function goAed(){uni.switchTab({url:'/pages/aed/index'})}
function openAed(id:string){uni.navigateTo({url:`/pages/aed/detail?id=${id}`})}
function goOrg(){const id=user.orgRoles[0]?.orgId;if(id)uni.navigateTo({url:`/pages/org/dashboard?id=${id}`})}
function goInterests(){uni.navigateTo({url:'/pages/cert/interests'})}
function goUpload(){uni.navigateTo({url:'/pages/cert/upload'})}
function goChangePwd(){uni.navigateTo({url:'/pages/auth/change-pwd'})}
function goPushSettings(){uni.navigateTo({url:'/pages/cert/push-settings'})}
function goLogin(){uni.navigateTo({url:'/pages/auth/login'})}
function doLogout(){authStore.logout();uni.showToast({title:t('mine.toastLoggedOut'),icon:'none'});setTimeout(()=>uni.reLaunch({url:'/pages/home/index'}),800)}
onMounted(()=>{user.loadOrgRoles()})
</script>

<style lang="scss" scoped>
.page-cert{padding-bottom:60rpx}
.profile-header{background:linear-gradient(165deg,#2C3E50 0%,#1A2530 100%);color:#fff;padding:64rpx 48rpx 160rpx}
.profile-avatar{width:128rpx;height:128rpx;border-radius:50%;background:linear-gradient(135deg,var(--rescue-red),var(--rescue-red-deep));display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:48rpx;font-weight:700;margin-bottom:32rpx}
.profile-name{font-family:var(--serif);font-size:44rpx;font-weight:700;display:block;margin-bottom:8rpx}.profile-id{font-family:var(--mono);font-size:22rpx;opacity:0.6;margin-bottom:32rpx;display:block}
.profile-stats{display:flex;gap:24rpx}.profile-stat{flex:1;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:24rpx;padding:24rpx;text-align:center}.profile-stat-num{font-family:var(--mono);font-size:40rpx;font-weight:700;display:block}.profile-stat-label{font-size:20rpx;opacity:0.7;margin-top:8rpx;display:block}
.cert-card{margin:-128rpx 40rpx 32rpx;background:#fff;border-radius:36rpx;padding:48rpx;box-shadow:0 16rpx 64rpx rgba(0,0,0,0.08)}.cert-tier{display:inline-flex;gap:12rpx;background:linear-gradient(135deg,var(--gold),#B8941A);color:#fff;padding:12rpx 28rpx;border-radius:40rpx;font-family:var(--mono);font-size:22rpx;font-weight:700;letter-spacing:2rpx;margin-bottom:32rpx}.cert-name{font-family:var(--serif);font-size:48rpx;font-weight:900;display:block;margin-bottom:16rpx}.cert-issuer{font-size:24rpx;color:var(--ink-mute);margin-bottom:48rpx;display:block}.cert-meta{display:flex;justify-content:space-between;padding-top:32rpx;border-top:1px dashed var(--line)}.cert-meta-item{font-size:22rpx;color:var(--ink-mute)}.cert-meta-value{font-family:var(--mono);font-size:26rpx;font-weight:700;color:var(--ink);display:block;margin-top:4rpx}
.cert-qr{margin:0 40rpx 32rpx;background:#fff;border:1px solid var(--line);border-radius:32rpx;padding:40rpx;display:flex;align-items:center;gap:32rpx}.qr-box{width:180rpx;height:180rpx;background:repeating-linear-gradient(0deg,var(--ink) 0 4rpx,transparent 4rpx 8rpx),repeating-linear-gradient(90deg,var(--ink) 0 4rpx,transparent 4rpx 8rpx);background-size:16rpx 16rpx;border-radius:16rpx;position:relative;flex-shrink:0}.qr-box::after{content:'';position:absolute;inset:60rpx;background:#fff;border-radius:12rpx;border:8rpx solid var(--ink)}.qr-info{flex:1}.qr-info-title{font-family:var(--serif);font-weight:700;font-size:28rpx;display:block;margin-bottom:8rpx}.qr-info-desc{font-size:24rpx;color:var(--ink-mute);display:block}
.cert-actions{display:grid;grid-template-columns:1fr 1fr;gap:20rpx;padding:0 40rpx 40rpx}.cert-action{display:flex;flex-direction:column;align-items:center;gap:8rpx;padding:36rpx 0;background:#fff;border:1px solid var(--line);border-radius:24rpx}.cert-action-icon{font-size:44rpx}.cert-action-label{font-size:22rpx;color:var(--ink-soft);font-weight:600}.cert-action-sub{font-size:18rpx;color:var(--ink-mute);font-family:var(--mono)}
.cert-section{padding:0 40rpx 40rpx}.cert-section-title{font-family:var(--serif);font-size:28rpx;font-weight:700;display:block;margin-bottom:20rpx}.cert-checkin-item{display:flex;align-items:center;gap:16rpx;padding:20rpx;background:#fff;border:1px solid var(--line);border-radius:20rpx;margin-bottom:12rpx}.cert-checkin-icon{width:48rpx;height:48rpx;border-radius:50%;background:var(--green-soft);color:var(--green);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22rpx}.cert-checkin-info{flex:1}.cert-checkin-name{font-size:24rpx;font-weight:600;display:block}.cert-checkin-date{font-size:20rpx;color:var(--ink-mute)}.cert-checkin-count{font-family:var(--mono);font-size:22rpx;color:var(--gold);font-weight:700}.cert-empty{text-align:center;padding:40rpx 0;color:var(--ink-mute);font-size:24rpx}.cert-empty-link{color:var(--rescue-red);font-weight:600;display:block;margin-top:8rpx}
.cert-action-mgr{border-color:var(--gold);background:linear-gradient(135deg,#FFFDF5,#FFF8E1)}.cert-logout{margin:0 40rpx 20rpx;padding:20rpx;text-align:center;background:#FEE2E2;border:1px solid #FECACA;border-radius:16rpx;font-size:24rpx;color:#991B1B;font-weight:600}
.cert-guest-cta{margin:0 40rpx 32rpx;padding:60rpx 40rpx;background:linear-gradient(135deg,#FFF5F5,#FFE8E5);border:2px dashed var(--rescue-red);border-radius:24rpx;text-align:center}.cert-guest-icon{font-size:56rpx;display:block;margin-bottom:12rpx}.cert-guest-title{font-family:var(--serif);font-size:32rpx;font-weight:900;display:block;margin-bottom:8rpx}.cert-guest-desc{font-size:22rpx;color:var(--ink-mute);display:block;margin-bottom:24rpx}.cert-guest-btn{display:inline-block;padding:18rpx 60rpx;background:var(--rescue-red);color:#fff;border-radius:48rpx;font-size:26rpx;font-weight:700}
.cert-guest-links{display:flex;gap:16rpx;padding:0 40rpx}.cert-guest-link{flex:1;padding:24rpx;background:#fff;border:1px solid var(--line);border-radius:16rpx;text-align:center;font-size:24rpx;color:var(--ink-soft);font-weight:600}
.cert-lang{margin:40rpx;padding:28rpx;background:#fff;border:1px solid var(--line);border-radius:20rpx;display:flex;align-items:center;justify-content:space-between;gap:24rpx}
.cert-lang-title{font-family:var(--serif);font-size:26rpx;font-weight:700;color:var(--ink)}
.cert-lang-options{display:flex;gap:16rpx}
.cert-lang-option{padding:14rpx 32rpx;border-radius:32rpx;font-size:24rpx;border:1px solid var(--line);color:var(--ink-mute)}
.cert-lang-option.active{background:var(--ink);color:#fff;border-color:var(--ink)}
</style>
