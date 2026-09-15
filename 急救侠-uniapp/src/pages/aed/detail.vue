<template>
  <!-- 加载中 -->
  <view v-if="loading" class="page-aed-detail" />

  <!-- 未找到/错误状态 -->
  <view v-else-if="notFound" class="page-aed-detail not-found-page">
    <view class="detail-hero not-found-hero">
      <view class="detail-hero-back" @click="goBack">‹</view>
      <view class="detail-hero-gradient" />
    </view>
    <view class="not-found-body">
      <view class="not-found-icon">🫀</view>
      <text class="not-found-title">{{ $t('aed.detail.notFound.title') }}</text>
      <text class="not-found-sub">{{ $t('aed.detail.notFound.sub') }}</text>
      <view class="not-found-btn" @click="goBack">{{ $t('aed.detail.notFound.back') }}</view>
    </view>
  </view>

  <!-- 正常内容 -->
  <view v-else class="page-aed-detail">
    <!-- 顶部照片区 -->
    <view class="detail-hero">
      <image :src="aed.photo" mode="aspectFill" class="detail-hero-img" />
      <view class="detail-hero-gradient" />
      <view class="detail-hero-back" @click="goBack">‹</view>
      <view class="detail-hero-badge" :class="aed.status">{{ statusLabel }}</view>
    </view>

    <!-- 核心信息 -->
    <view class="detail-info">
      <text class="detail-name">{{ aed.name }}</text>
      <text class="detail-addr">📍 {{ aed.address }}</text>
      <view class="detail-meta-row">
        <view class="detail-meta-tag">📏 {{ aed.distance }}m</view>
        <view class="detail-meta-tag">🏢 {{ aed.indoor ? aed.floor : $t('aed.detail.outdoor') }}</view>
        <view class="detail-meta-tag">🕐 {{ aed.openHours }}</view>
      </view>
    </view>

    <!-- 导航 + 打卡 双按钮 -->
    <view class="detail-actions-row">
      <view class="detail-action-nav" @click="startNavigate">
        <text class="detail-action-nav-icon">🧭</text>
        <text>{{ $t('aed.detail.nav') }}</text>
      </view>
      <view class="detail-action-checkin" @click="startCheckIn">
        <text class="detail-action-nav-icon">📸</text>
        <text>{{ $t('aed.detail.checkin') }}</text>
        <text class="detail-action-checkin-badge">+30⭐</text>
      </view>
    </view>

    <!-- === 打卡表单（拍照后展开） === -->
    <view v-if="checkinState !== 'idle'" class="detail-card detail-checkin-card">
      <text class="detail-card-title">{{ checkinState === 'photo_done' ? $t('aed.detail.checkinFormTitle') : $t('aed.detail.checkinPhotoTitle') }}</text>

      <!-- 已拍预览 -->
      <view v-if="checkinPhoto" class="checkin-preview">
        <image :src="checkinPhoto" mode="aspectFill" class="checkin-preview-img" />
        <view class="checkin-preview-retake" @click="startCheckIn">{{ $t('aed.detail.retake') }}</view>
      </view>

      <!-- 状态选择 -->
      <view v-if="checkinState === 'photo_done'" class="checkin-status-row">
        <view
          class="checkin-status-btn"
          :class="{ active: checkinStatus === 'ok' }"
          @click="checkinStatus = 'ok'"
        >
          <text>{{ $t('aed.detail.statusOk') }}</text>
        </view>
        <view
          class="checkin-status-btn"
          :class="{ active: checkinStatus === 'issue' }"
          @click="checkinStatus = 'issue'"
        >
          <text>{{ $t('aed.detail.statusIssue') }}</text>
        </view>
      </view>

      <!-- 找设备提示输入 -->
      <view v-if="checkinState === 'photo_done'" class="checkin-tip-input-wrap">
        <text class="checkin-tip-label">{{ $t('aed.detail.tipLabel') }}</text>
        <textarea
          v-model="checkinTip"
          class="checkin-tip-textarea"
          :placeholder="$t('aed.detail.tipPlaceholder')"
          :maxlength="200"
          auto-height
        />
        <text class="checkin-tip-count">{{ checkinTip.length }}/200</text>
      </view>

      <!-- 提交 -->
      <view v-if="checkinState === 'photo_done'" class="checkin-submit-row">
        <view class="checkin-btn-cancel" @click="resetCheckIn">{{ $t('common.cancel') }}</view>
        <view class="checkin-btn-submit" @click="submitCheckIn">{{ $t('aed.detail.submit') }}</view>
      </view>
    </view>

    <!-- 找设备指引 -->
    <view class="detail-card">
      <text class="detail-card-title">{{ $t('aed.detail.howToFind') }}</text>
      <text class="detail-finding-text">{{ aed.findingInstructions }}</text>
    </view>

    <!-- 设备信息卡片 -->
    <view class="detail-card">
      <text class="detail-card-title">{{ $t('aed.detail.deviceInfo') }}</text>
      <view class="detail-card-grid">
        <view class="detail-card-item">
          <text class="detail-card-label">{{ $t('aed.detail.label.model') }}</text>
          <text class="detail-card-value">{{ aed.model }}</text>
        </view>
        <view class="detail-card-item">
          <text class="detail-card-label">{{ $t('aed.detail.label.serial') }}</text>
          <text class="detail-card-value">{{ aed.serialNumber }}</text>
        </view>
        <view class="detail-card-item">
          <text class="detail-card-label">{{ $t('aed.detail.label.batteryExpiry') }}</text>
          <text class="detail-card-value" :class="{ expiring: isExpiring(aed.batteryExpiry) }">{{ aed.batteryExpiry }}</text>
        </view>
        <view class="detail-card-item">
          <text class="detail-card-label">{{ $t('aed.detail.label.electrodeExpiry') }}</text>
          <text class="detail-card-value" :class="{ expiring: isExpiring(aed.electrodeExpiry) }">{{ aed.electrodeExpiry }}</text>
        </view>
        <view class="detail-card-item">
          <text class="detail-card-label">{{ $t('aed.detail.label.lastMaintenance') }}</text>
          <text class="detail-card-value">{{ aed.lastMaintenance }}</text>
        </view>
        <view class="detail-card-item">
          <text class="detail-card-label">{{ $t('aed.detail.label.lastCheck') }}</text>
          <text class="detail-card-value">{{ aed.lastCheck }}</text>
        </view>
      </view>
    </view>

    <!-- 责任人卡片（责任人身份以 aed_managers 为准，快照仅作展示；无快照时仍可发起通知） -->
    <view v-if="aed" class="detail-card">
      <text class="detail-card-title">{{ $t('aed.detail.custodian.title') }}</text>
      <view class="detail-custodian">
        <view class="detail-custodian-avatar">{{ aed.custodian?.avatar || $t('aed.detail.custodian.avatarFallback') }}</view>
        <view class="detail-custodian-info">
          <text class="detail-custodian-name">{{ aed.custodian?.name || $t('aed.detail.custodian.nameFallback') }}</text>
          <text class="detail-custodian-role">{{ aed.custodian?.role || $t('aed.detail.custodian.roleFallback') }}</text>
        </view>
        <view class="detail-custodian-contact" @click="notifyOwner">
          <text>{{ $t('aed.detail.custodian.notify') }}</text>
        </view>
      </view>
    </view>

    <!-- 责任人联动状态（通知 / 确认授权） -->
    <view v-if="caStore.activeAlertId || caState.showFallback" class="detail-card detail-custodian-link">
      <text class="detail-card-title">{{ $t('aed.detail.link.title') }}</text>

      <view v-if="caState.showFallback" class="ca-fallback">
        <text class="ca-fallback-text">{{ $t('aed.detail.link.noCustodian') }}</text>
        <view class="ca-fallback-btn" @click="doPickup">{{ $t('aed.detail.link.pickup') }}</view>
      </view>

      <template v-else>
        <view class="ca-line">
          <text class="ca-line-label">{{ $t('aed.detail.link.statusLabel') }}</text>
          <text class="ca-line-value">{{ caStatusText }}</text>
        </view>
        <view v-if="caPending" class="ca-line">
          <text class="ca-line-label">{{ $t('aed.detail.link.countdownLabel') }}</text>
          <text class="ca-line-value ca-count">{{ caCountdown }}</text>
        </view>
        <view class="ca-actions">
          <view v-if="caAcknowledged" class="ca-btn ca-btn-ok" @click="doPickup">{{ $t('aed.detail.link.confirmPickup') }}</view>
          <view v-if="caStore.consentGranted" class="ca-btn ca-btn-ghost" @click="withdrawConsent">{{ $t('aed.detail.link.withdraw') }}</view>
        </view>
        <text class="ca-note">{{ $t('aed.detail.link.note') }}</text>
      </template>
    </view>

    <!-- 打卡时间线 -->
    <view class="detail-card" v-if="aed.checkIns.length > 0">
      <text class="detail-card-title">{{ $t('aed.detail.timeline.title', { n: aed.checkIns.length }) }}</text>
      <view class="detail-timeline">
        <view v-for="(ci, idx) in aed.checkIns" :key="ci.id" class="detail-timeline-item" :class="{ last: idx === aed.checkIns.length - 1 }">
          <view class="detail-timeline-dot" :class="{ issue: ci.status === 'issue' }" />
          <view class="detail-timeline-line" v-if="idx < aed.checkIns.length - 1" />
          <view class="detail-timeline-content">
            <view class="detail-timeline-photo">
              <image :src="ci.photo" mode="aspectFill" class="detail-timeline-img" />
            </view>
            <view class="detail-timeline-body">
              <text class="detail-timeline-user">{{ ci.userName }} · {{ ci.status === 'ok' ? $t('aed.detail.timeline.ok') : $t('aed.detail.timeline.issue') }}</text>
              <text class="detail-timeline-comment">{{ ci.comment }}</text>
              <text v-if="ci.findingTip" class="detail-timeline-tip">💡 {{ ci.findingTip }}</text>
              <text class="detail-timeline-date">{{ ci.date }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 空打卡 -->
    <view v-else class="detail-card">
      <text class="detail-card-title">{{ $t('aed.detail.timeline.emptyTitle') }}</text>
      <view class="detail-empty-checkin">
        <text class="detail-empty-icon">📸</text>
        <text class="detail-empty-text">{{ $t('aed.detail.empty.title') }}</text>
        <text class="detail-empty-sub">{{ $t('aed.detail.empty.sub') }}</text>
      </view>
    </view>

    <view style="height: 60rpx;" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useAedStore } from '@/stores/aed'
