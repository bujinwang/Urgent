<template>
  <view class="page-custodian-alert">
    <view class="ca-hero">
      <view class="ca-back" @click="goBack">‹</view>
      <text class="ca-title">AED 求助</text>
    </view>

    <!-- 单条求助详情 -->
    <view v-if="alertId" class="ca-card">
      <view v-if="loading" class="ca-muted">加载中…</view>
      <view v-else-if="loadError" class="ca-muted">{{ loadError }}</view>
      <template v-else>
        <view class="ca-row">
          <text class="ca-label">求助人</text>
          <text class="ca-value">{{ alert?.requesterUserName || '急救者' }}</text>
        </view>
        <view class="ca-row">
          <text class="ca-label">设备</text>
          <text class="ca-value">{{ aedName || alert?.aedId }}</text>
        </view>
        <view class="ca-row">
          <text class="ca-label">状态</text>
          <text class="ca-value">{{ statusText }}</text>
        </view>
        <view v-if="isPending" class="ca-row">
          <text class="ca-label">剩余</text>
          <text class="ca-value ca-countdown">{{ countdownText }}</text>
        </view>

        <view v-if="isPending" class="ca-actions">
          <view class="ca-btn ca-btn-deny" @click="onRespond('deny')">拒绝</view>
          <view class="ca-btn ca-btn-ok" @click="onRespond('authorize')">确认授权</view>
        </view>

        <view v-else class="ca-result">
          <text class="ca-result-text">{{ resultText }}</text>
        </view>

        <text class="ca-hint">「确认授权」表示你已知晓并同意对方取用该 AED，便于现场联络，不会远程改变设备状态。</text>
      </template>
    </view>

    <!-- 收件箱（无 alertId 时） -->
    <view v-else class="ca-card">
      <text class="ca-inbox-title">我的待处理求助</text>
      <view v-if="store.inboxLoading" class="ca-muted">加载中…</view>
      <view v-else-if="store.pending.length === 0" class="ca-muted">暂无待处理求助</view>
      <view
        v-for="p in store.pending"
        :key="p.id"
        class="ca-inbox-item"
        @click="openAlert(p.aedId, p.id)"
      >
        <text class="ca-inbox-name">{{ p.requesterUserName || '急救者' }}</text>
        <text class="ca-inbox-sub">{{ p.aedId }} · {{ statusLabel(p.status) }}</text>
      </view>
    </view>

    <view style="height: 60rpx;" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchCustodianAlert } from '@/api/aed-custodian'
import type { CustodianAlert } from '@/api/aed-custodian'
import { fetchAedById } from '@/api/aed'
import { useCustodianAlertStore } from '@/stores/custodian-alert'

const store = useCustodianAlertStore()

const alertId = ref('')
const aedIdParam = ref('')
const alert = ref<CustodianAlert | null>(null)
const aedName = ref('')
const loading = ref(false)
const loadError = ref('')
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | null = null

const isPending = computed(() => {
  const s = alert.value?.status
  return s === 'pending' || s === 'sent' || s === 'unreachable'
})

const countdownText = computed(() => {
  const left = Math.max(0, (alert.value?.slaDeadlineMs || 0) - now.value)
  const sec = Math.ceil(left / 1000)
  return sec > 0 ? sec + 's' : '已超时'
})

const statusText = computed(() => statusLabel(alert.value?.status || ''))

const resultText = computed(() => {
  switch (alert.value?.status) {
    case 'acknowledged': return '已确认授权，请对方取用 AED'
    case 'rejected': return '你已拒绝本次求助，建议对方现场取用并留痕'
    case 'expired': return '已超时，建议对方现场取用并留痕'
    default: return ''
  }
})

function statusLabel(status: string): string {
  switch (status) {
    case 'acknowledged': return '已确认授权'
    case 'rejected': return '已拒绝'
    case 'expired': return '已超时'
    case 'sent': return '已通知'
    case 'unreachable': return '待确认'
    case 'pending': return '待处理'
    default: return status || '待处理'
  }
}

