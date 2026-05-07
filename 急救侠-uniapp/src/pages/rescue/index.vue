<template>
  <view class="page-rescue">
    <!-- === 阶段1：决策 === -->
    <view v-if="stage === 'decision'" class="rescue-decision">
      <!-- 顶栏 -->
      <view class="rescue-appbar">
        <text class="rescue-back" @click="goBack">‹</text>
        <text class="rescue-title">紧急救护</text>
        <view class="rescue-call-120" @click="call120">
          <text class="rescue-120-dot">📞</text>
          <text>120</text>
        </view>
      </view>

      <!-- 紧迫感 -->
      <view class="decision-tag-row">
        <view class="decision-tag">
          <view class="decision-tag-dot" />
          <text>EMERGENCY · 黄金 4 分钟</text>
        </view>
      </view>

      <view class="decision-headline">
        <text class="decision-main">患者倒地无反应？</text>
        <text class="decision-sub">深呼吸 · 您不会孤军奋战</text>
      </view>

      <!-- CPR 按钮（组件） -->
      <view class="sos-btn-wrap">
        <SosButton
          variant="dark"
          title="立即启动 CPR"
          subtitle="全自动呼叫 120 + 调度 AED 小队"
          :show-arrow="false"
          @click="showConfirm"
        />
      </view>

      <!-- 系统自动操作说明 -->
      <view class="decision-auto-box">
        <text class="decision-auto-label">点击后 5 秒内系统自动:</text>
        <view class="decision-auto-row">
          <view v-for="item in autoActions" :key="item.label" class="decision-auto-item">
            <view class="decision-auto-icon">{{ item.icon }}</view>
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <!-- 其他紧急情况 -->
      <view class="decision-other-label">其他紧急情况</view>
      <view class="decision-other-grid">
        <view
          v-for="g in emergencyGuides"
          :key="g.type"
          class="decision-other-btn"
          :class="{ 'decision-other-wide': g.wide }"
          @click="showGuide(g.type)"
        >
          <text class="decision-other-emoji">{{ g.emoji }}</text>
          <view>
            <text class="decision-other-name">{{ g.title }}</text>
            <text class="decision-other-desc">{{ g.desc }}</text>
          </view>
        </view>
      </view>

      <!-- 底部信任 -->
      <view class="decision-legal">
        <text>🛡 善意救助免责</text>
        <text>·</text>
        <text>《民法典》184 条</text>
      </view>
    </view>

    <!-- === 阶段2：CPR 流程 === -->
    <view v-if="stage === 'cpr'" class="rescue-cpr">
      <view class="rescue-appbar">
        <text class="rescue-back" @click="backToDecision">‹</text>
        <text class="rescue-title">{{ stepTitle }}</text>
        <text class="rescue-back rescue-settings">⚙</text>
      </view>

      <!-- 进度条 -->
      <view class="step-progress">
        <view v-for="s in 5" :key="s" class="step-pill" :class="stepPillClass(s)">
          {{ s }}<text class="step-pill-label">{{ stepLabels[s - 1] }}</text>
        </view>
      </view>

      <!-- 步骤1：呼救 -->
      <view v-if="cprStep === 1" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#F59E0B,#D97706);">
          <text class="step-icon-emoji">📣</text>
        </view>
        <text class="step-action-label">系统调度中 · 您只管准备按压</text>
        <text class="step-quote">"系统已调度！现场清空，准备按压！"</text>
        <view class="step-tasks">
          <view class="step-task done"><text class="step-task-check">✓</text><text class="step-task-text"><strong>120 已自动呼叫</strong></text></view>
          <view class="step-task done"><text class="step-task-check">✓</text><text class="step-task-text"><strong>5km 内 8 名志愿者</strong>已通知</text></view>
          <view class="step-task active"><text class="step-task-check" style="background:#F59E0B;">⚡</text><text class="step-task-text"><strong>3 名志愿者小队已分工</strong></text></view>
        </view>
        <view class="step-detail"><strong style="color:#FF8B5B;">您不用自己去找 AED</strong>——系统已同步调度。</view>
        <StepTimer :seconds="7" @done="cprStep = 2" />
        <view class="step-buttons"><view class="step-btn-primary" @click="cprStep = 2">已喊人 · 立即开始</view></view>
      </view>

      <!-- 步骤2：判断意识 -->
      <view v-if="cprStep === 2" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#FF6B5B,#C0392B);">
          <text class="step-icon-emoji">👋</text>
        </view>
        <text class="step-action-label">判断意识 · 5 秒</text>
        <text class="step-quote">"喂！你怎么啦？"</text>
        <view class="step-detail">拍打患者两侧肩膀，在耳边大声呼喊。观察是否有反应。</view>
        <StepTimer :seconds="5" @done="cprStep = 3" />
        <view class="step-buttons"><view class="step-btn-secondary" @click="abort('有反应')">有反应 · 暂停</view></view>
      </view>

      <!-- 步骤3：判断呼吸 -->
      <view v-if="cprStep === 3" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#4A90E2,#2563EB);">
          <text class="step-icon-emoji">🫁</text>
        </view>
        <text class="step-action-label">判断呼吸 · 默数 7 秒</text>
        <text class="step-quote">{{ breathCounter }}</text>
        <view class="step-detail">把脸贴近患者口鼻，同时看胸口起伏、听呼吸。</view>
        <StepTimer :seconds="7" @done="cprStep = 4" />
        <view class="step-buttons"><view class="step-btn-secondary" @click="abort('有正常呼吸')">有正常呼吸 · 暂停</view></view>
      </view>

      <!-- 步骤4：按压 -->
      <view v-if="cprStep === 4" class="cpr-step-card">
        <view class="cpr-bar">
          <view class="cpr-bar-item"><text class="cpr-bar-label">总坚持</text><text class="cpr-bar-value">{{ elapsed }}</text></view>
          <view class="cpr-bar-item"><text class="cpr-bar-label">本组</text><text class="cpr-bar-value">{{ pressCount }}/30</text></view>
          <view class="cpr-bar-item"><text class="cpr-bar-label">完成组数</text><text class="cpr-bar-value">{{ rounds }}</text></view>
        </view>
        <!-- 节拍器（组件） -->
        <Metronome
          :display="pressNumDisplay"
          :label="pressLabel"
          @reset="resetCount"
        />
        <view class="cpr-instruction">
          <text class="cpr-instruction-num">按压要点</text>
          <text class="cpr-instruction-text">双掌交叠 · 胸骨中下段 · 下压 5-6cm</text>
          <text class="cpr-instruction-detail">手臂保持<strong style="color:#FF8B5B;">伸直</strong>，借上半身重量。</text>
        </view>
        <view class="cpr-actions">
          <view class="cpr-action" @click="goHelper"><text class="cpr-action-icon">+</text><text>叫人协助</text></view>
          <view class="cpr-action aed-action" @click="goAedFlow"><text class="cpr-action-icon">⚡</text><text>AED 连好了</text></view>
          <view class="cpr-action danger" @click="call120"><text class="cpr-action-icon">📞</text><text>120</text></view>
        </view>
      </view>

      <!-- AED 介入 -->
      <view v-if="cprStep === 'aed'" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#F59E0B,#D97706);">
          <text class="step-icon-emoji">⚡</text>
        </view>
        <text class="step-action-label">{{ aedPhaseLabel }}</text>
        <text class="step-quote">{{ aedPhaseQuote }}</text>
        <view class="step-detail" v-html="aedPhaseDetail" />
        <StepTimer :seconds="aedPhaseSeconds" :key="aedPhase" @done="advanceAedPhase" />
        <view class="step-buttons"><view class="step-btn-secondary" @click="cancelAed">取消 · 继续按压</view></view>
      </view>

      <!-- 步骤5：人工呼吸 -->
      <view v-if="cprStep === 5" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#10B981,#059669);">
          <text class="step-icon-emoji">💨</text>
        </view>
        <text class="step-action-label">人工呼吸 · {{ ventRound }} / 2</text>
        <text class="step-quote">{{ ventRound === 1 ? '第 1 次' : '第 2 次' }}</text>
        <image class="vent-img" src="/static/ventilation.png" mode="aspectFill" />
        <view class="vent-checklist">
          <view v-for="(v, i) in ventSteps" :key="i" class="vent-item" :class="{ done: i < 3, active: i === 3 }">
            <text class="vent-num">{{ i + 1 }}</text>
            <text class="vent-text">{{ v.title }} <text class="vent-sub">{{ v.sub }}</text></text>
          </view>
        </view>
        <StepTimer :seconds="3.5" :key="ventRound" @done="advanceVent" />
      </view>

      <!-- 循环页 -->
      <view v-if="cprStep === 'loop'" class="cpr-step-card">
        <view class="step-icon-wrap" style="background:linear-gradient(135deg,#C0392B,#8B2A1F);">
          <text class="step-icon-emoji">🔁</text>
        </view>
        <text class="step-action-label">完成 {{ rounds }} 个 CPR 循环</text>
        <text class="step-quote">继续 30 按压 + 2 人工呼吸</text>
        <view class="step-detail">持续循环到 120 急救员到达。<strong style="color:#FF8B5B;">不要停下！</strong></view>
        <StepTimer :seconds="3" @done="nextRound" />
        <view class="step-buttons"><view class="step-btn-primary" @click="nextRound">立即开始下一组</view></view>
      </view>
    </view>

    <!-- 确认弹层（组件） -->
    <BottomSheet :visible="confirmVisible" dark title="⚠️ 责任与义务确认" @close="confirmVisible = false">
      <view class="confirm-body">
        您即将启动<strong>真实紧急救援流程</strong>。系统将自动呼叫 120、通知附近志愿者、记录您的 GPS 位置。
      </view>
      <view class="confirm-check" @click="confirmed = !confirmed">
        <view class="confirm-checkbox" :class="{ checked: confirmed }">{{ confirmed ? '✓' : '' }}</view>
        <text class="confirm-check-label">我已阅读并理解《善意救助免责声明》（《民法典》第 184 条）</text>
      </view>
      <view class="confirm-btn" :class="confirmed ? 'ready' : 'disabled'" @click="startCpr">确认启动 CPR</view>
    </BottomSheet>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import SosButton from '@/components/SosButton/index.vue'