import { fetchAedById, mapApiDeviceToView, createAedPickup } from '@/api/aed'
import type { AedDevice } from '@/api/aed'
import { AlertCode } from '@/api/aed-custodian'
import { useCustodianAlertStore } from '@/stores/custodian-alert'
import { useUserStore } from '@/stores/user'
import { i18n, getLocale } from '@/i18n'
import { PICKUP_FALLBACK_NOTE, auditCheckinComment } from '@/constants/audit-notes'

const aedStore = useAedStore()
const caStore = useCustodianAlertStore()
const userStore = useUserStore()

/**
 * 全局组合式 i18n 实例（收窄为组合式形态，便可在 `computed` / 函数体 / 回调里安全取值）。
 * ⚠️ `t` **只能**在 `computed` / 函数体 / 回调里调用：顶层取值会**冻结语言**
 * （切 en-US 后仍显示中文，见设计 §11.1）。
 */
const i18nGlobal = i18n.global as unknown as {
  locale: { value: string }
  t: (key: string, named?: Record<string, unknown>) => string
}
function t(key: string, named?: Record<string, unknown>): string {
  return i18nGlobal.t(key, named)
}

const aed = ref<AedDevice | null>(null)
const loading = ref(true)
const notFound = ref(false)
const checkinState = ref<'idle' | 'taking_photo' | 'photo_done'>('idle')
const checkinPhoto = ref('')
const checkinStatus = ref<'ok' | 'issue'>('ok')
const checkinTip = ref('')