async function loadOne(): Promise<void> {
  if (!alertId.value) return
  loading.value = true
  loadError.value = ''
  try {
    alert.value = await fetchCustodianAlert(aedIdParam.value, alertId.value)
  } catch {
    loadError.value = '加载失败或无权查看该求助'
  }
  loading.value = false
  try {
    const device = await fetchAedById(aedIdParam.value)
    aedName.value = device.name
  } catch { /* 设备名非关键，失败忽略 */ }
}

async function onRespond(action: 'authorize' | 'deny'): Promise<void> {
  const res = await store.respond(aedIdParam.value, alertId.value, action)
  if (res.code === 0) {
    uni.showToast({ title: action === 'authorize' ? '已确认授权' : '已拒绝', icon: 'none' })
    await loadOne()
  } else if (res.code === 4004) {
    uni.showToast({ title: '该求助已被他人确认', icon: 'none' })
    await loadOne()
  } else if (res.code === 4003) {
    uni.showToast({ title: '无权限操作该求助', icon: 'none' })
  } else {
    uni.showToast({ title: res.message || '操作失败', icon: 'none' })
  }
}

function openAlert(aedId: string, alid: string): void {
  uni.navigateTo({ url: `/pages/aed/custodian-alert?alertId=${alid}&aedId=${aedId}` })
}

function goBack(): void {
  uni.navigateBack()
}

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as { options?: Record<string, string> }
  alertId.value = page?.options?.alertId || ''
  aedIdParam.value = page?.options?.aedId || ''
  now.value = Date.now()
  tick = setInterval(() => { now.value = Date.now() }, 1000)
  if (alertId.value) void loadOne()
  else void store.loadInbox()
})

onUnmounted(() => {
  if (tick) { clearInterval(tick); tick = null }
})
</script>

<style lang="scss" scoped>
.page-custodian-alert {
  background: linear-gradient(180deg, #0D2818 0%, #081A10 100%);
  min-height: 100vh;
  color: #fff;
}
.ca-hero {
  position: relative;
  padding: 90rpx 32rpx 24rpx;
  display: flex;
  align-items: center;
}
.ca-back {
  width: 64rpx; height: 64rpx; border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: flex; align-items: center; justify-content: center;
  font-size: 40rpx; margin-right: 20rpx;
}
.ca-title { font-family: var(--serif); font-size: 38rpx; font-weight: 900; }
.ca-card {
  margin: 0 32rpx 24rpx; padding: 32rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 28rpx;
}
.ca-muted { font-size: 26rpx; color: rgba(255, 255, 255, 0.45); }
.ca-row { display: flex; justify-content: space-between; padding: 14rpx 0; }
.ca-label { font-size: 26rpx; color: rgba(255, 255, 255, 0.45); }
.ca-value { font-size: 28rpx; font-weight: 600; }
.ca-countdown { color: #F59E0B; font-family: var(--mono); }
.ca-actions { display: flex; gap: 20rpx; margin-top: 32rpx; }
.ca-btn {
  flex: 1; text-align: center; padding: 28rpx; border-radius: 24rpx;
  font-size: 28rpx; font-weight: 700;
}
.ca-btn-deny {
  background: rgba(255, 107, 91, 0.12); border: 1.5px solid rgba(255, 107, 91, 0.35); color: #FF6B5B;
}
.ca-btn-ok {
  background: linear-gradient(135deg, #34D277, #1F9D57); color: #fff;
}
.ca-result { margin-top: 24rpx; }
.ca-result-text { font-size: 30rpx; font-weight: 700; color: #34D277; }
.ca-hint {
  display: block; margin-top: 28rpx; font-size: 22rpx; line-height: 1.7;
  color: rgba(255, 255, 255, 0.35);
}
.ca-inbox-title { font-family: var(--serif); font-size: 28rpx; font-weight: 700; display: block; margin-bottom: 20rpx; }
.ca-inbox-item {
  padding: 24rpx; border-radius: 20rpx; margin-bottom: 16rpx;
  background: rgba(255, 255, 255, 0.05);
}
.ca-inbox-name { display: block; font-size: 28rpx; font-weight: 600; margin-bottom: 6rpx; }
.ca-inbox-sub { display: block; font-size: 22rpx; color: rgba(255, 255, 255, 0.4); font-family: var(--mono); }
</style>
