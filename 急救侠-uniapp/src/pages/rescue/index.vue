<template>
  <view class="page-rescue">
    <!-- === 阶段1：决策 === -->
    <view v-if="stage === 'decision'" class="rescue-decision">
      <!-- 演习模式横幅 -->
      <view v-if="isDrill" class="training-banner">
        <text class="training-banner-icon">⚠️</text>
        <view class="training-banner-body">
          <text class="training-banner-title">{{ $t('rescue.banner.title') }}</text>
          <text class="training-banner-sub">{{ $t('rescue.banner.sub') }}</text>
        </view>
      </view>

      <!-- 顶栏 -->
      <view class="rescue-appbar">
        <text class="rescue-back" @click="goBack">‹</text>
        <text class="rescue-title">{{ $t('rescue.title') }}</text>
        <view class="rescue-call-120" @click="call120">
          <text class="rescue-120-dot">📞</text>
          <text>120</text>
        </view>
      </view>

      <!-- 紧迫感 -->
      <view class="decision-tag-row">
        <view class="decision-tag" :class="{ drill: isDrill }">
          <view class="decision-tag-dot" :class="{ drill: isDrill }" />
          <text>{{ isDrill ? $t('rescue.decision.tag.drill') : $t('rescue.decision.tag.real') }}</text>
        </view>
      </view>

      <view class="decision-headline">
        <text class="decision-main">{{ $t('rescue.decision.main') }}</text>
        <text class="decision-sub">{{ $t('rescue.decision.sub') }}</text>
      </view>

      <!-- CPR 按钮 -->
      <view class="sos-btn-wrap">
        <SosButton
          variant="dark"
          :title="isDrill ? $t('rescue.decision.start.drill') : $t('rescue.decision.start.real')"
          :subtitle="isDrill ? $t('rescue.decision.startSub.drill') : $t('rescue.decision.startSub.real')"
          :show-arrow="false"
          @click="showConfirm"
        />
      </view>

      <!-- 系统自动操作说明 -->
      <view class="decision-auto-box">
        <text class="decision-auto-label">{{ isDrill ? $t('rescue.decision.autoLabel.drill') : $t('rescue.decision.autoLabel.real') }}</text>
        <view class="decision-auto-row">
          <view v-for="item in autoActions" :key="item.label" class="decision-auto-item">
            <view class="decision-auto-icon">{{ item.icon }}</view>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 其他紧急情况 -->
      <view class="decision-other-label">{{ $t('rescue.decision.other') }}</view>
      <view class="decision-other-grid">
        <view v-for="g in emergencyGuides" :key="g.type" class="decision-other-btn" :class="{ 'decision-other-wide': g.wide }" @click="showGuide(g.type)">
          <text class="decision-other-emoji">{{ g.emoji }}</text>
          <view><text class="decision-other-name">{{ g.title }}</text><text class="decision-other-desc">{{ g.desc }}</text></view>
        </view>
      </view>

      <view class="decision-legal">
        <text>{{ $t('rescue.decision.legalSave') }}</text><text>·</text><text>{{ $t('rescue.decision.legalLaw') }}</text>
      </view>
    </view>

    <!-- === 阶段2：CPR 流程 === -->
    <view v-if="stage === 'cpr'" class="rescue-cpr">
      <view v-if="isDrill" class="training-banner cpr-banner">
        <text class="training-banner-icon">⚠️</text>
        <text class="training-banner-compact-text">{{ $t('rescue.banner.compact') }}</text>
      </view>

      <view class="rescue-appbar">
        <text class="rescue-back" @click="backToDecision">‹</text>
        <text class="rescue-title">{{ stepTitle }}</text>
        <text class="rescue-back rescue-settings">⚙</text>
      </view>

      <view class="step-progress">
        <view v-for="s in 5" :key="s" class="step-pill" :class="stepPillClass(s)">{{ s }}<text class="step-pill-label">{{ stepLabels[s-1] }}</text></view>
      </view>

      <!-- 步骤1 -->
      <view v-if="cprStep === 1" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#F59E0B,#D97706);"><text class="step-icon-emoji">📣</text></view>
        <text class="step-action-label">{{ isDrill ? $t('rescue.step1.action.drill') : $t('rescue.step1.action.real') }}</text>
        <text class="step-quote">{{ $t('rescue.step1.quote') }}</text>
        <view class="step-tasks">
          <view class="step-task done">
            <view class="step-task-check">✓</view>
            <view class="step-task-text">
              <strong>{{ isDrill ? $t('rescue.step1.taskCall.drill') : $t('rescue.step1.taskCall.real') }}</strong>
              <view v-if="isDrill" class="step-task-sub">{{ $t('rescue.step1.taskCallSubDrill') }}</view>
              <view v-else class="step-task-sub">{{ $t('rescue.step1.taskCallSubReal') }}</view>
            </view>
          </view>
          <view class="step-task done">
            <view class="step-task-check">✓</view>
            <view class="step-task-text">
              <strong>{{ isDrill ? $t('rescue.step1.taskVolunteers.drill') : $t('rescue.step1.taskVolunteers.real') }}</strong>
              <view class="step-task-sub">{{ $t('rescue.step1.taskVolunteersSub') }}</view>
            </view>
          </view>
          <view class="step-task active">
            <view class="step-task-check" style="background:#F59E0B;">⚡</view>
            <view class="step-task-text">
              <strong>{{ isDrill ? $t('rescue.step1.taskTeam.drill') : $t('rescue.step1.taskTeam.real') }}</strong>
              <view class="step-task-sub">{{ $t('rescue.step1.taskTeamSub') }}</view>
            </view>
          </view>
          <view class="step-task" @click="goHelper"><view class="step-task-check todo">→</view><view class="step-task-text">{{ $t('rescue.step1.taskHelper') }}</view></view>
        </view>
        <view class="step-detail" v-html="isDrill ? $t('rescue.step1.detail.drill') : $t('rescue.step1.detail.real')" />
        <StepTimer :seconds="7" @done="cprStep = 2" />
        <view class="step-buttons"><view class="step-btn-primary" @click="cprStep = 2">{{ $t('rescue.step1.start') }}</view></view>
      </view>

      <!-- 步骤2/3/4/5/循环/AED 保持不变（无演习相关文字） -->
      <view v-if="cprStep === 2" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#FF6B5B,#C0392B);"><text class="step-icon-emoji">👋</text></view>
        <text class="step-action-label">{{ $t('rescue.step2.action') }}</text>
        <text class="step-quote">{{ $t('rescue.step2.quote') }}</text>
        <view class="step-detail">{{ $t('rescue.step2.detail') }}</view>
        <StepTimer :seconds="5" @done="cprStep = 3" />
        <view class="step-buttons"><view class="step-btn-secondary" @click="abort($t('rescue.toast.reason.responded'))">{{ $t('rescue.step2.pause') }}</view></view>
      </view>

      <view v-if="cprStep === 3" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#4A90E2,#2563EB);"><text class="step-icon-emoji">🫁</text></view>
        <text class="step-action-label">{{ $t('rescue.step3.action') }}</text>
        <text class="step-quote">{{ breathCounter }}</text>
        <view class="step-detail">{{ $t('rescue.step3.detail') }}</view>
        <StepTimer :seconds="7" @done="cprStep = 4" />
        <view class="step-buttons"><view class="step-btn-secondary" @click="abort($t('rescue.toast.reason.breathing'))">{{ $t('rescue.step3.pause') }}</view></view>
      </view>

      <view v-if="cprStep === 4" class="cpr-step-card">
        <view class="cpr-bar">
          <view class="cpr-bar-item"><text class="cpr-bar-label">{{ $t('rescue.cpr.totalLabel') }}</text><text class="cpr-bar-value">{{ elapsed }}</text></view>
          <view class="cpr-bar-item"><text class="cpr-bar-label">{{ $t('rescue.cpr.roundLabel') }}</text><text class="cpr-bar-value">{{ pressCount }}/30</text></view>
          <view class="cpr-bar-item"><text class="cpr-bar-label">{{ $t('rescue.cpr.roundsLabel') }}</text><text class="cpr-bar-value">{{ rounds }}</text></view>
        </view>
        <Metronome :display="pressNumDisplay" :label="pressLabel" @reset="resetCount" />
        <view class="cpr-instruction">
          <text class="cpr-instruction-num">{{ $t('rescue.cpr.keyNum') }}</text>
          <text class="cpr-instruction-text">{{ $t('rescue.cpr.keyText') }}</text>
          <text class="cpr-instruction-detail" v-html="$t('rescue.cpr.keyDetail')" />
        </view>
        <view class="cpr-actions">
          <view class="cpr-action" @click="goHelper"><text class="cpr-action-icon">+</text><text>{{ $t('rescue.cpr.callHelper') }}</text></view>
          <view class="cpr-action aed-action" @click="goAedFlow"><text class="cpr-action-icon">⚡</text><text>{{ $t('rescue.cpr.aedReady') }}</text></view>
          <view class="cpr-action danger" @click="call120"><text class="cpr-action-icon">📞</text><text>120</text></view>
        </view>
        <view class="cpr-action-media" @click="goMediaAlert">
          <text class="cpr-action-media-icon">📸</text>
          <text>{{ $t('rescue.cpr.media') }}</text>
        </view>
      </view>

      <view v-if="cprStep === 'aed'" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#F59E0B,#D97706);"><text class="step-icon-emoji">⚡</text></view>
        <text class="step-action-label">{{ aedPhaseLabel }}</text>
        <text class="step-quote">{{ aedPhaseQuote }}</text>
        <view class="step-detail" v-html="aedPhaseDetail" />
        <StepTimer :seconds="aedPhaseSeconds" :key="aedPhase" @done="advanceAedPhase" />
        <view class="step-buttons"><view class="step-btn-secondary" @click="cancelAed">{{ $t('rescue.aed.cancel') }}</view></view>
      </view>

      <view v-if="cprStep === 5" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#10B981,#059669);"><text class="step-icon-emoji">💨</text></view>
        <text class="step-action-label">{{ $t('rescue.vent.actionLabel', { round: ventRound }) }}</text>
        <text class="step-quote">{{ ventRound === 1 ? $t('rescue.vent.round1') : $t('rescue.vent.round2') }}</text>
        <image class="vent-img" src="/static/ventilation.png" mode="aspectFill" />
        <view class="vent-checklist">
          <view v-for="(v,i) in ventSteps" :key="i" class="vent-item" :class="{ done: i<3, active: i===3 }">
            <text class="vent-num">{{ i+1 }}</text><text class="vent-text">{{ v.title }} <text class="vent-sub">{{ v.sub }}</text></text>
          </view>
        </view>
        <StepTimer :seconds="3.5" :key="ventRound" @done="advanceVent" />
      </view>

      <view v-if="cprStep === 'loop'" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#C0392B,#8B2A1F);"><text class="step-icon-emoji">🔁</text></view>
        <text class="step-action-label">{{ $t('rescue.loop.actionLabel', { rounds }) }}</text>
        <text class="step-quote">{{ $t('rescue.loop.quote') }}</text>
        <view class="step-detail" v-html="$t('rescue.loop.detail')" />
        <StepTimer :seconds="3" @done="nextRound" />
        <view class="step-buttons"><view class="step-btn-primary" @click="nextRound">{{ $t('rescue.loop.start') }}</view></view>
      </view>
    </view>

    <!-- 确认弹层 -->
    <BottomSheet :visible="confirmVisible" dark :title="isDrill ? $t('rescue.confirm.title.drill') : $t('rescue.confirm.title.real')" @close="confirmVisible = false">
      <view class="confirm-body">
        <view v-if="isDrill" class="confirm-drill-box">
          <text class="confirm-drill-icon">⚠️</text>
          <view>
            <text class="confirm-drill-title">{{ $t('rescue.confirm.drillTitle') }}</text>
            <text class="confirm-drill-desc">{{ $t('rescue.confirm.drillDesc') }}</text>
          </view>
        </view>
        <view class="confirm-body-text">
          {{ isDrill ? $t('rescue.confirm.body.drill') : $t('rescue.confirm.body.real') }}
        </view>
        <view class="confirm-check" @click="confirmed = !confirmed">
          <view class="confirm-checkbox" :class="{ checked: confirmed }">{{ confirmed ? '✓' : '' }}</view>
          <text class="confirm-check-label">{{ isDrill ? $t('rescue.confirm.check.drill') : $t('rescue.confirm.check.real') }}{{ $t('rescue.confirm.lawSuffix') }}</text>
        </view>
        <view class="confirm-btn" :class="confirmed ? 'ready' : 'disabled'" @click="startCpr">{{ isDrill ? $t('rescue.confirm.start.drill') : $t('rescue.confirm.start.real') }}</view>
      </view>
    </BottomSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import SosButton from '@/components/SosButton/index.vue'
