<template>
  <view class="page-guide">
    <view class="guide-appbar">
      <text class="guide-back" @click="goBack">‹</text>
      <text class="guide-title">{{ guide.title }}</text>
    </view>
    <view class="guide-hero">
      <view class="guide-icon-wrap">
        <text class="guide-emoji">{{ guide.emoji }}</text>
      </view>
      <text class="guide-name">{{ guide.title }}</text>
      <text class="guide-summary">{{ guide.summary }}</text>
    </view>
    <view class="guide-steps">
      <view v-for="(step, i) in guide.steps" :key="i" class="guide-step" :class="{ done: step.done, warn: step.warn }">
        <view class="guide-step-num">{{ i + 1 }}</view>
        <view class="guide-step-body">
          <text class="guide-step-title">{{ step.title }}</text>
          <text v-if="step.detail" class="guide-step-detail">{{ step.detail }}</text>
        </view>
      </view>
    </view>
    <view class="guide-warning">
      <text class="guide-warning-title">⚠️ 注意事项</text>
      <text v-for="(w, i) in guide.warnings" :key="i" class="guide-warning-item">{{ w }}</text>
    </view>
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
import { ref, computed } from 'vue'

interface Step { title: string; detail?: string; done?: boolean; warn?: boolean }
interface GuideData { title: string; emoji: string; summary: string; steps: Step[]; warnings: string[] }

const guides: Record<string, GuideData> = {
  bleeding: {
    title: '大出血', emoji: '🩸', summary: '严重出血可在数分钟内致命，立即止血是第一要务',
    steps: [
      { title: '直接压迫止血', detail: '用干净纱布、毛巾或衣物直接用力按压伤口。不要松开查看。' },
      { title: '抬高受伤部位', detail: '将出血部位抬高至心脏水平以上，减缓血流速度。' },
      { title: '加压包扎固定', detail: '用绷带或布条紧紧缠绕，但不要过紧阻断循环。' },
      { title: '勿移除浸透敷料', detail: '纱布被血浸透后在上面叠加新的继续按压，不要揭开旧的。' },
      { title: '止血带（最后手段）', detail: '仅当直接压迫无效且出血危及生命时使用。扎在伤口近心端 5-7cm 处，记录时间。', warn: true },
    ],
    warnings: ['切勿用手直接接触开放性伤口，尽量戴手套或用塑料袋隔离', '如果有异物刺入体内，不要拔除，在周围垫高固定后包扎', '密切观察患者面色、呼吸，出现休克迹象立即告知 120'],
  },
  heimlich: {
    title: '异物窒息', emoji: '🫁', summary: '气道完全阻塞后 4-6 分钟可致死，立即施救',
    steps: [
      { title: '确认窒息', detail: '患者无法说话、咳嗽无力、双手抓喉、面色发紫。问"你噎住了吗？"' },
      { title: '站到背后', detail: '从背后环抱患者，一只手握拳置于肚脐上方两指处。' },
      { title: '向上冲击', detail: '另一只手抓住拳头，快速向内向上冲击腹部。重复 5 次。' },
      { title: '检查口腔', detail: '每次冲击后查看口腔是否有异物排出，有则取出。' },
      { title: '交替进行', detail: '5 次腹部冲击 + 检查口腔，重复循环直至异物排出或患者失去意识。' },
      { title: '如失去意识 → CPR', detail: '将患者平放，立即开始胸外按压（按压亦可排出异物），并呼叫 120。', warn: true },
    ],
    warnings: ['孕妇或肥胖者：改为胸部冲击（握拳置于胸骨中段）', '婴儿窒息：背部拍击 + 胸部冲击交替（5 次拍背 + 5 次压胸）', '能够剧烈咳嗽的患者：鼓励继续咳嗽，不要干预'],
  },
  fracture: {
    title: '骨折外伤', emoji: '🦴', summary: '不当移动可能造成二次损伤甚至终身残疾',
    steps: [
      { title: '不要移动患者', detail: '除非现场有立即危险（火、塌方等），否则保持原位。' },
      { title: '固定受伤部位', detail: '用夹板（木板、杂志、硬纸板）固定骨折处上下两个关节。' },
      { title: '垫软物缓冲', detail: '在夹板和身体之间用衣物、毛巾垫好，避免压迫。' },
      { title: '悬吊固定（上肢）', detail: '手臂骨折用三角巾或衣物做悬吊，让前臂保持水平。' },
      { title: '冷敷消肿', detail: '用冰袋或冷毛巾敷在伤处周围（不要直接接触皮肤），每次 15-20 分钟。' },
    ],
    warnings: ['疑似脊柱损伤：严禁移动！保持头颈躯干一条直线，等待专业急救', '开放性骨折（骨头穿出皮肤）：不要试图推回，用干净敷料覆盖伤口', '不要给患者进食或饮水（可能需要急诊手术）'],
  },
  transport: {
    title: '伤员搬运', emoji: '🚑', summary: '错误搬运方式可能加重脊髓损伤导致瘫痪',
    steps: [
      { title: '评估现场安全', detail: '确保自身安全后再接近伤员。如有火、毒气等立即危险才移动。' },
      { title: '稳定头颈', detail: '一人专门负责固定头部，双手夹住伤员两侧耳朵，保持头颈躯干在一条直线。' },
      { title: '多人同步翻身', detail: '至少 3-4 人，一人喊口令，所有人同步将伤员整体轴向翻动。' },
      { title: '脊柱板/硬板转移', detail: '将硬板（门板、桌面）紧贴伤员一侧，整体轴向滚动到板上。' },
      { title: '固定躯干四肢', detail: '用绷带将伤员固定在硬板上：额头、胸部、骨盆、大腿、小腿。' },
    ],
    warnings: ['怀疑脊柱损伤时，绝对禁止：扶起、抱起、一人抬头一人抬脚', '搬运途中保持平稳，避免颠簸晃动', '密切观察呼吸和意识变化，随时准备 CPR'],
  },
  psychological: {
    title: '紧急心理干预', emoji: '🧠', summary: '突发创伤后心理应激可导致二次伤害，简单安抚即可起效',
    steps: [
      { title: '确保安全', detail: '带离危险环境，到安静、安全的地方。保证基本生理需求（水、保暖）。' },
      { title: '温和接触', detail: '用平静缓慢的语调说话，自报身份。蹲下与患者保持同一高度。' },
      { title: '倾听不打断', detail: '允许患者表达任何情绪（哭、愤怒、沉默），不要说"别哭"或"坚强点"。' },
      { title: '提供确定信息', detail: '告诉患者：现在发生了什么、谁在帮忙、接下来会怎样。不确定就说不知道。' },
      { title: '转移注意力', detail: '引导做简单动作：深呼吸、握紧再放松拳头、说出周围 3 样看到的东西。' },
    ],
    warnings: ['不要强迫患者回忆创伤细节', '不要做出无法兑现的承诺（如"一切都会好的"）', '如果患者出现严重精神症状（幻觉、暴力），保护自身安全并寻求专业支援'],
  },
  seizure: {
    title: '癫痫急救', emoji: '🧠', summary: '大多数癫痫发作 2-3 分钟内自行停止，关键是保护而非干预',
    steps: [
      { title: '保持冷静计时', detail: '记录发作开始时间。如果持续超过 5 分钟，立即呼叫 120。' },
      { title: '清除周围危险物', detail: '移开尖锐、硬质物品。在头部下方垫软物（衣服、包）。' },
      { title: '不要按住患者', detail: '不要试图压住四肢或阻止抽搐。不要往嘴里塞任何东西。' },
      { title: '侧卧位（恢复后）', detail: '抽搐停止后，将患者转为侧卧位，便于唾液或呕吐物排出。' },
      { title: '守在旁边', detail: '发作结束后患者可能意识模糊，温和安抚，告知发生了什么。' },
    ],
    warnings: ['绝对不要往嘴里塞手指、毛巾、勺子等任何物品', '不要强行喂水喂药', '出现以下情况立即呼叫 120：发作超过 5 分钟、连续发作、水中发作、孕妇、首次发作'],
  },
}

