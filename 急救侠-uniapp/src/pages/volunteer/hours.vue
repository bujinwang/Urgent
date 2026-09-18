<template>
  <view class="page-hours">
    <view class="hours-appbar">
      <text class="hours-back" @click="goBack">‹</text>
      <text class="hours-title">{{ t('hours.title') }}</text>
    </view>

    <template v-if="isLoggedIn">
      <!-- ★ 加载失败态：**必须与空态可区分** —— 空态说「暂无服务记录」，此处说「加载失败」+ 重试按钮。
           若两者混同，用户会把"网络失败"误读成"**我的时长没了**"（时长=权益凭证，最不该发生的误导）。 -->
      <view v-if="store.error" class="hours-error">
        <text class="hours-error-text">{{ t('hours.loadFailed') }}</text>
        <view class="hours-error-retry" @click="onRetry">{{ t('hours.retry') }}</view>
      </view>

      <template v-else>
      <view class="hours-total">
        <text class="hours-total-label">{{ t('hours.total') }}</text>
        <text class="hours-total-value">{{ t('hours.minutes', { n: store.totalMinutes }) }}</text>
      </view>

      <view class="hours-actions">
        <view class="hours-btn-primary" @click="onGenerate">{{ t('hours.generate') }}</view>
        <view class="hours-btn-secondary" @click="onExportCsv">{{ t('hours.exportCsv') }}</view>
      </view>

      <!-- 分项：**数据驱动**（§2.4：P0 实际只有 rescue_task，布局不得写死分项数） -->
      <view class="hours-section">
        <text class="hours-section-title">{{ t('hours.breakdownTitle') }}</text>
        <view v-if="store.breakdown.length === 0" class="hours-empty"><text>{{ t('hours.empty') }}</text></view>
        <view v-for="b in store.breakdown" :key="b.activityType" class="hours-break-card">
          <text class="hours-break-name">{{ activityName(b.activityType) }}</text>
          <text class="hours-break-min">{{ t('hours.minutes', { n: b.minutes }) }}</text>
        </view>
      </view>

      <view class="hours-section">
        <text class="hours-section-title">{{ t('hours.detailTitle') }}</text>
        <view v-if="store.items.length === 0" class="hours-empty"><text>{{ t('hours.empty') }}</text></view>
        <view v-for="it in store.items" :key="it.id" class="hours-item">
          <text class="hours-item-date">{{ formatDateTimeMs(it.startedAtMs) }}</text>
          <text class="hours-item-name">{{ activityName(it.activityType) }}</text>
          <text class="hours-item-min">{{ t('hours.minutes', { n: it.durationMin }) }}</text>
        </view>
      </view>

      <view class="hours-pager">
        <view class="hours-page-btn" @click="prevPage">{{ t('hours.prev') }}</view>
        <text class="hours-page-info">{{ t('hours.page', { page: store.page }) }}</text>
        <view class="hours-page-btn" @click="nextPage">{{ t('hours.next') }}</view>
      </view>
      </template>
    </template>

    <!-- 游客态：明确引导（不是空白） -->
    <view v-else class="hours-guest">
      <text class="hours-guest-icon">🔐</text>
      <text class="hours-guest-title">{{ t('mine.guestTitle') }}</text>
      <text class="hours-guest-desc">{{ t('mine.guestDesc') }}</text>
      <view class="hours-guest-btn" @click="goLogin">{{ t('mine.guestBtn') }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useServiceHoursStore } from '@/stores/serviceHours'
import { useUserStore } from '@/stores/user'
import { i18n } from '@/i18n'
import { serviceHoursToCsv, serviceHoursCsvFilename, formatDateTimeMs } from '@/utils/serviceExport'
import { downloadText } from '@/utils/govExport'
import { useLocalizedNavTitle } from '@/utils/nav-title-locale'

const store = useServiceHoursStore()
const user = useUserStore()

/** `t` 只能在 computed / 函数体 / 回调里调用（顶层取值会冻结语言，见设计 §3.5）。 */
const i18nGlobal = i18n.global as unknown as { t: (key: string, named?: Record<string, unknown>) => string }
function t(key: string, named?: Record<string, unknown>): string {
  return i18nGlobal.t(key, named)
}

/** 登录态由 `user.profile.id` 决定（响应式；游客为 ''）。用 `?.` 容忍 profile 尚未/无法加载。 */
const isLoggedIn = computed(() => !!user.profile?.id)

/**
 * `activity_type` → i18n 键（**页面用本地化标签**；CSV 用固定中文，二者刻意分开）。
 * 未收录类型**回落原始值**（数据驱动，不丢行）。
 */
const ACTIVITY_KEYS: Record<string, string> = {
  rescue_task: 'hours.activity.rescue_task',
  drill: 'hours.activity.drill',
  training: 'hours.activity.training',
  aed_checkin: 'hours.activity.aed_checkin',
  manual: 'hours.activity.manual',
}
function activityName(activityType: string): string {
  const key = ACTIVITY_KEYS[activityType]
  return key ? t(key) : activityType
}

/** 「生成证明」⇒ 进入证明页（选区间生成在那里）。 */
function onGenerate(): void {
  uni.navigateTo({ url: '/pages/volunteer/certificates' })
}

