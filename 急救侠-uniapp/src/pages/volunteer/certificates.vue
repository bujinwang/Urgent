<template>
  <view class="page-certs">
    <view class="certs-appbar">
      <text class="certs-back" @click="goBack">‹</text>
      <text class="certs-title">{{ t('serviceCert.title') }}</text>
    </view>

    <template v-if="isLoggedIn">
      <view class="certs-card">
        <text class="certs-doc-title">{{ t('serviceCert.docTitle') }}</text>
        <text class="certs-disclaimer">{{ t('serviceCert.disclaimer') }}</text>
      </view>

      <!-- 选区间生成 -->
      <view class="certs-range">
        <text class="certs-range-label">{{ t('serviceCert.rangeFrom') }}</text>
        <input class="certs-range-input" v-model="fromText" :placeholder="t('serviceCert.rangeHint')" />
        <text class="certs-range-label">{{ t('serviceCert.rangeTo') }}</text>
        <input class="certs-range-input" v-model="toText" :placeholder="t('serviceCert.rangeHint')" />
        <view class="certs-btn-primary" @click="onGenerate">{{ t('serviceCert.generate') }}</view>
      </view>

      <!-- 证明列表 -->
      <view class="certs-section">
        <text class="certs-section-title">{{ t('serviceCert.listTitle') }}</text>
        <view v-if="store.certificates.length === 0" class="certs-empty"><text>{{ t('serviceCert.empty') }}</text></view>
        <view v-for="c in store.certificates" :key="c.certNo" class="certs-item">
          <text class="certs-item-no">{{ c.certNo }}</text>
          <text class="certs-item-total">{{ t('serviceCert.totalMinutes', { n: c.totalMinutes }) }}</text>
          <text v-if="c.status === 'revoked'" class="certs-item-status">{{ t('serviceCert.revoked') }}</text>
          <view v-if="c.status === 'active'" class="certs-item-revoke" @click="onRevoke(c.certNo)">{{ t('serviceCert.revoke') }}</view>
        </view>
      </view>

      <view class="certs-print" @click="onPrint">{{ t('serviceCert.print') }}</view>

      <!-- 编号验真（公开能力） -->
      <view class="certs-verify">
        <text class="certs-section-title">{{ t('serviceCert.verifyTitle') }}</text>
        <text class="certs-verify-label">{{ t('serviceCert.verifyInputLabel') }}</text>
        <input class="certs-verify-input" v-model="verifyNo" :placeholder="t('serviceCert.verifyPlaceholder')" />
        <view class="certs-btn-primary" @click="onVerify">{{ t('serviceCert.verify') }}</view>
        <text v-if="verifyResult" class="certs-verify-result">{{ verifyResult }}</text>
      </view>
    </template>

    <view v-else class="certs-guest">
      <text class="certs-guest-icon">🔐</text>
      <text class="certs-guest-title">{{ t('mine.guestTitle') }}</text>
      <text class="certs-guest-desc">{{ t('mine.guestDesc') }}</text>
      <view class="certs-guest-btn" @click="goLogin">{{ t('mine.guestBtn') }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useServiceHoursStore } from '@/stores/serviceHours'
import { useUserStore } from '@/stores/user'
import { i18n } from '@/i18n'

const store = useServiceHoursStore()
const user = useUserStore()

const i18nGlobal = i18n.global as unknown as { t: (key: string, named?: Record<string, unknown>) => string }
function t(key: string, named?: Record<string, unknown>): string {
  return i18nGlobal.t(key, named)
}

const isLoggedIn = computed(() => !!user.profile?.id)

const DAY_MS = 24 * 60 * 60 * 1000

/** 两位补零。 */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}
/** 毫秒 → `YYYY-MM-DD`（本地时间、手写补零）。 */
function ymd(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
/** `YYYY-MM-DD` → 当地零点毫秒；非法/越界 ⇒ `null`。 */
function parseYmd(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim())
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt.getTime()
}

// 默认区间：近 90 天（含今日）
const fromText = ref(ymd(Date.now() - 90 * DAY_MS))
const toText = ref(ymd(Date.now()))
const verifyNo = ref('')
const verifyResult = ref('')

/** 「生成证明」—— 选区间签发（**调用点**）。 */
async function onGenerate(): Promise<void> {
  const from = parseYmd(fromText.value)
  const toDay = parseYmd(toText.value)
  const to = toDay === null ? null : toDay + DAY_MS // 结束日含当日 ⇒ 排它上界取次日零点
  if (from === null || to === null || from >= to) {
    uni.showToast({ title: t('serviceCert.invalidRange'), icon: 'none' })
    return
  }
  try {
    await store.createCertificate(from, to)
  } catch {
    uni.showToast({ title: t('serviceCert.createFailed'), icon: 'none' })
  }
}

/** 「撤销」本人证明（**调用点**）。 */
async function onRevoke(certNo: string): Promise<void> {
  try {
    await store.revokeCertificate(certNo)
  } catch {
    uni.showToast({ title: t('serviceCert.revokeFailed'), icon: 'none' })
  }
}