// 责任人联动本地 UI 态（只存**状态**不存文本：文案由模板按当前语言渲染，避免"文本冻结"）
const caState = ref<{ showFallback: boolean }>({ showFallback: false })
const caNow = ref(Date.now())
let caTicker: ReturnType<typeof setInterval> | null = null
/** 进页自动打卡的延后句柄（**必须**在 unmount 清理，否则 500ms 内离开页面仍会拉起相机）。 */
let checkinTimer: ReturnType<typeof setTimeout> | null = null

const statusLabel = computed(() => {
  if (!aed.value) return ''
  if (aed.value.status === 'maintenance') return t('aed.detail.status.maintenance')
  return aed.value.verified
    ? t('aed.detail.status.verified')
    : aed.value.discovered ? t('aed.detail.status.discovered') : t('aed.detail.status.available')
})

const caPending = computed(() =>
  caStore.status === 'pending' || caStore.status === 'sent' || caStore.status === 'unreachable'
)
const caAcknowledged = computed(() => caStore.status === 'acknowledged')
const caStatusText = computed(() => {
  switch (caStore.status) {
    case 'sent': return t('aed.detail.ca.sent')
    case 'pending': return t('aed.detail.ca.pending')
    case 'unreachable': return t('aed.detail.ca.unreachable')
    case 'acknowledged': return t('aed.detail.ca.acknowledged')
    case 'rejected': return t('aed.detail.ca.rejected')
    case 'expired': return t('aed.detail.ca.expired')
    default: return ''
  }
})
const caCountdown = computed(() => {
  const left = Math.max(0, caStore.slaDeadlineMs - caNow.value)
  const sec = Math.ceil(left / 1000)
  return sec > 0 ? sec + 's' : t('aed.detail.ca.timeout')
})