/** 「导出 CSV」—— 生成物走 `serviceExport`（固定中文措辞），下载走 `govExport.downloadText`。 */
function onExportCsv(): void {
  const csv = serviceHoursToCsv({
    name: user.profile?.name ?? '',
    totalMinutes: store.totalMinutes,
    breakdown: store.breakdown,
    items: store.items,
  })
  downloadText(serviceHoursCsvFilename(), csv, 'text/csv')
}

function prevPage(): void {
  if (store.page > 1) store.setPage(store.page - 1)
}
function nextPage(): void {
  if (store.page * store.pageSize < store.total) store.setPage(store.page + 1)
}
function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/cert/index' })
}
function goLogin(): void {
  uni.navigateTo({ url: '/pages/auth/login' })
}

// 原生导航栏标题随语言切换（P1b）；本页有标准原生标题栏 ⇒ 必须接线（见 nav-title-locale.test.ts 的守卫）。
useLocalizedNavTitle('nav.hours')

/** 加载「我的时长」——失败**记录于 `store.error`**（页面据此渲染**失败态**，绝不静默落空态）。 */
function load(): void {
  void store.loadHours().catch(() => { /* 错误已记录于 store.error ⇒ 渲染失败态（不静默吞掉） */ })
}

/** 失败态「重试」。 */
function onRetry(): void {
  load()
}

onMounted(() => {
  if (isLoggedIn.value) load()
})
</script>

<style lang="scss" scoped>
.page-hours{padding-bottom:60rpx}
.hours-appbar{display:flex;align-items:center;gap:24rpx;padding:28rpx 40rpx}
.hours-back{font-size:48rpx;width:72rpx;height:72rpx;display:flex;align-items:center;justify-content:center}
.hours-title{flex:1;font-family:var(--serif);font-weight:700;font-size:36rpx}
.hours-total{margin:0 40rpx 24rpx;padding:40rpx;border-radius:32rpx;background:linear-gradient(135deg,#FFF5F5,#FFE8E5);border:1px solid var(--line);text-align:center}
.hours-total-label{font-size:24rpx;color:var(--ink-mute);display:block;margin-bottom:12rpx}
.hours-total-value{font-family:var(--mono);font-size:52rpx;font-weight:700}
.hours-actions{display:flex;gap:20rpx;padding:0 40rpx 32rpx}
.hours-btn-primary{flex:1;padding:28rpx;background:var(--rescue-red);color:#fff;border-radius:24rpx;text-align:center;font-weight:700;font-size:28rpx}
.hours-btn-secondary{flex:1;padding:28rpx;background:#fff;border:1px solid var(--line);border-radius:24rpx;text-align:center;font-weight:700;font-size:28rpx}
.hours-section{padding:0 40rpx 32rpx}
.hours-section-title{font-family:var(--serif);font-size:28rpx;font-weight:700;display:block;margin-bottom:20rpx}
.hours-empty{text-align:center;padding:48rpx 0;color:var(--ink-mute);font-size:26rpx}
.hours-error{margin:0 40rpx 32rpx;padding:48rpx 32rpx;background:#FEF2F2;border:1px solid #FECACA;border-radius:24rpx;text-align:center}
.hours-error-text{display:block;color:#991B1B;font-size:26rpx;margin-bottom:24rpx}
.hours-error-retry{display:inline-block;padding:16rpx 56rpx;background:var(--rescue-red);color:#fff;border-radius:40rpx;font-size:26rpx;font-weight:700}
.hours-break-card{display:flex;justify-content:space-between;align-items:center;padding:28rpx;background:#fff;border:1px solid var(--line);border-radius:20rpx;margin-bottom:12rpx}
.hours-break-name{font-size:26rpx;font-weight:600}
.hours-break-min{font-family:var(--mono);font-size:26rpx;font-weight:700;color:var(--rescue-red)}
.hours-item{display:flex;align-items:center;gap:16rpx;padding:24rpx;background:#fff;border:1px solid var(--line);border-radius:20rpx;margin-bottom:12rpx}
.hours-item-date{font-family:var(--mono);font-size:22rpx;color:var(--ink-mute);flex:1}
.hours-item-name{font-size:24rpx;font-weight:600}
.hours-item-min{font-family:var(--mono);font-size:24rpx;font-weight:700}
.hours-pager{display:flex;align-items:center;justify-content:center;gap:24rpx;padding:0 40rpx}
.hours-page-btn{padding:18rpx 40rpx;background:#fff;border:1px solid var(--line);border-radius:20rpx;font-size:24rpx}
.hours-page-info{font-family:var(--mono);font-size:24rpx;color:var(--ink-mute)}
.hours-guest{margin:60rpx 40rpx;padding:60rpx 40rpx;background:linear-gradient(135deg,#FFF5F5,#FFE8E5);border:2px dashed var(--rescue-red);border-radius:24rpx;text-align:center}
.hours-guest-icon{font-size:56rpx;display:block;margin-bottom:12rpx}
.hours-guest-title{font-family:var(--serif);font-size:32rpx;font-weight:900;display:block;margin-bottom:8rpx}
.hours-guest-desc{font-size:22rpx;color:var(--ink-mute);display:block;margin-bottom:24rpx}
.hours-guest-btn{display:inline-block;padding:18rpx 60rpx;background:var(--rescue-red);color:#fff;border-radius:48rpx;font-size:26rpx;font-weight:700}
</style>