import StepTimer from '@/components/StepTimer/index.vue'
import Metronome from '@/components/Metronome/index.vue'
import BottomSheet from '@/components/BottomSheet/index.vue'
import { voice } from '@/utils/voice'

// --- 状态 ---
const stage = ref<'decision' | 'cpr'>('decision')
const cprStep = ref<number | 'aed' | 'loop'>(1)
const confirmVisible = ref(false)
const confirmed = ref(false)

// CPR 状态
const pressCount = ref(0)
const rounds = ref(0)
const elapsed = ref('00:00')
const pressNumDisplay = ref('准备')
const pressLabel = ref('点圆圈可重置')
const totalSeconds = ref(0)
let totalTimer: number | null = null
let pressTimer: number | null = null

// 呼吸 & AED
const breathCounter = ref('1001')
const ventRound = ref(1)
const aedPhase = ref(0)
let breathTimer: number | null = null

// --- 计算 ---
const stepTitle = computed(() => {
  const titles: Record<string, string> = {
    '1': '第 1 步 · 呼救', '2': '第 2 步 · 判断意识',
    '3': '第 3 步 · 判断呼吸', '4': '第 4 步 · 胸外按压',
    '5': '第 5 步 · 人工呼吸', 'aed': 'AED 介入', 'loop': '循环 · 持续救护',
  }
  return titles[String(cprStep.value)] || 'CPR 进行中'
})