import StepTimer from '@/components/StepTimer/index.vue'
import Metronome from '@/components/Metronome/index.vue'
import BottomSheet from '@/components/BottomSheet/index.vue'
import { voice, type VoiceLang } from '@/utils/voice'
import { i18n } from '@/i18n'
import { playClick } from '@/utils/audio'
import { reportSosEvent, newSosEventId } from '@/api/sos'

// --- 模式检测 ---
const pages = getCurrentPages()
const page = pages[pages.length - 1] as any
const isDrill = computed(() => page?.options?.mode === 'drill')

// --- 状态 ---
const stage = ref<'decision' | 'cpr'>('decision')
const cprStep = ref<number | 'aed' | 'loop'>(0)
const confirmVisible = ref(false)
const confirmed = ref(false)

const pressCount = ref(0)
const rounds = ref(0)
const elapsed = ref('00:00')
/**
 * 节拍器主数字 —— **状态与文本分离**（设计要求的"防语言冻结"关键）。
 *
 * 原实现是 `ref('准备')`，切语言时不会变（ref 只取一次值）。
 * 这里把"是否已开始"存成 `pressNumStarted`，未开始时才用 i18n 渲染"准备/Ready"；
 * 开始后显示 `0`..`30` 的**纯数字**（数字不翻译，无需 i18n）。
 */