/** 真实接口取设备；失败即视为未找到（不再回退 mock，避免把假数据当真实结果）。 */
async function loadAed(id: string): Promise<void> {
  const known = aedStore.aeds.find((a) => a.id === id)
  try {
    const raw = await fetchAedById(id)
    aed.value = mapApiDeviceToView(raw, {
      discovered: known?.discovered ?? true,
      verified: known?.verified ?? false,
    })
  } catch {
    notFound.value = true
    return
  }
  aedStore.discoverAed(id)
}

onMounted(async () => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as { options?: Record<string, string> }
  const id = page?.options?.id
  const action = page?.options?.action
  if (id) await loadAed(id)
  else notFound.value = true
  loading.value = false

  caNow.value = Date.now()
  caTicker = setInterval(() => { caNow.value = Date.now() }, 1000)

  if (action === 'checkin' && id && aed.value) {
    // ⚠️ 句柄必须存下并在 onUnmounted 清理（P0-3 §11.3 同类泄漏）：否则 500ms 内离开页面仍会拉起相机。
    checkinTimer = setTimeout(() => { checkinTimer = null; startCheckIn() }, 500)
  }
})

onUnmounted(() => {
  if (caTicker) { clearInterval(caTicker); caTicker = null }
  if (checkinTimer) { clearTimeout(checkinTimer); checkinTimer = null }
  caStore.stopPolling()
})

function goBack() { uni.navigateBack() }

function isExpiring(date: string): boolean {
  if (!date) return false
  const target = new Date(date)
  const now = new Date()
  const monthsDiff = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  return monthsDiff <= 6
}

function startNavigate() {
  if (!aed.value) return
  aedStore.navigateToAed(aed.value)
}