const aedPhaseLabel = computed(() => {
  const l: Record<number, string> = { 0: 'AED 分析中 · 停止按压', 1: 'AED 建议电击 · 再次离开', 2: '电击完成 · 立即恢复按压' }
  return l[aedPhase.value] || ''
})
const aedPhaseQuote = computed(() => aedPhase.value === 0 ? '所有人离开患者！' : aedPhase.value === 1 ? '"离开！按下电击键！"' : '"立即按压！"')
const aedPhaseDetail = computed(() => aedPhase.value === 2 ? '电击已完成。<strong style="color:#FF8B5B;">不要等待心跳</strong>，立即从 1 开始重新按压 30 次。' : '')
const aedPhaseSeconds = computed(() => aedPhase.value === 0 ? 10 : aedPhase.value === 1 ? 5 : 2.5)

// --- 常量 ---
const stepLabels = ['呼救', '判断', '呼吸', '按压', '人工呼吸']
const autoActions = [
  { icon: '📞', label: '呼叫 120' },
  { icon: '👥', label: '召志愿者' },
  { icon: '⚡', label: '派 AED' },
]
const emergencyGuides = [
  { type: 'heimlich', emoji: '🫁', title: '异物窒息', desc: '海姆立克法', wide: false },
  { type: 'bleeding', emoji: '🩸', title: '大出血', desc: '压迫止血包扎', wide: false },
  { type: 'fracture', emoji: '🦴', title: '骨折外伤', desc: '原位固定防二次损伤', wide: false },
  { type: 'transport', emoji: '🚑', title: '伤员搬运', desc: '脊柱损伤搬运技巧', wide: false },
  { type: 'psychological', emoji: '🧠', title: '紧急心理干预', desc: '安抚情绪转移注意力', wide: true },
]
const ventSteps = [
  { title: '仰头抬下巴', sub: '让气道打开' },
  { title: '检查口腔', sub: '清除可见异物' },
  { title: '捏住鼻子', sub: '嘴包嘴密封' },
  { title: '吹一口气', sub: '看到胸部鼓起即可' },
]