const pressNumStarted = ref(false)
const pressNumValue = ref('0')
const pressNumDisplay = computed<string>(() =>
  pressNumStarted.value ? pressNumValue.value : t('rescue.cpr.pressNumIdle'),
)
/**
 * 节拍器副标签 —— 同样状态/文本分离（`idle` / `hint` / `reset` 三档）。
 * 由 `pressLabelState` 承载状态，`pressLabel` 用 computed 翻成当前语言文本。
 */
const pressLabelState = ref<'idle' | 'hint' | 'reset'>('idle')
const pressLabel = computed<string>(() => t(`rescue.cpr.pressLabel.${pressLabelState.value}`))
const totalSeconds = ref(0)
let totalTimer: number | null = null
let pressTimer: number | null = null
/**
 * `watch([cprStep, aedPhase])` 里"延后 50ms 播报本步语音"的句柄。
 *
 * ⚠️ **必须存句柄并在 `stopAll()` 里清理**：否则卸载（或 `backToDecision()`）之后该回调仍会触发。
 * 它的内容由硬编码中文改成了 `t(...)`（i18n）后，卸载后触发会去碰 i18n 运行时
 * （测试环境已拆除 ⇒ `ReferenceError: window is not defined`；生产则是"已经退出去还在说话"）。
 */