function startCheckIn() {
  checkinState.value = 'taking_photo'
  uni.chooseImage({
    count: 1,
    sourceType: ['camera'],
    success: (res) => {
      checkinPhoto.value = res.tempFilePaths[0]
      checkinState.value = 'photo_done'
      checkinStatus.value = 'ok'
      checkinTip.value = ''
    },
    fail: () => {
      checkinState.value = 'idle'
      uni.showToast({ title: t('aed.detail.toast.cameraDenied'), icon: 'none' })
    },
  })
}

function resetCheckIn() {
  checkinState.value = 'idle'
  checkinPhoto.value = ''
  checkinTip.value = ''
}

function submitCheckIn() {
  if (!checkinPhoto.value || !aed.value) return
  // ⚠️ `comment` 是**写进后端**的审计数据 ⇒ 恒 zh-CN、不本地化（设计 §13 D3，见 constants/audit-notes）。
  const comment = auditCheckinComment(checkinStatus.value)
  const id = aed.value.id
  aedStore.checkInAed(id, checkinPhoto.value, checkinStatus.value, comment, checkinTip.value || undefined)
  uni.showToast({
    title: checkinStatus.value === 'ok' ? t('aed.detail.toast.checkinOk') : t('aed.detail.toast.checkinIssue'),
    icon: 'none',
    duration: 2000,
  })
  // 重新取最新设备（含最新打卡记录）
  void loadAed(id)
  resetCheckIn()
}

/** 弹出 PIPL 信息共享同意框。 */
function requestConsent(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: t('aed.detail.consent.title'),
      content: t('aed.detail.consent.content'),
      confirmText: t('aed.detail.consent.confirm'),
      cancelText: t('common.cancel'),
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    })
  })
}

/** 通知责任人：同意 → 调接口 → 按业务码分支 → 轮询等待「确认授权」。 */
async function notifyOwner() {
  if (!aed.value) return
  caState.value.showFallback = false
  const agreed = await requestConsent()
  if (!agreed) {
    uni.showToast({ title: t('aed.detail.toast.consentCancelled'), icon: 'none' })
    return
  }
  const res = await caStore.notify(aed.value.id)
  if (res.code === 0) {
    caStore.startPolling()
    uni.showToast({ title: t('aed.detail.toast.notified'), icon: 'none' })
  } else if (res.code === AlertCode.NO_CUSTODIAN) {
    // 兜底文案由模板按当前语言渲染（`aed.detail.link.noCustodian`），此处只切状态，避免"文本冻结"。
    caState.value.showFallback = true
  } else if (res.code === AlertCode.CONSENT_REQUIRED) {
    uni.showToast({ title: t('aed.detail.toast.consentRequired'), icon: 'none' })
  } else {
    // D1（设计 §13）：后端 `message` 恒中文。zh-CN 保留后端原文；en-US 走本地化通用兜底，
    // **绝不**把中文塞进英文界面。
    const fallback = t('aed.detail.toast.notifyFailed')
    const title = getLocale() === 'zh-CN' ? (res.message || fallback) : fallback
    uni.showToast({ title, icon: 'none' })
  }
}

/** 取用登记（先取用后留痕，兜底路径不阻断急救）。 */
async function doPickup() {
  if (!aed.value) return
  try {
    await createAedPickup(aed.value.id, {
      userId: userStore.profile.id,
      userName: userStore.profile.name,
      // ⚠️ `notes` 是**写进后端**的审计数据 ⇒ 恒 zh-CN、不本地化（设计 §13 D3）。
      notes: PICKUP_FALLBACK_NOTE,
    })
    uni.showToast({ title: t('aed.detail.toast.pickupOk'), icon: 'none' })
  } catch {
    uni.showToast({ title: t('aed.detail.toast.pickupFailed'), icon: 'none' })
  }
}

/** 撤回信息共享同意（PIPL）。 */
async function withdrawConsent() {
  if (!aed.value || !caStore.activeAlertId) return
  const ok = await caStore.revoke(aed.value.id, caStore.activeAlertId, 'user-initiated')
  uni.showToast({ title: ok ? t('aed.detail.toast.withdrawOk') : t('aed.detail.toast.withdrawFailed'), icon: 'none' })
}
</script>