/** 「验真」（**调用点**）。渲染本地化文案，**不回显后端 message**（否则 en 下会混入中文）。 */
async function onVerify(): Promise<void> {
  const no = verifyNo.value.trim()
  if (!no) return
  try {
    const v = await store.verify(no)
    verifyResult.value = v.status === 'revoked' ? t('serviceCert.verifyRevoked') : t('serviceCert.verifyValid')
  } catch {
    verifyResult.value = t('serviceCert.verifyNotFound')
  }
}

/** 打印：H5 `window.print()`；非 H5 退化 toast（零新依赖）。 */
function onPrint(): void {
  // #ifdef H5
  window.print()
  // #endif
  // #ifndef H5
  uni.showToast({ title: t('serviceCert.printHint'), icon: 'none' })
  // #endif
}

function goBack(): void {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/cert/index' })
}
function goLogin(): void {
  uni.navigateTo({ url: '/pages/auth/login' })
}

onMounted(() => {
  if (isLoggedIn.value) void store.loadCertificates().catch(() => { /* 错误已记录于 store.error */ })
})
</script>

<style lang="scss" scoped>
.page-certs{padding-bottom:60rpx}
.certs-appbar{display:flex;align-items:center;gap:24rpx;padding:28rpx 40rpx}
.certs-back{font-size:48rpx;width:72rpx;height:72rpx;display:flex;align-items:center;justify-content:center}
.certs-title{flex:1;font-family:var(--serif);font-weight:700;font-size:36rpx}
.certs-card{margin:0 40rpx 24rpx;padding:36rpx;border-radius:28rpx;background:#fff;border:1px solid var(--line)}
.certs-doc-title{font-family:var(--serif);font-size:30rpx;font-weight:900;display:block;margin-bottom:12rpx}
.certs-disclaimer{font-size:22rpx;color:var(--ink-mute);display:block}
.certs-range{margin:0 40rpx 32rpx;padding:32rpx;background:#fff;border:1px solid var(--line);border-radius:28rpx}
.certs-range-label{font-size:24rpx;color:var(--ink-mute);display:block;margin-bottom:8rpx}
.certs-range-input{border:1px solid var(--line);border-radius:16rpx;padding:20rpx;margin-bottom:20rpx;font-family:var(--mono);font-size:26rpx}
.certs-btn-primary{padding:28rpx;background:var(--rescue-red);color:#fff;border-radius:24rpx;text-align:center;font-weight:700;font-size:28rpx}
.certs-section{padding:0 40rpx 32rpx}
.certs-section-title{font-family:var(--serif);font-size:28rpx;font-weight:700;display:block;margin-bottom:20rpx}
.certs-empty{text-align:center;padding:48rpx 0;color:var(--ink-mute);font-size:26rpx}
.certs-item{display:flex;align-items:center;gap:16rpx;padding:24rpx;background:#fff;border:1px solid var(--line);border-radius:20rpx;margin-bottom:12rpx;flex-wrap:wrap}
.certs-item-no{font-family:var(--mono);font-size:24rpx;font-weight:700;flex:1}
.certs-item-total{font-size:24rpx}
.certs-item-status{font-size:22rpx;color:var(--rescue-red)}
.certs-item-revoke{padding:12rpx 28rpx;background:#FEE2E2;color:#991B1B;border-radius:16rpx;font-size:22rpx}
.certs-print{margin:0 40rpx 32rpx;padding:28rpx;background:#fff;border:1px solid var(--line);border-radius:24rpx;text-align:center;font-weight:700;font-size:28rpx}
.certs-verify{margin:0 40rpx;padding:32rpx;background:#fff;border:1px solid var(--line);border-radius:28rpx}
.certs-verify-label{font-size:24rpx;color:var(--ink-mute);display:block;margin-bottom:8rpx}
.certs-verify-input{border:1px solid var(--line);border-radius:16rpx;padding:20rpx;margin-bottom:20rpx;font-family:var(--mono);font-size:26rpx}
.certs-verify-result{display:block;margin-top:20rpx;font-size:26rpx;font-weight:700;text-align:center}
.certs-guest{margin:60rpx 40rpx;padding:60rpx 40rpx;background:linear-gradient(135deg,#FFF5F5,#FFE8E5);border:2px dashed var(--rescue-red);border-radius:24rpx;text-align:center}
.certs-guest-icon{font-size:56rpx;display:block;margin-bottom:12rpx}
.certs-guest-title{font-family:var(--serif);font-size:32rpx;font-weight:900;display:block;margin-bottom:8rpx}
.certs-guest-desc{font-size:22rpx;color:var(--ink-mute);display:block;margin-bottom:24rpx}
.certs-guest-btn{display:inline-block;padding:18rpx 60rpx;background:var(--rescue-red);color:#fff;border-radius:48rpx;font-size:26rpx;font-weight:700}
</style>