let voiceScheduleTimer: number | null = null
/** `resetCount()` 里"1.5s 后恢复为可按压"的句柄（同类泄漏：不清会重新起按压定时器）。 */
let resetHintTimer: number | null = null

const breathCounter = ref('1001')
const ventRound = ref(1)
const aedPhase = ref(0)
let breathTimer: number | null = null

// --- 语音本地化（设计 §4）---
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
/** 当前语音语言（随 i18n 语言切换响应式变化）。范围外页面不走这里 —— 它们用 voice 的默认 zh-CN。 */
const voiceLang = computed<VoiceLang>(() => (i18nGlobal.locale.value === 'en-US' ? 'en-US' : 'zh-CN'))
/**
 * CPR 计数词，按当前语言从 i18n 取（`voice.cprNumbers`：zh `['零'…'十']`，en `['zero'…'ten']`）。
 * ⚠️ 必须包在 `computed` 里：顶层取值会**冻结语言**，切到 en-US 后仍念中文。
 */
const cprNumbers = computed<string[]>(() => {
  const v = i18nGlobal.tm('voice.cprNumbers')
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
})
/** 人工呼吸计数起手念法（zh `一零零一` / en `one zero zero one`）。 */
const breathStart = computed<string>(() => String(i18nGlobal.t('voice.breathStart')))

// --- 常量（全部走 i18n：必须是 computed，否则切语言时文字会"冻结"）---
/** 顶部 5 个步骤胶囊标签。 */
const stepLabels = computed<string[]>(() => {
  const v = i18nGlobal.tm('rescue.steps.labels')
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
})
const autoActions = computed(() => isDrill.value
  ? [{ icon: '📞', label: t('rescue.auto.call120Drill') }, { icon: '👥', label: t('rescue.auto.volunteersDrill') }, { icon: '⚡', label: t('rescue.auto.aedDrill') }]
  : [{ icon: '📞', label: t('rescue.auto.call120') }, { icon: '👥', label: t('rescue.auto.volunteers') }, { icon: '⚡', label: t('rescue.auto.aed') }]
)
const emergencyGuides = computed(() => [
  { type: 'heimlich', emoji: '🫁', title: t('rescue.guides.heimlich.title'), desc: t('rescue.guides.heimlich.desc'), wide: false },
  { type: 'bleeding', emoji: '🩸', title: t('rescue.guides.bleeding.title'), desc: t('rescue.guides.bleeding.desc'), wide: false },
  { type: 'fracture', emoji: '🦴', title: t('rescue.guides.fracture.title'), desc: t('rescue.guides.fracture.desc'), wide: false },
  { type: 'transport', emoji: '🚑', title: t('rescue.guides.transport.title'), desc: t('rescue.guides.transport.desc'), wide: false },
  { type: 'psychological', emoji: '🧠', title: t('rescue.guides.psychological.title'), desc: t('rescue.guides.psychological.desc'), wide: true },
])
const ventSteps = computed(() => [
  { title: t('rescue.vent.s1.title'), sub: t('rescue.vent.s1.sub') },
  { title: t('rescue.vent.s2.title'), sub: t('rescue.vent.s2.sub') },
  { title: t('rescue.vent.s3.title'), sub: t('rescue.vent.s3.sub') },
  { title: t('rescue.vent.s4.title'), sub: t('rescue.vent.s4.sub') },
])

// --- 计算 ---
const stepTitle = computed(() => {
  const m: Record<string, string> = {
    '1': t('rescue.stepTitle.s1'),
    '2': t('rescue.stepTitle.s2'),
    '3': t('rescue.stepTitle.s3'),
    '4': t('rescue.stepTitle.s4'),
    '5': t('rescue.stepTitle.s5'),
    aed: t('rescue.stepTitle.aed'),
    loop: t('rescue.stepTitle.loop'),
  }
  return m[String(cprStep.value)] || t('rescue.stepTitle.ongoing')
})
const aedPhaseLabel = computed(() => ({ 0: t('rescue.aed.label0'), 1: t('rescue.aed.label1'), 2: t('rescue.aed.label2') }[aedPhase.value] || ''))
const aedPhaseQuote = computed(() => aedPhase.value === 0 ? t('rescue.aed.quote0') : aedPhase.value === 1 ? t('rescue.aed.quote1') : t('rescue.aed.quote2'))
const aedPhaseDetail = computed(() => aedPhase.value === 2 ? t('rescue.aed.detail2') : '')
const aedPhaseSeconds = computed(() => aedPhase.value === 0 ? 10 : aedPhase.value === 1 ? 5 : 2.5)

