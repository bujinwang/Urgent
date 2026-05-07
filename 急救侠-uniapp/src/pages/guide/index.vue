<template>
  <view class="page-guide">
    <view class="guide-appbar">
      <text class="guide-back" @click="goBack">‹</text>
      <text class="guide-title">{{ guide.title }}</text>
      <text class="guide-step-indicator">{{ current + 1 }} / {{ guide.steps.length }}</text>
    </view>

    <!-- 场景图 -->
    <view class="guide-scene">
      <view class="scene-icon-wrap" :class="sceneAnim">
        <text class="scene-emoji">{{ guide.steps[current].icon }}</text>
      </view>
      <!-- 连接线 -->
      <view class="scene-connectors">
        <view v-for="i in guide.steps.length - 1" :key="i" class="scene-dot" :class="{ done: i <= current, current: i === current + 1 }" />
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
      <view class="card-step-tag" :class="{ warn: guide.steps[current].warn }">
        <text>第 {{ current + 1 }} 步</text>
      </view>
      <text class="card-title">{{ guide.steps[current].title }}</text>
      <text class="card-detail">{{ guide.steps[current].detail }}</text>
    </view>

    <!-- 操作 -->
    <view class="guide-nav">
      <view v-if="current > 0" class="nav-btn prev" @click="prevStep">← 上一步</view>
      <view class="nav-spacer" />
      <view v-if="current < guide.steps.length - 1" class="nav-btn next" @click="nextStep">下一步 →</view>
      <view v-else class="nav-btn done" @click="goBack">✓ 完成</view>
    </view>

    <!-- 注意事项（折叠） -->
    <view class="guide-warn-toggle" @click="showWarn = !showWarn">
      <text>⚠️ 注意事项</text>
      <text class="warn-arrow" :class="{ open: showWarn }">▾</text>
    </view>
    <view v-if="showWarn" class="guide-warning">
      <text v-for="(w, i) in guide.warnings" :key="i" class="guide-warning-item">{{ w }}</text>
    </view>

    <!-- 底部 -->
    <view class="guide-footer">
      <view class="guide-call-btn" @click="call120">
        <text class="guide-call-icon">📞</text>
        <text>呼叫 120</text>
      </view>
      <text class="guide-legal">🛡 善意救助免责 · 《民法典》184 条</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { voice } from '@/utils/voice'

interface Step { title: string; detail: string; icon: string; warn?: boolean }
interface GuideData { title: string; emoji: string; steps: Step[]; warnings: string[] }