// --- 方法 ---
function stepPillClass(s: number) {
  const n = typeof cprStep.value === 'number' ? cprStep.value : 5
  return { active: s === n, done: s < n }
}

function showConfirm() { confirmVisible.value = true; confirmed.value = false }
function startCpr() {
  if (!confirmed.value) return
  confirmVisible.value = false
  stage.value = 'cpr'
  cprStep.value = 1
  startTotalTimer()
}

function backToDecision() { stopVoice(); stage.value = 'decision'; stopAll() }
function goBack() { uni.navigateBack() }

function abort(reason: string) {
  stopAll()
  uni.showToast({ title: `已暂停：${reason}`, icon: 'none' })
  stage.value = 'decision'
}

function call120() {
  uni.makePhoneCall({ phoneNumber: '120' }).catch(() => {
    uni.showToast({ title: '演示模式：正在呼叫 120...', icon: 'none' })
  })
}

function showGuide(type: string) {
  uni.navigateTo({ url: `/pages/guide/index?type=${type}` })
}

function goHelper() {
  uni.navigateTo({ url: '/pages/share/index' })
}

// --- CPR 流程 ---
function startTotalTimer() {
  if (totalTimer) return
  totalTimer = setInterval(() => {
    totalSeconds.value++
    const m = Math.floor(totalSeconds.value / 60).toString().padStart(2, '0')
    const s = (totalSeconds.value % 60).toString().padStart(2, '0')
    elapsed.value = `${m}:${s}`
  }, 1000) as unknown as number
}

function resetCount() {
  stopPress()
  pressCount.value = 0
  pressNumDisplay.value = '0'
  pressLabel.value = '已重置'
  setTimeout(() => { pressLabel.value = '跟屏幕数字按压'; startPress() }, 1500)
}

// 中文数字
const CN_NUMS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

function toChineseNumber(n: number): string {
  if (n <= 10) return CN_NUMS[n]
  if (n < 20) return '十' + (n % 10 === 0 ? '' : CN_NUMS[n % 10])
  if (n < 30) return '二十' + (n % 10 === 0 ? '' : CN_NUMS[n % 10])
  if (n === 30) return '三十'
  return String(n)
}

function startPress() {
  stopPress()
  pressCount.value = 0
  pressNumDisplay.value = '0'
  const tick = () => {
    pressCount.value++
    const display = pressCount.value < 10 ? '0' + pressCount.value : String(pressCount.value)
    pressNumDisplay.value = display
    // 语音报数：不 cancel，直接排队播报
    voice.count(toChineseNumber(pressCount.value))
    if (pressCount.value >= 30) {
      stopPress()
      cprStep.value = 5
      ventRound.value = 1
    }
  }
  tick()
  pressTimer = setInterval(tick, 545) as unknown as number // 110 BPM
}

function stopPress() {
  if (pressTimer) { clearInterval(pressTimer); pressTimer = null }
}

function goAedFlow() {
  stopPress()
  uni.switchTab({ url: '/pages/aed/index' })
}
function advanceAedPhase() {
  if (aedPhase.value === 0) aedPhase.value = 1
  else if (aedPhase.value === 1) aedPhase.value = 2
  else { cprStep.value = 4; pressCount.value = 0; pressNumDisplay.value = '0' }
}
function cancelAed() { cprStep.value = 4 }