function stepPillClass(s: number) { const n = typeof cprStep.value === 'number' ? cprStep.value : 5; return { active: s === n, done: s < n && n > 0 } }

function showConfirm() { confirmVisible.value = true; confirmed.value = false }

/**
 * 启动 CPR 指引。
 *
 * 流程推进**必须发生在埋点之前**：上报是旁路（D4），即使它同步抛错，本地急救流程也已就绪。
 * 上报点刻意放在这里而不是 `watch(cprStep)` 里 —— 那个 watch 会在 `loop → 4 → 5 → loop`
 * 中反复重入，挂在那里会产生**多条记录**，直接污染反滥用计数。
 */
function startCpr() {
  if (!confirmed.value) return
  confirmVisible.value = false
  stage.value = 'cpr'
  cprStep.value = 1
  startTotalTimer()
  // 旁路埋点：不 await、失败静默、绝不回滚上面的流程状态。见 @/api/sos。
  void reportSosEvent({ clientEventId: newSosEventId(), isDrill: isDrill.value })
}
function backToDecision() { stopVoice(); stage.value = 'decision'; stopAll() }
function goBack() { const p = getCurrentPages(); if (p.length > 1) uni.navigateBack(); else uni.switchTab({ url: '/pages/home/index' }) }
/** 中断急救。`reason` 是**已翻译**的原因文本（调用方在模板里用 `$t(...)` 传入）。 */
function abort(reason: string) {
  stopAll()
  const state = isDrill.value ? t('rescue.toast.drillPaused') : t('rescue.toast.paused')
  uni.showToast({ title: t('rescue.toast.abortedWithReason', { state, reason }), icon: 'none' })
  stage.value = 'decision'
}

function call120() {
  if (isDrill.value) {
    uni.showToast({ title: t('rescue.toast.drillCall'), icon: 'none' })
  } else {
    uni.makePhoneCall({ phoneNumber: '120' }).catch(() => { uni.showToast({ title: t('rescue.toast.calling'), icon: 'none' }) })
  }
}

function showGuide(type: string) { uni.navigateTo({ url: `/pages/guide/index?type=${type}` }) }
function goHelper() { uni.navigateTo({ url: '/pages/share/index' }) }
function goMediaAlert() { uni.navigateTo({ url: '/pages/media-alert/index' }) }

// --- CPR ---
function startTotalTimer() {
  if (totalTimer) return
  totalTimer = setInterval(() => { totalSeconds.value++; const m = Math.floor(totalSeconds.value / 60).toString().padStart(2, '0'); const s = (totalSeconds.value % 60).toString().padStart(2, '0'); elapsed.value = `${m}:${s}` }, 1000) as unknown as number
}
function resetCount() {
  stopPress(); pressCount.value = 0; pressNumStarted.value = true; pressNumValue.value = '0'; pressLabelState.value = 'reset'
  resetHintTimer = setTimeout(() => { resetHintTimer = null; pressLabelState.value = 'hint'; startPress() }, 1500) as unknown as number
}
function wordForCpr(n: number): string { if (n <= 10) return cprNumbers.value[n] ?? String(n); return String(n) }
function startPress() {
  stopPress(); pressCount.value = 0; pressNumStarted.value = true; pressNumValue.value = '0'
  const tick = () => {
    pressCount.value++; pressNumValue.value = pressCount.value < 10 ? '0' + pressCount.value : String(pressCount.value)
    voice.speak(wordForCpr(pressCount.value), { rate: 1.7, volume: 1.0, priority: 'URGENT', lang: voiceLang.value }); uni.vibrateShort({ type: "light" }); playClick()
    if (pressCount.value >= 30) { stopPress(); cprStep.value = 5; ventRound.value = 1 }
  }
  tick(); pressTimer = setInterval(tick, 545) as unknown as number
}
function stopPress() { if (pressTimer) { clearInterval(pressTimer); pressTimer = null } }
function goAedFlow() { stopPress(); uni.switchTab({ url: '/pages/aed/index' }) }
function advanceAedPhase() { if (aedPhase.value === 0) aedPhase.value = 1; else if (aedPhase.value === 1) aedPhase.value = 2; else { cprStep.value = 4; pressCount.value = 0; pressNumStarted.value = true; pressNumValue.value = '0' } }
function cancelAed() { cprStep.value = 4 }
function advanceVent() { if (ventRound.value === 1) ventRound.value = 2; else { rounds.value++; cprStep.value = 'loop' } }
function nextRound() { cprStep.value = 4 }