const type = ref('bleeding')
const guide = computed(() => guides[type.value] || guides.bleeding)

// 从页面 query 参数获取类型
const pages = getCurrentPages()
const options = (pages[pages.length - 1] as any).$page?.options
if (options?.type) type.value = options.type

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
}
.guide-appbar {
  display: flex; align-items: center; padding: 28rpx 40rpx; gap: 24rpx;
}
.guide-back { font-size: 48rpx; width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; }
.guide-title { flex: 1; font-family: var(--serif); font-weight: 700; font-size: 36rpx; }
.guide-hero { text-align: center; padding: 32rpx 40rpx 48rpx; }
.guide-icon-wrap {
  width: 160rpx; height: 160rpx; border-radius: 48rpx;
  background: linear-gradient(135deg, #C0392B, #8B2A1F);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 28rpx; box-shadow: 0 24rpx 56rpx rgba(192,57,43,0.35);
}
.guide-emoji { font-size: 80rpx; }
.guide-name { font-family: var(--serif); font-size: 52rpx; font-weight: 900; display: block; margin-bottom: 12rpx; }
.guide-summary { font-size: 26rpx; opacity: 0.7; display: block; line-height: 1.5; }
.guide-steps { padding: 0 40rpx; display: flex; flex-direction: column; gap: 16rpx; }
.guide-step {
  display: flex; gap: 24rpx; padding: 28rpx;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 24rpx; align-items: flex-start;
  &.done { background: rgba(52,210,119,0.08); border-color: rgba(52,210,119,0.25); .guide-step-num { background: var(--green); } }
  &.warn { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.35); .guide-step-num { background: #F59E0B; color: #1A0907; } }
}
.guide-step-num {
  width: 52rpx; height: 52rpx; border-radius: 50%; background: rgba(255,255,255,0.12);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono); font-weight: 700; font-size: 26rpx; flex-shrink: 0; margin-top: 2rpx;
}
.guide-step-body { flex: 1; }
.guide-step-title { font-family: var(--serif); font-size: 28rpx; font-weight: 700; display: block; margin-bottom: 4rpx; }
.guide-step-detail { font-size: 24rpx; opacity: 0.72; line-height: 1.6; display: block; }
.guide-warning {
  margin: 40rpx 40rpx 32rpx; padding: 28rpx 32rpx;
  background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2);
  border-radius: 28rpx; border-left: 6rpx solid #F59E0B;
}
.guide-warning-title { font-family: var(--serif); font-size: 26rpx; font-weight: 700; display: block; margin-bottom: 16rpx; }
.guide-warning-item { font-size: 24rpx; opacity: 0.82; line-height: 1.7; display: block; &::before { content: '• '; color: #F59E0B; } }
.guide-footer { padding: 0 40rpx; text-align: center; }
.guide-call-btn {
  display: inline-flex; align-items: center; gap: 14rpx;
  background: var(--rescue-red); color: #fff; padding: 28rpx 56rpx; border-radius: 40rpx;
  font-family: var(--serif); font-size: 30rpx; font-weight: 700;
  box-shadow: 0 12rpx 36rpx rgba(192,57,43,0.4); margin-bottom: 24rpx;
}
.guide-call-icon { font-size: 36rpx; }
.guide-legal { font-size: 22rpx; opacity: 0.4; font-family: var(--mono); }
</style>
