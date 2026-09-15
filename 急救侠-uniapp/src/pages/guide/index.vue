<template>
  <view class="page-guide">
    <view class="guide-appbar">
      <text class="guide-back" @click="goBack">‹</text>
      <text class="guide-title">{{ guideTitle }}</text>
      <text class="guide-step-indicator">{{ current + 1 }} / {{ stepCount }}</text>
    </view>

    <!-- 场景图 -->
    <view class="guide-scene">
      <view class="scene-icon-wrap" :class="sceneAnim">
        <text class="scene-emoji">{{ currentIcon }}</text>
      </view>
      <!-- 连接线 -->
      <view class="scene-connectors">
        <view v-for="i in stepCount - 1" :key="i" class="scene-dot" :class="{ done: i <= current, current: i === current + 1 }" />
      </view>
    </view>

    <!-- AI 插图 -->
    <view v-if="guideImage" class="guide-illustration">
      <image class="guide-img" :src="guideImage" mode="aspectFill" />
      <view class="guide-img-badge">
        <view class="img-badge-dot" />
        <text>MEDICAL AI SIMULATION</text>
      </view>
    </view>

    <!-- 当前步骤（大卡片） -->
    <view class="guide-card" :key="current">
      <view class="card-step-tag" :class="{ warn: currentWarn }">
        <text>{{ $t('guide.stepTag', { n: current + 1 }) }}</text>
      </view>
      <text class="card-title">{{ currentTitle }}</text>
      <text class="card-detail">{{ currentDetail }}</text>
    </view>

    <!-- 操作 -->
    <view class="guide-nav">
      <view v-if="current > 0" class="nav-btn prev" @click="prevStep">{{ $t('guide.navPrev') }}</view>
      <view class="nav-spacer" />
      <view v-if="current < stepCount - 1" class="nav-btn next" @click="nextStep">{{ $t('guide.navNext') }}</view>
      <view v-else class="nav-btn done" @click="goBack">{{ $t('guide.navDone') }}</view>
    </view>

    <!-- 注意事项（折叠） -->
    <view class="guide-warn-toggle" @click="showWarn = !showWarn">
      <text>{{ $t('guide.warnToggle') }}</text>
      <text class="warn-arrow" :class="{ open: showWarn }">▾</text>
    </view>
    <view v-if="showWarn" class="guide-warning">
      <text v-for="(w, i) in warnings" :key="i" class="guide-warning-item">{{ w }}</text>
    </view>

    <!-- 底部 -->
    <view class="guide-footer">
      <view class="guide-call-btn" @click="call120">
        <text class="guide-call-icon">📞</text>
        <text>{{ $t('guide.call') }}</text>
      </view>
      <text class="guide-legal">{{ $t('guide.legal') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { voice, type VoiceLang } from '@/utils/voice'
import { i18n } from '@/i18n'

/**
 * 页面文案已**全部抽到 i18n**（`guide.*`）。本文件只保留**不翻译**的结构元数据
 * （图标 / 警示标记 / 图片路径）；任何中文字面量都会触发
 * `@/__tests__/i18n-scope` 的「裸 CJK 源码守卫」而报红。
 */
interface GuideStepText { title: string; detail: string }
/** 每一步的**非文本**元数据：图标 + 是否警示步。 */
interface StepMeta { icon: string; warn?: boolean }

/**
 * 6 类指引的**结构元数据**（不含可翻译文本）。
 *
 * ⚠️ 步骤**数量**以 i18n 的 `guide.guides.<type>.steps` 数组为准；这里的 `steps` 仅按
 * **位置**提供图标/警示标记。二者长度不一致时，多出的步骤渲染空图标（有守卫测试兜底）。
 */
const guideMeta: Record<string, { emoji: string; steps: StepMeta[] }> = {
  bleeding: {
    emoji: '🩸',
    steps: [{ icon: '✋' }, { icon: '⬆️' }, { icon: '🩹' }, { icon: '📚' }, { icon: '⏱️', warn: true }],
  },
  heimlich: {
    emoji: '🫁',
    steps: [{ icon: '👀' }, { icon: '🧍' }, { icon: '👊' }, { icon: '👄' }, { icon: '🔁' }, { icon: '❤️', warn: true }],
  },
  fracture: {
    emoji: '🦴',
    steps: [{ icon: '🛑' }, { icon: '📏' }, { icon: '🧻' }, { icon: '🔺' }, { icon: '🧊' }],
  },
  transport: {
    emoji: '🚑',
    steps: [{ icon: '👁️' }, { icon: '🤲' }, { icon: '👥' }, { icon: '🪵' }, { icon: '🔗' }],
  },
  psychological: {
    emoji: '🧠',
    steps: [{ icon: '🏠' }, { icon: '🤝' }, { icon: '👂' }, { icon: '📋' }, { icon: '🌿' }],
  },
  seizure: {
    emoji: '🧠',
    steps: [{ icon: '⏱️' }, { icon: '🧹' }, { icon: '✋' }, { icon: '🔄' }, { icon: '💚' }],
  },
}

const guideImages: Record<string, string> = {
  bleeding: '/static/bleeding.png',
  heimlich: '/static/heimlich.png',
  fracture: '/static/fracture.png',
  transport: '/static/transport.png',
  psychological: '/static/psychological.png',
  seizure: '/static/psychological.png',
}

const type = ref('bleeding')
const current = ref(0)
const showWarn = ref(false)
const sceneAnim = ref('pulse-in')

const pages = getCurrentPages()
const options = (pages[pages.length - 1] as any).$page?.options
if (options?.type) type.value = options.type

// --- i18n（设计 §4）---
/**
 * 全局组合式 i18n 实例。`i18n.global` 的类型是「legacy / composition」联合，
 * 这里收窄成组合式形态（`locale` 为 ref、含 `t` / `tm`），以便在 `computed` 里安全取值。
 */
const i18nGlobal = i18n.global as unknown as {
  locale: { value: string }
  t: (key: string, named?: Record<string, unknown>) => string
  tm: (key: string) => unknown
}
/**
 * 脚本内翻译。
 *
 * ⚠️ **只能在 `computed` / 函数体里调用**（不能在 `<script setup>` 顶层把结果赋给 `const`）：
 * `t` 内部读 `locale`，顶层取值会**冻结语言**，切到 en-US 后仍显示中文。
 */
function t(key: string, named?: Record<string, unknown>): string {
  return i18nGlobal.t(key, named)
}
/** 当前语音语言（随 i18n 语言切换响应式变化）；范围外页面不用它，走 voice 的默认 zh-CN。 */
const voiceLang = computed<VoiceLang>(() => (i18nGlobal.locale.value === 'en-US' ? 'en-US' : 'zh-CN'))

/** 当前指引标题。 */
const guideTitle = computed(() => t(`guide.guides.${type.value}.title`))
/**
 * 当前指引的步骤数组：把 locale 里的**索引键**（`s1`..`sN`）组装成有序数组再渲染
 * （照 P0-3 `ventSteps` 模式）。
 *
 * ⚠️ 数量取自组件侧图标元数据（与 locale 键一一对应）；若二者错位，渲染数量会与
 * locale 键数不一致，被 `guide-aed-i18n.test.ts` 的内容完整性守卫直接抓住。
 */
const steps = computed<GuideStepText[]>(() => {
  const icons = guideMeta[type.value]?.steps ?? []
  const prefix = `guide.guides.${type.value}.steps`
  return icons.map((_meta, i) => ({
    title: t(`${prefix}.s${i + 1}.title`),
    detail: t(`${prefix}.s${i + 1}.detail`),
  }))
})
/** 注意事项（字符串数组，`tm` 取当前语言）。 */
const warnings = computed<string[]>(() => {
  const v = i18nGlobal.tm(`guide.guides.${type.value}.warnings`)
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
})
const stepCount = computed(() => steps.value.length)
const currentIcon = computed(() => guideMeta[type.value]?.steps[current.value]?.icon ?? '')
const currentWarn = computed(() => !!guideMeta[type.value]?.steps[current.value]?.warn)
const currentTitle = computed(() => steps.value[current.value]?.title ?? '')
const currentDetail = computed(() => steps.value[current.value]?.detail ?? '')

const guideImage = computed(() => guideImages[type.value] || '')

// --- 定时器句柄（必须在 unmount 时清理，否则卸载后回调仍会触发）---
let voiceTimer: number | null = null
const animTimers: number[] = []

function scheduleAnim(cb: () => void, ms: number) {
  const id = setTimeout(cb, ms) as unknown as number
  animTimers.push(id)
}

function nextStep() {
  if (current.value < stepCount.value - 1) {
    sceneAnim.value = 'slide-out'
    scheduleAnim(() => {
      current.value++
      sceneAnim.value = 'slide-in'
      scheduleAnim(() => { sceneAnim.value = 'pulse-in' }, 300)
    }, 200)
  }
}

function prevStep() {
  if (current.value > 0) {
    sceneAnim.value = 'slide-out'
    scheduleAnim(() => {
      current.value--
      sceneAnim.value = 'slide-in'
      scheduleAnim(() => { sceneAnim.value = 'pulse-in' }, 300)
    }, 200)
  }
}

/**
 * 语音播报当前步骤。
 *
 * ⚠️ 文本用**整句 key + 具名插值**（`guide.voice.step`），**禁止** `title + '，' + detail` 拼装（§3.3）。
 * ⚠️ 文本/语言都在回调**触发时**才取：保证「运行中切语言」能立即改语言（防"'冻结语言'"）。
 * ⚠️ 句柄必须存下来并在 `onUnmounted` 清理：否则离开页面后仍会说话（P0-3 同类泄漏）。
 */
watch(current, (val) => {
  if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null }
  voiceTimer = setTimeout(() => {
    voiceTimer = null
    const s = steps.value[val]
    if (!s) return
    voice.command(t('guide.voice.step', { title: s.title, detail: s.detail }), voiceLang.value)
  }, 300) as unknown as number
})

function goBack() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/home/index' })
}
function call120() {
  uni.makePhoneCall({ phoneNumber: '120' }).catch(() => {
    uni.showToast({ title: t('guide.toastCalling'), icon: 'none' })
  })
}