<style lang="scss" scoped>
.page-aed-detail {
  background: linear-gradient(180deg, #0D2818 0%, #081A10 100%);
  min-height: 100vh;
  color: #fff;
}

/* 演习横幅 */
.drill-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 14rpx 32rpx;
  background: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.15);
}
.drill-banner-icon { font-size: 24rpx; }
.drill-banner-text { font-size: 20rpx; color: #F59E0B; font-weight: 600; }

/* 顶部照片 */
.detail-hero {
  position: relative;
  height: 420rpx;
  overflow: hidden;
}
.detail-hero-img { width: 100%; height: 100%; }
.detail-hero-gradient {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 50%, #0D2818 100%);
}
.detail-hero-back {
  position: absolute; top: 24rpx; left: 24rpx;
  width: 72rpx; height: 72rpx; border-radius: 50%;
  background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(12rpx);
  display: flex; align-items: center; justify-content: center;
  font-size: 44rpx; color: #fff; z-index: 2;
}
.detail-hero-badge {
  position: absolute; top: 32rpx; right: 32rpx;
  padding: 10rpx 24rpx; border-radius: 24rpx;
  font-family: var(--mono); font-size: 22rpx; font-weight: 700; z-index: 2;
  &.available { background: rgba(52, 210, 119, 0.85); }
  &.maintenance { background: rgba(255, 107, 91, 0.85); }
}

/* 核心信息 */
.detail-info { padding: 0 32rpx 28rpx; margin-top: -40rpx; position: relative; z-index: 3; }
.detail-name { font-family: var(--serif); font-size: 44rpx; font-weight: 900; display: block; margin-bottom: 8rpx; }
.detail-addr { font-size: 26rpx; color: rgba(255, 255, 255, 0.5); display: block; margin-bottom: 16rpx; }
.detail-meta-row { display: flex; gap: 12rpx; flex-wrap: wrap; }
.detail-meta-tag {
  padding: 6rpx 16rpx; background: rgba(255, 255, 255, 0.06);
  border-radius: 16rpx; font-size: 22rpx; color: rgba(255, 255, 255, 0.5); font-family: var(--mono);
}

/* 双按钮行 */
.detail-actions-row {
  display: flex; gap: 16rpx; margin: 0 32rpx 24rpx;
}
.detail-action-nav {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 12rpx;
  padding: 28rpx; background: rgba(59, 130, 246, 0.12);
  border: 1.5px solid rgba(59, 130, 246, 0.25); border-radius: 24rpx;
  font-size: 26rpx; font-weight: 700; color: #60A5FA;
  &:active { background: rgba(59, 130, 246, 0.22); }
}
.detail-action-nav-icon { font-size: 32rpx; }
.detail-action-checkin {
  flex: 1.2; display: flex; align-items: center; justify-content: center; gap: 10rpx;
  padding: 28rpx; background: linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(245, 158, 11, 0.06));
  border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 24rpx;
  font-size: 26rpx; font-weight: 700; color: #F59E0B; position: relative;
  &:active { background: rgba(245, 158, 11, 0.28); }
}
.detail-action-checkin-badge {
  position: absolute; top: -10rpx; right: 16rpx;
  padding: 4rpx 14rpx; background: #F59E0B; color: #1A1A1A;
  font-size: 18rpx; font-weight: 700; border-radius: 16rpx; font-family: var(--mono);
}