function stopVoice() { voice.stop() }

watch([cprStep, aedPhase], ([step, phase]) => {
  voice.stop()
  // ⚠️ 句柄存起来交给 `stopAll()` 清理：否则卸载后仍会触发（见 `voiceScheduleTimer` 注释）。
  voiceScheduleTimer = setTimeout(() => {
    voiceScheduleTimer = null
    if (step === 1) speakCommand(isDrill.value ? t('rescue.voice.step1Drill') : t('rescue.voice.step1'))
    else if (step === 2) speakGuide(t('rescue.voice.step2'))
    else if (step === 3) startBreathCount()
    else stopBreathCount()
    if (step === 4) { pressLabelState.value = 'hint'; startPress() }
    if (step === 'aed') { if (phase === 0) speakUrgent(t('rescue.voice.aed0')); else if (phase === 1) speakUrgent(t('rescue.voice.aed1')) }
    else if (step === 5) speakGuide(t('rescue.voice.step5'))
    else if (step === 'loop') speakCommand(t('rescue.voice.loop'))
  }, 50) as unknown as number
})

function speakGuide(t2: string) { voice.guide(t2, voiceLang.value) }
function speakCommand(t2: string) { voice.command(t2, voiceLang.value) }
function speakUrgent(t2: string) { voice.speak(t2, { rate: 1.2, pitch: 1.05, priority: 'URGENT', lang: voiceLang.value }) }

function stopAll() {
  stopPress(); stopBreathCount(); stopVoice()
  // 清掉两个"延后回调"：否则卸载后仍会触发（见 voiceScheduleTimer 注释）。
  if (voiceScheduleTimer) { clearTimeout(voiceScheduleTimer); voiceScheduleTimer = null }
  if (resetHintTimer) { clearTimeout(resetHintTimer); resetHintTimer = null }
  if (totalTimer) { clearInterval(totalTimer); totalTimer = null }
}
function startBreathCount() { stopBreathCount(); breathCounter.value = '1001'; voice.count(breathStart.value, voiceLang.value); let count = 1; breathTimer = setInterval(() => { count++; breathCounter.value = String(1000 + count); voice.count(String(1000 + count), voiceLang.value); if (count >= 7) stopBreathCount() }, 1000) as unknown as number }
function stopBreathCount() { if (breathTimer) { clearInterval(breathTimer); breathTimer = null } }

onUnmounted(() => stopAll())
</script>