function advanceVent() {
  if (ventRound.value === 1) { ventRound.value = 2 }
  else { rounds.value++; cprStep.value = 'loop' }
}
function nextRound() { cprStep.value = 4 }

// --- 语音播报 ---
function speakGuide(text: string) {
  voice.guide(text)
}

function speakCommand(text: string) {
  voice.command(text)
}

function speakUrgent(text: string) {
  voice.speak(text, { rate: 1.2, pitch: 1.05, priority: 'URGENT' })
}

function stopVoice() {
  voice.stop()
}

// 监听 CPR 步骤变化，自动播报语音指引
watch([cprStep, aedPhase], ([step, phase]) => {
  voice.stop()
  setTimeout(() => {
    if (step === 1) {
      speakCommand('系统已调度。现场清空，准备按压。')
    } else if (step === 2) {
      speakGuide('拍打患者两侧肩膀，在耳边大声呼喊。观察是否有反应。')
    } else if (step === 3) {
      startBreathCount()
    } else {
      stopBreathCount()
    }
    if (step === 4) {
      startPress()
    }
    if (step === 'aed') {
      if (phase === 0) speakUrgent('所有人离开患者。AED 正在分析心率。')
      else if (phase === 1) speakUrgent('离开。按下电击键。')
    } else if (step === 5) {
      speakGuide('仰头抬下巴，让气道打开。检查口腔，清除可见异物。捏住鼻子，嘴包嘴密封，吹一口气。')
    } else if (step === 'loop') {
      speakCommand('继续三十次按压，加两次人工呼吸。不要停下。')
    }
  }, 50)
})

function stopAll() {
  stopPress()
  stopBreathCount()
  stopVoice()
  if (totalTimer) { clearInterval(totalTimer); totalTimer = null }
}

function startBreathCount() {
  stopBreathCount()
  breathCounter.value = '1001'
  voice.count('一零零一')
  let count = 1
  breathTimer = setInterval(() => {
    count++
    const num = 1000 + count
    breathCounter.value = String(num)
    voice.count(String(num))
    if (count >= 7) {
      stopBreathCount()
    }
  }, 1000) as unknown as number
}

function stopBreathCount() {
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null }
}

onUnmounted(() => stopAll())
</script>

<style lang="scss" scoped>
/* ============================================
   救援页样式
   ============================================ */