const guides: Record<string, GuideData> = {
  bleeding: {
    title: '大出血', emoji: '🩸',
    steps: [
      { title: '直接压迫止血', detail: '用干净纱布或毛巾用力按压伤口', icon: '✋' },
      { title: '抬高受伤部位', detail: '将出血部位抬高至心脏水平以上', icon: '⬆️' },
      { title: '加压包扎固定', detail: '用绷带紧紧缠绕，但不要过紧', icon: '🩹' },
      { title: '勿移除浸透敷料', detail: '在上面叠加新的，不要揭开旧的', icon: '📚' },
      { title: '止血带（最后手段）', detail: '扎在伤口近心端 5-7cm 处，记录时间', icon: '⏱️', warn: true },
    ],
    warnings: ['戴手套或塑料袋隔离，勿直接接触血液', '异物刺入体内不要拔除，周围垫高固定', '密切观察面色呼吸，休克迹象告知 120'],
  },
  heimlich: {
    title: '异物窒息', emoji: '🫁',
    steps: [
      { title: '确认窒息', detail: '患者无法说话、双手抓喉、面色发紫', icon: '👀' },
      { title: '站到背后环抱', detail: '一只手握拳，置于肚脐上方两指处', icon: '🧍' },
      { title: '向上冲击腹部', detail: '另一只手抓拳，快速向内向上冲击 ×5 次', icon: '👊' },
      { title: '检查口腔', detail: '每次冲击后查看口腔，有异物则取出', icon: '👄' },
      { title: '交替循环', detail: '5 次冲击 + 检查口腔，重复至异物排出', icon: '🔁' },
      { title: '失去意识 → CPR', detail: '平放患者，立即胸外按压并呼叫 120', icon: '❤️', warn: true },
    ],
    warnings: ['孕妇/肥胖者改为胸部冲击（握拳置胸骨中段）', '婴儿：5 次拍背 + 5 次压胸交替', '能咳嗽的患者鼓励继续咳，不要干预'],
  },
  fracture: {
    title: '骨折外伤', emoji: '🦴',
    steps: [
      { title: '不要移动患者', detail: '除非现场有立即危险，保持原位不动', icon: '🛑' },
      { title: '夹板固定', detail: '用木板/杂志固定骨折处上下两个关节', icon: '📏' },
      { title: '垫软物缓冲', detail: '夹板与身体间用衣物垫好，避免压迫', icon: '🧻' },
      { title: '悬吊固定上肢', detail: '手臂骨折用三角巾做悬吊，保持水平', icon: '🔺' },
      { title: '冷敷消肿', detail: '冰袋敷伤处周围，每次 15-20 分钟', icon: '🧊' },
    ],
    warnings: ['疑似脊柱损伤：严禁移动！保持头颈躯干直线', '开放性骨折：不要试图推回骨头', '不要给患者进食饮水（可能需急诊手术）'],
  },
  transport: {
    title: '伤员搬运', emoji: '🚑',
    steps: [
      { title: '评估现场安全', detail: '确保自身安全后再接近，仅必要时移动', icon: '👁️' },
      { title: '固定头颈', detail: '一人双手夹住耳朵，保持头颈躯干直线', icon: '🤲' },
      { title: '多人同步翻身', detail: '一人喊口令，所有人整体轴向翻动', icon: '👥' },
      { title: '硬板转移', detail: '用门板/桌面贴紧一侧，轴向滚到板上', icon: '🪵' },
      { title: '全身固定', detail: '绷带固定额头→胸部→骨盆→大腿→小腿', icon: '🔗' },
    ],
    warnings: ['脊柱损伤绝对禁止：扶起、抱起、抬头抬脚', '搬运途中保持平稳避免颠簸', '密切观察呼吸意识，随时准备 CPR'],
  },
  psychological: {
    title: '紧急心理干预', emoji: '🧠',
    steps: [
      { title: '确保安全', detail: '带离危险环境，保障基本需求（水、保暖）', icon: '🏠' },
      { title: '温柔接触', detail: '平静语调，自报身份，蹲下同高度', icon: '🤝' },
      { title: '倾听不打断', detail: '允许所有情绪，不说"别哭""坚强点"', icon: '👂' },
      { title: '提供确定信息', detail: '告知现状/谁在帮忙/接下来如何', icon: '📋' },
      { title: '转移注意力', detail: '深呼吸 → 握拳放松 → 说出 3 样看到的东西', icon: '🌿' },
    ],
    warnings: ['不要强迫回忆创伤细节', '不做无法兑现的承诺', '出现严重精神症状时保护自身安全并求助'],
  },
  seizure: {
    title: '癫痫急救', emoji: '🧠',
    steps: [
      { title: '保持冷静计时', detail: '记录发作开始时间。超过 5 分钟呼叫 120', icon: '⏱️' },
      { title: '清除危险物', detail: '移开尖锐硬物，头部下方垫软物', icon: '🧹' },
      { title: '不要按住患者', detail: '不压四肢不阻止抽搐，不往嘴里塞东西', icon: '✋' },
      { title: '侧卧位恢复', detail: '抽搐停止后转侧卧位，便于排出分泌物', icon: '🔄' },
      { title: '守在旁边', detail: '发作后可能意识模糊，温和安抚告知', icon: '💚' },
    ],
    warnings: ['绝对不要往嘴里塞任何东西', '不要强行喂水喂药', '超过 5 分钟/连续发作/水中/孕妇/首次 → 120'],
  },
}

const current = ref(0)
const showWarn = ref(false)


const guideImages: Record<string, string> = {
  bleeding: '/static/bleeding.png',
  heimlich: '/static/heimlich.png',
  fracture: '/static/fracture.png',
  transport: '/static/transport.png',
  psychological: '/static/psychological.png',
  seizure: '/static/psychological.png',
}
const guideImage = computed(() => guideImages[type.value] || '')

const type = ref('bleeding')
const guide = computed(() => guides[type.value] || guides.bleeding)

const pages = getCurrentPages()
const options = (pages[pages.length - 1] as any).$page?.options
if (options?.type) type.value = options.type

const sceneAnim = ref('pulse-in')

function nextStep() {
  if (current.value < guide.value.steps.length - 1) {
    sceneAnim.value = 'slide-out'
    setTimeout(() => {
      current.value++
      sceneAnim.value = 'slide-in'
      setTimeout(() => sceneAnim.value = 'pulse-in', 300)
    }, 200)
  }
}

function prevStep() {
  if (current.value > 0) {
    sceneAnim.value = 'slide-out'
    setTimeout(() => {
      current.value--
      sceneAnim.value = 'slide-in'
      setTimeout(() => sceneAnim.value = 'pulse-in', 300)
    }, 200)
  }
}

// 语音播报当前步骤
watch(current, (val) => {
  const s = guide.value.steps[val]
  if (s) setTimeout(() => voice.command(s.title + "，" + s.detail), 300)
})

function goBack() { uni.navigateBack() }
function call120() {
  uni.makePhoneCall({ phoneNumber: '120' }).catch(() => {
    uni.showToast({ title: '演示模式：正在呼叫 120...', icon: 'none' })
  })
}
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