<style lang="scss" scoped>
.page-rescue { background: linear-gradient(180deg, #2A0F0C 0%, #1A0907 100%); color: #fff; min-height: 100vh; padding-bottom: 60rpx; }

.training-banner { display: flex; align-items: center; gap: 16rpx; margin: 0; padding: 20rpx 40rpx; background: rgba(245,158,11,0.12); border-bottom: 1px solid rgba(245,158,11,0.2); }
.training-banner-icon { font-size: 32rpx; flex-shrink: 0; }
.training-banner-body { flex: 1; }
.training-banner-title { display: block; font-family: var(--serif); font-size: 24rpx; font-weight: 700; color: #F59E0B; }
.training-banner-sub { display: block; font-size: 20rpx; color: rgba(255,255,255,0.6); margin-top: 2rpx; }
.training-banner-compact-text { font-size: 22rpx; color: #F59E0B; font-weight: 600; }
.cpr-banner { padding: 14rpx 40rpx; background: rgba(245,158,11,0.1); }

.rescue-appbar { display: flex; align-items: center; padding: 28rpx 40rpx; gap: 24rpx; text{color:#fff;} }
.rescue-back { font-size: 48rpx; width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; }
.rescue-title { flex: 1; font-family: var(--serif); font-weight: 700; font-size: 36rpx; }
.rescue-call-120 { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); padding: 16rpx 28rpx; border-radius: 40rpx; font-size: 24rpx; font-family: var(--mono); font-weight: 600; display: flex; align-items: center; gap: 12rpx; }
.rescue-120-dot { color: #FF6B5B; }
.rescue-settings { font-size: 36rpx; }

.decision-tag-row { text-align: center; padding: 40rpx 40rpx 0; }
.decision-tag { display: inline-flex; align-items: center; gap: 12rpx; background: rgba(192,57,43,0.2); border: 1px solid rgba(192,57,43,0.4); padding: 10rpx 24rpx; border-radius: 40rpx; font-family: var(--mono); font-size: 20rpx; letter-spacing: 3rpx; color: #FF8B5B;
  &.drill { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); color: #F59E0B; }
}
.decision-tag-dot { width: 14rpx; height: 14rpx; background: #FF6B5B; border-radius: 50%; animation: blink 1s infinite;
  &.drill { background: #F59E0B; }
}
.decision-headline { text-align: center; padding: 0 40rpx 56rpx; }
.decision-main { font-family: var(--serif); font-size: 64rpx; font-weight: 900; line-height: 1.2; display: block; margin-bottom: 20rpx; }
.decision-sub { font-size: 28rpx; opacity: 0.7; }
.sos-btn-wrap { padding: 0 40rpx 32rpx; }

.decision-auto-box { margin: 0 40rpx 40rpx; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 28rpx; padding: 28rpx 36rpx; }
.decision-auto-label { font-family: var(--mono); font-size: 20rpx; letter-spacing: 3rpx; color: rgba(255,255,255,0.5); margin-bottom: 20rpx; display: block; }
.decision-auto-row { display: flex; gap: 20rpx; }
.decision-auto-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; font-size: 24rpx; color: rgba(255,255,255,0.85); }
.decision-auto-icon { width: 64rpx; height: 64rpx; background: rgba(245,158,11,0.2); border-radius: 20rpx; display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 28rpx; }

.decision-other-label { font-family: var(--mono); font-size: 20rpx; letter-spacing: 2rpx; color: rgba(255,255,255,0.5); margin-bottom: 24rpx; text-align: center; }
.decision-other-grid { padding: 0 40rpx; display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.decision-other-btn { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 24rpx; padding: 24rpx; display: flex; align-items: center; gap: 20rpx; text-align: left; &.decision-other-wide{grid-column:span 2;} }
.decision-other-emoji { font-size: 40rpx; flex-shrink: 0; }
.decision-other-name { font-family: var(--serif); font-weight: 700; font-size: 26rpx; line-height: 1.2; display: block; }
.decision-other-desc { font-size: 20rpx; color: rgba(255,255,255,0.5); margin-top: 4rpx; display: block; }
.decision-legal { display: flex; align-items: center; gap: 20rpx; justify-content: center; font-size: 22rpx; color: rgba(255,255,255,0.4); font-family: var(--mono); padding: 0 40rpx 48rpx; }

.step-progress { display: flex; align-items: center; padding: 16rpx 40rpx 24rpx; }
.step-pill { width: 72rpx; height: 72rpx; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-weight: 700; font-size: 28rpx; color: rgba(255,255,255,0.5); position: relative; flex-shrink: 0; z-index: 1;
  &.active{background:var(--rescue-red);border-color:var(--rescue-red);color:#fff;box-shadow:0 0 32rpx rgba(192,57,43,0.5);}
  &.done{background:rgba(52,210,119,0.2);border-color:var(--green);color:var(--green);}
}
.step-pill+.step-pill{margin-left:8rpx;}
.step-pill-label{position:absolute;bottom:-32rpx;font-size:18rpx;font-weight:500;white-space:nowrap;color:rgba(255,255,255,0.5);}
.step-pill.active .step-pill-label{color:#fff;}

.cpr-step-card{padding:48rpx 40rpx 40rpx;text-align:center;}
.step-icon-wrap{width:200rpx;height:200rpx;border-radius:64rpx;display:flex;align-items:center;justify-content:center;margin:0 auto 40rpx;box-shadow:0 24rpx 64rpx rgba(0,0,0,0.3);}
.step-icon-emoji{font-size:96rpx;}
.step-action-label{font-family:var(--mono);font-size:24rpx;letter-spacing:4rpx;color:rgba(255,255,255,0.7);margin-bottom:24rpx;display:block;}
.step-quote{font-family:var(--serif);font-size:44rpx;font-weight:900;color:#fff;margin-bottom:32rpx;display:block;line-height:1.3;}
.step-detail{font-size:28rpx;line-height:1.6;color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:28rpx;padding:28rpx 36rpx;margin-bottom:40rpx;text-align:left;}
.step-tasks{display:flex;flex-direction:column;gap:20rpx;margin-bottom:32rpx;text-align:left;}
.step-task{display:flex;gap:24rpx;align-items:flex-start;padding:28rpx 32rpx;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:24rpx;
  &.done{background:rgba(52,210,119,0.1);border-color:rgba(52,210,119,0.3);}
  &.active{background:rgba(245,158,11,0.15);border-color:rgba(245,158,11,0.4);}
}
.step-task-check{width:56rpx;height:56rpx;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28rpx;font-weight:700;flex-shrink:0;
  &.todo{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);}
}
.step-task-text{font-size:28rpx;font-weight:500;}
.step-task-sub{font-size:22rpx;color:rgba(255,255,255,0.45);margin-top:4rpx;}
.step-buttons{display:flex;gap:24rpx;}
.step-btn-primary{flex:1;padding:32rpx;border-radius:28rpx;background:var(--rescue-red);color:#fff;font-family:var(--serif);font-size:30rpx;font-weight:700;box-shadow:0 12rpx 36rpx rgba(192,57,43,0.4);}
.step-btn-secondary{flex:1;padding:32rpx;border-radius:28rpx;background:rgba(255,255,255,0.06);color:#fff;border:2px solid rgba(255,255,255,0.15);font-family:var(--serif);font-size:30rpx;font-weight:700;}

.cpr-bar{display:flex;justify-content:space-between;align-items:center;padding:20rpx 28rpx;background:rgba(255,255,255,0.06);border-radius:24rpx;margin-bottom:40rpx;font-family:var(--mono);font-size:22rpx;}
.cpr-bar-item{display:flex;flex-direction:column;align-items:center;gap:4rpx;}
.cpr-bar-label{opacity:0.6;font-size:20rpx;}
.cpr-bar-value{font-size:28rpx;font-weight:700;}

.cpr-instruction{background:rgba(255,255,255,0.06);border-radius:32rpx;padding:40rpx;margin:0 0 32rpx;border-left:6rpx solid var(--rescue-red);}
.cpr-instruction-num{font-family:var(--mono);font-size:22rpx;color:var(--rescue-red);letter-spacing:2rpx;margin-bottom:12rpx;font-weight:700;display:block;}
.cpr-instruction-text{font-family:var(--serif);font-size:32rpx;font-weight:700;display:block;margin-bottom:16rpx;}
.cpr-instruction-detail{font-size:24rpx;opacity:0.75;line-height:1.6;display:block;}
.cpr-actions{display:flex;gap:20rpx;}
.cpr-action{flex:1;padding:28rpx;background:rgba(255,255,255,0.08);border-radius:24rpx;font-size:24rpx;display:flex;flex-direction:column;align-items:center;gap:8rpx;border:1px solid rgba(255,255,255,0.1);color:#fff;
  &.aed-action{background:rgba(245,158,11,0.2);border-color:rgba(245,158,11,0.5);}
  &.danger{background:var(--rescue-red);border-color:var(--rescue-red);}
}
.cpr-action-icon{font-size:40rpx;}
.cpr-action-media{margin-top:20rpx;padding:28rpx;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.25);border-radius:24rpx;display:flex;align-items:center;justify-content:center;gap:12rpx;color:#60A5FA;font-size:26rpx;font-weight:600;}
.cpr-action-media-icon{font-size:32rpx;}

.vent-img{width:100%;height:360rpx;border-radius:24rpx;margin-bottom:32rpx;animation:float-img 4s ease-in-out infinite;}
.vent-checklist{display:flex;flex-direction:column;gap:20rpx;margin-bottom:40rpx;text-align:left;}
.vent-item{display:flex;align-items:center;gap:28rpx;padding:28rpx 36rpx;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:24rpx;transition:all 0.3s;
  &.done{background:rgba(52,210,119,0.1);border-color:rgba(52,210,119,0.4);.vent-num{background:var(--green);}}
  &.active{background:rgba(192,57,43,0.2);border-color:var(--rescue-red);box-shadow:0 0 32rpx rgba(192,57,43,0.3);.vent-num{background:var(--rescue-red);}}
}
.vent-num{width:64rpx;height:64rpx;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-weight:700;font-size:28rpx;flex-shrink:0;color:#fff;}
.vent-text{font-size:30rpx;font-weight:700;font-family:var(--serif);}
.vent-sub{display:block;font-size:22rpx;font-weight:400;color:rgba(255,255,255,0.6);margin-top:4rpx;}

.confirm-body{display:flex;flex-direction:column;gap:24rpx;}
.confirm-drill-box{display:flex;gap:20rpx;align-items:flex-start;padding:28rpx 32rpx;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:28rpx;}
.confirm-drill-icon{font-size:40rpx;flex-shrink:0;}
.confirm-drill-title{display:block;font-size:26rpx;font-weight:700;color:#F59E0B;margin-bottom:4rpx;}
.confirm-drill-desc{font-size:22rpx;color:rgba(255,255,255,0.5);}
.confirm-body-text{font-size:26rpx;color:rgba(255,255,255,0.75);line-height:1.75;padding:28rpx 32rpx;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:28rpx;}
.confirm-check{display:flex;align-items:flex-start;gap:24rpx;padding:28rpx 0;border-top:1px solid rgba(255,255,255,0.08);border-bottom:1px solid rgba(255,255,255,0.08);}
.confirm-checkbox{width:44rpx;height:44rpx;border-radius:12rpx;border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2rpx;color:#fff;font-size:24rpx;font-weight:700;
  &.checked{background:var(--green);border-color:var(--green);}
}
.confirm-check-label{font-size:26rpx;color:rgba(255,255,255,0.85);line-height:1.5;}
.confirm-btn{width:100%;padding:36rpx;border-radius:36rpx;font-family:var(--serif);font-size:34rpx;font-weight:900;text-align:center;transition:all 0.2s;
  &.ready{background:linear-gradient(135deg,#C0392B,#8B2A1F);color:#fff;box-shadow:0 16rpx 48rpx rgba(192,57,43,0.5);}
  &.disabled{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.3);}
}

@keyframes blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,0.6);}50%{box-shadow:0 0 0 24rpx rgba(192,57,43,0);}}
</style>