.page-rescue {
  background: linear-gradient(180deg, #2A0F0C 0%, #1A0907 100%);
  color: #fff;
  min-height: 100vh;
  padding-bottom: 60rpx;
}

/* 顶栏 */
.rescue-appbar {
  display: flex;
  align-items: center;
  padding: 28rpx 40rpx;
  gap: 24rpx;

  text { color: #fff; }
}
.rescue-back {
  font-size: 48rpx;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rescue-title {
  flex: 1;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 36rpx;
}
.rescue-call-120 {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  padding: 16rpx 28rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  font-family: var(--mono);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.rescue-120-dot { color: #FF6B5B; }
.rescue-settings { font-size: 36rpx; }

/* 决策页 */
.decision-tag-row { text-align: center; padding: 40rpx 40rpx 0; }
.decision-tag {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  background: rgba(192,57,43,0.2);
  border: 1px solid rgba(192,57,43,0.4);
  padding: 10rpx 24rpx;
  border-radius: 40rpx;
  font-family: var(--mono);
  font-size: 20rpx;
  letter-spacing: 3rpx;
  color: #FF8B5B;
}
.decision-tag-dot {
  width: 14rpx; height: 14rpx;
  background: #FF6B5B;
  border-radius: 50%;
  animation: blink 1s infinite;
}
.decision-headline { text-align: center; padding: 0 40rpx 56rpx; }
.decision-main { font-family: var(--serif); font-size: 64rpx; font-weight: 900; line-height: 1.2; display: block; margin-bottom: 20rpx; }
.decision-sub { font-size: 28rpx; opacity: 0.7; }

/* CPR 主按钮 */
.sos-btn-wrap { padding: 0 40rpx 32rpx; }
.decision-btn-wrap { padding: 0 40rpx 32rpx; }
.primary-rescue-btn {
  width: 100%;
  background: linear-gradient(135deg, #C0392B 0%, #8B2A1F 100%);
  border: 2px solid rgba(255,107,91,0.5);
  border-radius: 48rpx;
  padding: 52rpx 44rpx;
  position: relative;
  overflow: hidden;
  box-shadow: 0 32rpx 80rpx rgba(192,57,43,0.45);
  &:active { transform: scale(0.98); }
}
.primary-rescue-pulse, .primary-rescue-pulse-2 {
  position: absolute; inset: -4rpx; border-radius: 48rpx; pointer-events: none;
}
.primary-rescue-pulse { background: rgba(255,107,91,0.4); animation: missionPulse 1.5s ease-in-out infinite; z-index: 0; }
.primary-rescue-pulse-2 { background: rgba(255,107,91,0.25); animation: missionPulse 1.5s ease-in-out infinite 0.6s; z-index: 0; }
.primary-rescue-content { display: flex; align-items: center; gap: 36rpx; position: relative; z-index: 1; }
.primary-rescue-icon {
  width: 112rpx; height: 112rpx;
  background: rgba(255,255,255,0.2);
  border: 1.5px solid rgba(255,255,255,0.3);
  border-radius: 32rpx;
  display: flex; align-items: center; justify-content: center;
  font-size: 60rpx; flex-shrink: 0;
}
.primary-rescue-text { flex: 1; text-align: left; }
.primary-rescue-title { font-family: var(--serif); font-size: 44rpx; font-weight: 900; line-height: 1.2; margin-bottom: 8rpx; display: block; }
.primary-rescue-sub { font-size: 24rpx; opacity: 0.85; display: block; }
.primary-rescue-arrow { font-size: 48rpx; opacity: 0.7; flex-shrink: 0; }

/* 系统自动操作 */
.decision-auto-box {
  margin: 0 40rpx 40rpx;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 28rpx;
  padding: 28rpx 36rpx;
}
.decision-auto-label { font-family: var(--mono); font-size: 20rpx; letter-spacing: 3rpx; color: rgba(255,255,255,0.5); margin-bottom: 20rpx; display: block; }
.decision-auto-row { display: flex; gap: 20rpx; }
.decision-auto-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8rpx; font-size: 24rpx; color: rgba(255,255,255,0.85); }
.decision-auto-icon { width: 64rpx; height: 64rpx; background: rgba(245,158,11,0.2); border-radius: 20rpx; display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 28rpx; }

/* 其他紧急情况 */
.decision-other-label { font-family: var(--mono); font-size: 20rpx; letter-spacing: 2rpx; color: rgba(255,255,255,0.5); margin-bottom: 24rpx; text-align: center; }
.decision-other-grid { padding: 0 40rpx; display: grid; grid-template-columns: 1fr 1fr; gap: 20rpx; }
.decision-other-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  text-align: left;
  &.decision-other-wide { grid-column: span 2; }
}
.decision-other-emoji { font-size: 40rpx; flex-shrink: 0; }
.decision-other-name { font-family: var(--serif); font-weight: 700; font-size: 26rpx; line-height: 1.2; display: block; }
.decision-other-desc { font-size: 20rpx; color: rgba(255,255,255,0.5); margin-top: 4rpx; display: block; }

.decision-legal {
  display: flex; align-items: center; gap: 20rpx; justify-content: center;
  font-size: 22rpx; color: rgba(255,255,255,0.4); font-family: var(--mono);
  padding: 0 40rpx 48rpx;
}

/* ============ CPR 流程共享 ============ */
.step-progress {
  display: flex; align-items: center; padding: 16rpx 40rpx 24rpx;
}
.step-pill {
  width: 72rpx; height: 72rpx; border-radius: 50%;
  background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-weight: 700; font-size: 28rpx;
  color: rgba(255,255,255,0.5); position: relative; flex-shrink: 0; z-index: 1;
  &.active { background: var(--rescue-red); border-color: var(--rescue-red); color: #fff; box-shadow: 0 0 32rpx rgba(192,57,43,0.5); }
  &.done { background: rgba(52,210,119,0.2); border-color: var(--green); color: var(--green); }
}
.step-pill + .step-pill { margin-left: 8rpx; }
/* 用 connection line 替代 step-line：每个 pill 间加一条 */
.step-pill-label { position: absolute; bottom: -32rpx; font-size: 18rpx; font-weight: 500; white-space: nowrap; color: rgba(255,255,255,0.5); }
.step-pill.active .step-pill-label { color: #fff; }

.cpr-step-card { padding: 48rpx 40rpx 40rpx; text-align: center; }
.step-icon-wrap {
  width: 200rpx; height: 200rpx; border-radius: 64rpx;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 40rpx; box-shadow: 0 24rpx 64rpx rgba(0,0,0,0.3);
}
.step-icon-emoji { font-size: 96rpx; }
.step-action-label { font-family: var(--mono); font-size: 24rpx; letter-spacing: 4rpx; color: rgba(255,255,255,0.7); margin-bottom: 24rpx; display: block; }
.step-quote { font-family: var(--serif); font-size: 44rpx; font-weight: 900; color: #fff; margin-bottom: 32rpx; display: block; line-height: 1.3; }
.step-detail {
  font-size: 28rpx; line-height: 1.6; color: rgba(255,255,255,0.8);
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 28rpx; padding: 28rpx 36rpx; margin-bottom: 40rpx; text-align: left;
}
.step-tasks { display: flex; flex-direction: column; gap: 20rpx; margin-bottom: 32rpx; text-align: left; }
.step-task {
  display: flex; gap: 24rpx; align-items: center;
  padding: 28rpx 32rpx; background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 24rpx;
  &.done { background: rgba(52,210,119,0.1); border-color: rgba(52,210,119,0.3); }
  &.active { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.4); }
}
.step-task-check {
  width: 56rpx; height: 56rpx; border-radius: 50%; background: var(--green);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 28rpx; font-weight: 700; flex-shrink: 0;
}
.step-task-text { font-size: 28rpx; font-weight: 500; }
.step-buttons { display: flex; gap: 24rpx; }
.step-btn-primary {
  flex: 1; padding: 32rpx; border-radius: 28rpx;
  background: var(--rescue-red); color: #fff;
  font-family: var(--serif); font-size: 30rpx; font-weight: 700;
  box-shadow: 0 12rpx 36rpx rgba(192,57,43,0.4);
}
.step-btn-secondary {
  flex: 1; padding: 32rpx; border-radius: 28rpx;
  background: rgba(255,255,255,0.06); color: #fff;
  border: 2px solid rgba(255,255,255,0.15);
  font-family: var(--serif); font-size: 30rpx; font-weight: 700;
}

/* CPR Bar */
.cpr-bar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20rpx 28rpx; background: rgba(255,255,255,0.06);
  border-radius: 24rpx; margin-bottom: 40rpx; font-family: var(--mono); font-size: 22rpx;
}
.cpr-bar-item { display: flex; flex-direction: column; align-items: center; gap: 4rpx; }
.cpr-bar-label { opacity: 0.6; font-size: 20rpx; }
.cpr-bar-value { font-size: 28rpx; font-weight: 700; }

/* 节拍器 */
.metronome-wrap { display: flex; flex-direction: column; align-items: center; padding: 24rpx 0 48rpx; }
.metronome {
  width: 480rpx; height: 480rpx; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.metronome-ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); }
.metronome-ring-active { border: 3px solid var(--rescue-red); animation: beat 0.545s ease-in-out infinite; box-shadow: 0 0 80rpx rgba(192,57,43,0.4); }
.metronome-center { text-align: center; z-index: 2; }
.metronome-bpm { font-family: var(--mono); font-size: 112rpx; font-weight: 700; line-height: 1; }
.metronome-bpm-label { font-size: 24rpx; opacity: 0.6; letter-spacing: 4rpx; margin-top: 8rpx; }

/* 按压 */
.cpr-instruction {
  background: rgba(255,255,255,0.06); border-radius: 32rpx;
  padding: 40rpx; margin: 0 0 32rpx; border-left: 6rpx solid var(--rescue-red);
}
.cpr-instruction-num { font-family: var(--mono); font-size: 22rpx; color: var(--rescue-red); letter-spacing: 2rpx; margin-bottom: 12rpx; font-weight: 700; display: block; }
.cpr-instruction-text { font-family: var(--serif); font-size: 32rpx; font-weight: 700; display: block; margin-bottom: 16rpx; }
.cpr-instruction-detail { font-size: 24rpx; opacity: 0.75; line-height: 1.6; display: block; }
.cpr-actions { display: flex; gap: 20rpx; }
.cpr-action {
  flex: 1; padding: 28rpx; background: rgba(255,255,255,0.08);
  border-radius: 24rpx; font-size: 24rpx;
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
  border: 1px solid rgba(255,255,255,0.1); color: #fff;
  &.aed-action { background: rgba(245,158,11,0.2); border-color: rgba(245,158,11,0.5); }
  &.danger { background: var(--rescue-red); border-color: var(--rescue-red); }
}
.cpr-action-icon { font-size: 40rpx; }

/* 人工呼吸 */
.vent-img { width: 100%; height: 360rpx; border-radius: 24rpx; margin-bottom: 32rpx; }
.vent-checklist { display: flex; flex-direction: column; gap: 20rpx; margin-bottom: 40rpx; text-align: left; }
.vent-item {
  display: flex; align-items: center; gap: 28rpx; padding: 28rpx 36rpx;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 24rpx;
  transition: all 0.3s;
  &.done { background: rgba(52,210,119,0.1); border-color: rgba(52,210,119,0.4); .vent-num { background: var(--green); } }
  &.active { background: rgba(192,57,43,0.2); border-color: var(--rescue-red); box-shadow: 0 0 32rpx rgba(192,57,43,0.3); .vent-num { background: var(--rescue-red); } }
}
.vent-num {
  width: 64rpx; height: 64rpx; border-radius: 50%; background: rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-weight: 700; font-size: 28rpx; flex-shrink: 0; color: #fff;
}
.vent-text { font-size: 30rpx; font-weight: 700; font-family: var(--serif); }
.vent-sub { display: block; font-size: 22rpx; font-weight: 400; color: rgba(255,255,255,0.6); margin-top: 4rpx; }

/* ============ 确认弹层 ============ */
.confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  backdrop-filter: blur(12rpx); z-index: 1100;
  display: flex; align-items: flex-end; justify-content: center;
}
.confirm-sheet {
  width: 100%; max-width: 480px;
  background: #1A0907; border-radius: 56rpx 56rpx 0 0;
  padding: 56rpx 48rpx calc(56rpx + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(255,255,255,0.1);
  animation: slideUp 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}
.confirm-handle { width: 72rpx; height: 8rpx; background: rgba(255,255,255,0.2); border-radius: 4rpx; margin: 0 auto 48rpx; }
.confirm-title { font-family: var(--serif); font-size: 40rpx; font-weight: 900; color: #fff; display: block; margin-bottom: 12rpx; }
.confirm-body {
  font-size: 26rpx; color: rgba(255,255,255,0.75); line-height: 1.75; margin-bottom: 40rpx;
  padding: 28rpx 32rpx; background: rgba(245,158,11,0.06);
  border: 1px solid rgba(245,158,11,0.2); border-radius: 28rpx; border-left: 6rpx solid #F59E0B;
}
.confirm-check { display: flex; align-items: flex-start; gap: 24rpx; padding: 28rpx 0; border-top: 1px solid rgba(255,255,255,0.08); border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 40rpx; }
.confirm-checkbox {
  width: 44rpx; height: 44rpx; border-radius: 12rpx; border: 2px solid rgba(255,255,255,0.3);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2rpx;
  color: #fff; font-size: 24rpx; font-weight: 700;
  &.checked { background: var(--green); border-color: var(--green); }
}
.confirm-check-label { font-size: 26rpx; color: rgba(255,255,255,0.85); line-height: 1.5; }
.confirm-btn {
  width: 100%; padding: 36rpx; border-radius: 36rpx;
  font-family: var(--serif); font-size: 34rpx; font-weight: 900; text-align: center;
  margin-bottom: 20rpx; transition: all 0.2s;
  &.ready { background: linear-gradient(135deg, #C0392B, #8B2A1F); color: #fff; box-shadow: 0 16rpx 48rpx rgba(192,57,43,0.5); }
  &.disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); }
}
.confirm-cancel { display: block; text-align: center; color: rgba(255,255,255,0.4); font-size: 26rpx; padding: 24rpx; }
</style>