/* ============ 打卡表单 ============ */
.detail-checkin-card { border-color: rgba(245, 158, 11, 0.15); }
.checkin-preview {
  position: relative; border-radius: 16rpx; overflow: hidden; margin-bottom: 24rpx; height: 240rpx;
}
.checkin-preview-img { width: 100%; height: 100%; }
.checkin-preview-retake {
  position: absolute; bottom: 12rpx; right: 12rpx;
  padding: 8rpx 20rpx; background: rgba(0, 0, 0, 0.5); color: #fff;
  border-radius: 16rpx; font-size: 22rpx;
}
.checkin-status-row { display: flex; gap: 16rpx; margin-bottom: 24rpx; }
.checkin-status-btn {
  flex: 1; padding: 24rpx; border-radius: 20rpx; text-align: center;
  border: 2px solid rgba(255, 255, 255, 0.1); font-size: 26rpx; font-weight: 600; color: rgba(255, 255, 255, 0.5);
  &.active { border-color: rgba(245, 158, 11, 0.5); background: rgba(245, 158, 11, 0.1); color: #F59E0B; }
}
.checkin-tip-input-wrap { margin-bottom: 24rpx; }
.checkin-tip-label { font-size: 24rpx; color: rgba(255, 255, 255, 0.5); display: block; margin-bottom: 12rpx; }
.checkin-tip-textarea {
  width: 100%; min-height: 120rpx; padding: 20rpx; background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16rpx;
  color: #fff; font-size: 24rpx; line-height: 1.6;
}
.checkin-tip-count { font-size: 20rpx; color: rgba(255, 255, 255, 0.3); text-align: right; display: block; margin-top: 8rpx; }
.checkin-submit-row { display: flex; gap: 16rpx; }
.checkin-btn-cancel {
  flex: 1; padding: 24rpx; border-radius: 20rpx; text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.1); font-size: 26rpx; font-weight: 600; color: rgba(255, 255, 255, 0.5);
}
.checkin-btn-submit {
  flex: 2; padding: 24rpx; border-radius: 20rpx; text-align: center;
  background: linear-gradient(135deg, #F59E0B, #D97706); color: #fff; font-size: 26rpx; font-weight: 700;
}

/* ============ 找设备指引 ============ */
.detail-finding-text {
  font-size: 24rpx; line-height: 1.8; color: rgba(255, 255, 255, 0.65);
}

/* 通用卡片 */
.detail-card {
  margin: 0 32rpx 24rpx; padding: 32rpx;
  background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 28rpx;
}
.detail-card-title { font-family: var(--serif); font-size: 28rpx; font-weight: 700; display: block; margin-bottom: 24rpx; }

/* 设备信息网格 */
.detail-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.detail-card-item { display: flex; flex-direction: column; gap: 6rpx; }
.detail-card-label { font-size: 20rpx; color: rgba(255, 255, 255, 0.35); font-family: var(--mono); letter-spacing: 1rpx; }
.detail-card-value { font-size: 24rpx; font-weight: 600; &.expiring { color: #FF6B5B; } }

/* 责任人 */
.detail-custodian { display: flex; align-items: center; gap: 20rpx; }
.detail-custodian-avatar {
  width: 72rpx; height: 72rpx; border-radius: 50%;
  background: linear-gradient(135deg, #4A90E2, #2563EB); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 700; flex-shrink: 0;
}
.detail-custodian-info { flex: 1; }
.detail-custodian-name { display: block; font-size: 26rpx; font-weight: 600; margin-bottom: 4rpx; }
.detail-custodian-role { display: block; font-size: 22rpx; color: rgba(255, 255, 255, 0.45); }
.detail-custodian-contact {
  padding: 16rpx 28rpx; background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 20rpx;
  font-size: 24rpx; color: #60A5FA; font-weight: 600;
}

/* 打卡时间线 */
.detail-timeline { padding-left: 16rpx; }
.detail-timeline-item { display: flex; position: relative; padding-bottom: 24rpx; &.last { padding-bottom: 0; } }
.detail-timeline-dot {
  width: 16rpx; height: 16rpx; border-radius: 50%; background: #34D277;
  flex-shrink: 0; margin-top: 12rpx; margin-right: 24rpx; position: relative; z-index: 1;
  &.issue { background: #FF6B5B; }
}
.detail-timeline-line { position: absolute; left: 7rpx; top: 32rpx; bottom: 0; width: 2rpx; background: rgba(255, 255, 255, 0.08); }
.detail-timeline-content { flex: 1; display: flex; gap: 16rpx; }
.detail-timeline-photo { width: 100rpx; height: 100rpx; border-radius: 16rpx; overflow: hidden; flex-shrink: 0; }
.detail-timeline-img { width: 100%; height: 100%; }
.detail-timeline-body { flex: 1; }
.detail-timeline-user { display: block; font-size: 24rpx; font-weight: 600; margin-bottom: 4rpx; }
.detail-timeline-comment { display: block; font-size: 22rpx; color: rgba(255, 255, 255, 0.45); margin-bottom: 4rpx; }
.detail-timeline-tip {
  display: block; font-size: 22rpx; color: rgba(245, 158, 11, 0.7);
  background: rgba(245, 158, 11, 0.06); padding: 8rpx 16rpx; border-radius: 12rpx;
  margin: 8rpx 0; line-height: 1.5;
}
.detail-timeline-date { display: block; font-size: 20rpx; color: rgba(255, 255, 255, 0.2); font-family: var(--mono); }

/* 空打卡 */
.detail-empty-checkin { text-align: center; padding: 40rpx 0; }
.detail-empty-icon { font-size: 56rpx; display: block; margin-bottom: 16rpx; }
.detail-empty-text { font-size: 24rpx; color: rgba(255, 255, 255, 0.4); display: block; margin-bottom: 8rpx; }
.detail-empty-sub { font-size: 20rpx; color: rgba(255, 255, 255, 0.25); display: block; }

/* 未找到状态（暗色主题） */
.not-found-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.not-found-hero {
  height: 200rpx;
  background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
}
.not-found-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 48rpx;
  text-align: center;
}
.not-found-icon {
  font-size: 96rpx;
  margin-bottom: 32rpx;
  opacity: 0.4;
}
.not-found-title {
  font-size: 36rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 16rpx;
}
.not-found-sub {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.35);
  margin-bottom: 48rpx;
  line-height: 1.6;
}
.not-found-btn {
  padding: 20rpx 64rpx;
  background: rgba(59, 130, 246, 0.25);
  border: 1.5px solid rgba(59, 130, 246, 0.4);
  color: #60A5FA;
  border-radius: 48rpx;
  font-size: 28rpx;
  font-weight: 600;
  &:active {
    background: rgba(59, 130, 246, 0.4);
  }
}

/* ============ 责任人联动 ============ */
.detail-custodian-link { border-color: rgba(52, 210, 119, 0.18); }
.ca-line { display: flex; justify-content: space-between; padding: 12rpx 0; }
.ca-line-label { font-size: 24rpx; color: rgba(255, 255, 255, 0.45); }
.ca-line-value { font-size: 26rpx; font-weight: 600; }
.ca-count { color: #F59E0B; font-family: var(--mono); }
.ca-actions { display: flex; gap: 16rpx; margin-top: 24rpx; }
.ca-btn {
  text-align: center; padding: 22rpx 32rpx; border-radius: 20rpx; font-size: 26rpx; font-weight: 700;
}
.ca-btn-ok { flex: 1; background: linear-gradient(135deg, #34D277, #1F9D57); color: #fff; }
.ca-btn-ghost {
  background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
}
.ca-note { display: block; margin-top: 20rpx; font-size: 20rpx; line-height: 1.6; color: rgba(255, 255, 255, 0.3); }
.ca-fallback-text { display: block; font-size: 26rpx; line-height: 1.7; color: rgba(255, 255, 255, 0.65); }
.ca-fallback-btn {
  margin-top: 24rpx; text-align: center; padding: 24rpx; border-radius: 20rpx;
  background: rgba(245, 158, 11, 0.15); border: 1.5px solid rgba(245, 158, 11, 0.35);
  color: #F59E0B; font-size: 26rpx; font-weight: 700;
}
</style>