/** 卸载清理：清掉所有延后回调，并停止播报（否则退出后仍会说话）。 */
onUnmounted(() => {
  if (voiceTimer) { clearTimeout(voiceTimer); voiceTimer = null }
  while (animTimers.length) {
    const id = animTimers.pop()
    if (id) clearTimeout(id)
  }
  voice.stop()
})
</script>

<style lang="scss" scoped>
.page-guide {
  background: linear-gradient(180deg, #2A0F0C 0%, #1A0907 100%);
  color: #fff; min-height: 100vh; padding-bottom: 80rpx;
  overflow: hidden;
}

/* 顶栏 */
.guide-appbar {
  display: flex; align-items: center; padding: 28rpx 40rpx; gap: 16rpx;
}
.guide-back { font-size: 48rpx; width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; }
.guide-title { flex: 1; font-family: var(--serif); font-weight: 700; font-size: 36rpx; }
.guide-step-indicator { font-family: var(--mono); font-size: 22rpx; opacity: 0.5; }

/* 场景区 */
.guide-scene {
  display: flex; flex-direction: column; align-items: center; padding: 40rpx 0 20rpx;
}
.scene-icon-wrap {
  width: 240rpx; height: 240rpx; border-radius: 50%;
  background: radial-gradient(circle, rgba(192,57,43,0.3) 0%, transparent 70%);
  display: flex; align-items: center; justify-content: center;
  position: relative;
  box-shadow: 0 0 80rpx rgba(192,57,43,0.25);

  &::before {
    content: ''; position: absolute; inset: -16rpx; border-radius: 50%;
    border: 2px solid rgba(192,57,43,0.2);
    animation: pulse-ring 2s ease-out infinite;
  }
  &::after {
    content: ''; position: absolute; inset: -32rpx; border-radius: 50%;
    border: 1px solid rgba(192,57,43,0.1);
    animation: pulse-ring 2s ease-out infinite 0.6s;
  }

  &.slide-in .scene-emoji { animation: slideInRight 0.25s ease-out; }
  &.slide-out .scene-emoji { animation: slideOutLeft 0.2s ease-in; }
  &.pulse-in .scene-emoji { animation: pulseIn 0.4s ease-out; }
}
.scene-emoji { font-size: 120rpx; }

/* 连接线进度 */
.scene-connectors {
  display: flex; gap: 20rpx; padding: 32rpx 0 0; justify-content: center;
}
.scene-dot {
  width: 16rpx; height: 16rpx; border-radius: 50%; background: rgba(255,255,255,0.15);
  transition: all 0.3s;
  &.done { background: var(--green); box-shadow: 0 0 12rpx rgba(52,210,119,0.5); }
  &.current { background: var(--rescue-red); animation: blink 0.8s infinite; }
}

/* AI 插图 */
.guide-illustration {
  margin: 0 40rpx 24rpx; position: relative;
  border-radius: 24rpx; overflow: hidden;
  box-shadow: 0 16rpx 40rpx rgba(0,0,0,0.3);
}
.guide-img {
  width: 100%; height: 360rpx; display: block;
  animation: float-img 4s ease-in-out infinite;
}
.guide-img-badge {
  position: absolute; bottom: 16rpx; right: 16rpx;
  display: flex; align-items: center; gap: 8rpx;
  font-family: var(--mono); font-size: 18rpx; letter-spacing: 1rpx;
  background: rgba(0,0,0,0.55); color: rgba(255,255,255,0.8);
  padding: 6rpx 16rpx; border-radius: 16rpx;
  backdrop-filter: blur(8rpx);
}
.img-badge-dot {
  width: 12rpx; height: 12rpx; border-radius: 50%;
  background: #34D277; animation: blink 1.2s infinite;
}

@keyframes float-img {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* 步骤卡片 */
.guide-card {
  margin: 0 40rpx 24rpx;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 32rpx; padding: 40rpx 36rpx;
  animation: slideInRight 0.3s ease-out;
  position: relative; overflow: hidden;
}
.card-step-tag {
  display: inline-flex; padding: 8rpx 24rpx; border-radius: 20rpx;
  background: rgba(52,210,119,0.15); border: 1px solid rgba(52,210,119,0.3);
  font-family: var(--mono); font-size: 20rpx; letter-spacing: 2rpx; color: var(--green);
  margin-bottom: 24rpx;
  &.warn { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.3); color: #F59E0B; }
}
.card-title {
  font-family: var(--serif); font-size: 40rpx; font-weight: 900;
  display: block; margin-bottom: 16rpx; line-height: 1.3;
}
.card-detail {
  font-size: 28rpx; opacity: 0.78; line-height: 1.7; display: block;
}

/* 导航 */
.guide-nav { display: flex; gap: 24rpx; padding: 0 40rpx 32rpx; }
.nav-btn {
  padding: 28rpx 40rpx; border-radius: 28rpx; font-size: 28rpx;
  font-family: var(--serif); font-weight: 700; text-align: center;
  &.prev { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.8); }
  &.next { flex: 1; background: var(--rescue-red); color: #fff; box-shadow: 0 12rpx 36rpx rgba(192,57,43,0.3); }
  &.done { flex: 1; background: var(--green); color: #fff; box-shadow: 0 12rpx 36rpx rgba(52,210,119,0.3); }
}
.nav-spacer { flex: 1; }

/* 注意事项折叠 */
.guide-warn-toggle {
  margin: 0 40rpx 0; padding: 20rpx 0;
  display: flex; align-items: center; gap: 8rpx;
  font-size: 24rpx; opacity: 0.5;
}
.warn-arrow { transition: transform 0.3s; &.open { transform: rotate(180deg); } }
.guide-warning {
  margin: 0 40rpx 32rpx; padding: 24rpx 28rpx;
  background: rgba(245,158,11,0.04); border: 1px solid rgba(245,158,11,0.15);
  border-radius: 24rpx; border-left: 4rpx solid #F59E0B;
  animation: slideUp 0.3s ease-out;
}
.guide-warning-item {
  font-size: 24rpx; opacity: 0.75; line-height: 1.8; display: block;
  &::before { content: '• '; color: #F59E0B; }
}

/* 底部 */
.guide-footer { padding: 0 40rpx; text-align: center; }
.guide-call-btn {
  display: inline-flex; align-items: center; gap: 14rpx;
  background: var(--rescue-red); color: #fff; padding: 28rpx 56rpx; border-radius: 40rpx;
  font-family: var(--serif); font-size: 30rpx; font-weight: 700;
  box-shadow: 0 12rpx 36rpx rgba(192,57,43,0.4); margin-bottom: 24rpx;
}
.guide-call-icon { font-size: 36rpx; }
.guide-legal { font-size: 22rpx; opacity: 0.4; font-family: var(--mono); }

/* 动画 */
@keyframes slideInRight { from { opacity: 0; transform: translateX(40rpx); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideOutLeft { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-40rpx); } }
@keyframes pulseIn { 0% { transform: scale(0.6); opacity: 0.3; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20rpx); } to { opacity: 1; transform: translateY(0); } }
</style>
