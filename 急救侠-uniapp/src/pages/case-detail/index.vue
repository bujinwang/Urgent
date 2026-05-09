<template>
  <view class="page-case-detail">
    <view class="case-header">
      <text class="case-tag" :class="current.tagClass">{{ current.tag }}</text>
      <text class="case-title">{{ current.title }}</text>
      <view class="case-meta">
        <text>📅 {{ current.date }}</text>
        <text>📍 {{ current.location }}</text>
        <text>⏱ {{ current.duration }}</text>
      </view>
    </view>
    <view class="case-body">
      <view class="case-result">
        <text class="case-result-icon">{{ current.resultIcon }}</text>
        <text class="case-result-text"><strong>{{ current.resultTitle }}</strong>{{ current.resultText }}</text>
      </view>
      <view class="case-section">
        <text class="case-section-title">事件经过</text>
        <view class="case-timeline">
          <view v-for="(item, i) in current.timeline" :key="i" class="case-timeline-item">
            <view class="case-timeline-dot" :style="i === current.timeline.length - 1 ? { background: 'var(--green)' } : {}" />
            <text class="case-timeline-time">{{ item.time }}</text>
            <text class="case-timeline-text">{{ item.text }}</text>
          </view>
        </view>
      </view>
      <view class="case-section">
        <text class="case-section-title">参与志愿者</text>
        <view class="case-heroes">
          <view v-for="h in current.heroes" :key="h.id" class="case-hero">
            <view class="case-hero-avatar" :style="{ background: h.color }">{{ h.avatar }}</view>
            <text class="case-hero-name">{{ h.name }}</text>
            <text class="case-hero-role">{{ h.role }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface CaseData {
  tag: string; tagClass: string; title: string; date: string; location: string; duration: string
  resultIcon: string; resultTitle: string; resultText: string
  timeline: Array<{ time: string; text: string }>
  heroes: Array<{ id: number; avatar: string; name: string; role: string; color: string }>
}

const parkCase: CaseData = {
  tag: '✓ 成功案例', tagClass: 'success', title: '深圳湾公园 · 心脏骤停紧急救援', date: '2026-05-03', location: '深圳湾公园南门', duration: '救援时长 8分钟',
  resultIcon: '💚', resultTitle: '救援成功！', resultText: '患者已恢复自主心跳，送医后生命体征稳定。',
  timeline: [
    { time: '14:32', text: '患者张先生（45岁）在深圳湾公园慢跑时突然倒地。' },
    { time: '14:32', text: '路人李女士（急救侠SZ-023）5秒内响应，确认无意识无呼吸，启动CPR。' },
    { time: '14:33', text: '系统自动呼叫120，调度3名志愿者携带AED赶赴现场。最近AED仅120米。' },
    { time: '14:35', text: '第1名志愿者到达接替按压。AED到达，分析心律建议电击。' },
    { time: '14:36', text: 'AED电击1次后，患者恢复自主心律。继续CPR维持循环。' },
    { time: '14:40', text: '120到达，患者已恢复意识，生命体征稳定，送往北大深圳医院。' },
  ],
  heroes: [
    { id: 1, avatar: '李', name: '李女士', role: 'SZ-023 · 按压手', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
    { id: 2, avatar: '王', name: '王先生', role: 'SZ-045 · AED手', color: 'linear-gradient(135deg,#1F8A5B,#147547)' },
    { id: 3, avatar: '张', name: '张护士', role: 'SZ-002 · 记录员', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
    { id: 4, avatar: '陈', name: '陈医生', role: 'SZ-001 · 指导', color: 'linear-gradient(135deg,#C8A656,#B8941A)' },
  ],
}

const mallCase: CaseData = {
  tag: '✓ 成功案例', tagClass: 'success', title: '龙岗商场 · 老人晕倒多名志愿者协作', date: '2026-04-28', location: '龙岗万科广场', duration: '救援时长 7分钟',
  resultIcon: '💚', resultTitle: '救援成功！', resultText: 'AED电击一次后老人恢复心跳，送医后情况稳定。',
  timeline: [
    { time: '16:15', text: '72岁陈奶奶在商场3楼突然晕倒，家属大声呼救。' },
    { time: '16:15', text: '商场急救侠赵先生（SZ-007）在附近购物，收到APP推送立即响应。' },
    { time: '16:16', text: '系统同时通知2名附近志愿者，商场AED在1楼服务台旁。' },
    { time: '16:18', text: '赵先生开始CPR，1楼AED被商场保安取到送上3楼。' },
    { time: '16:21', text: 'AED分析建议电击，一次电击后老人恢复自主呼吸。' },
    { time: '16:22', text: '120到达，老人已恢复意识，被送往龙岗中心医院。' },
  ],
  heroes: [
    { id: 1, avatar: '赵', name: '赵先生', role: 'SZ-007 · 按压手', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
    { id: 2, avatar: '刘', name: '刘保安', role: '商场安保 · AED取送', color: 'linear-gradient(135deg,#1F8A5B,#147547)' },
    { id: 3, avatar: '孙', name: '孙女士', role: 'SZ-019 · 记录员', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
  ],
}

const techCase: CaseData = {
  tag: '✓ 成功案例', tagClass: 'success', title: '南山科技园 · 程序员心脏骤停同事施救', date: '2026-04-22', location: '南山科技园', duration: '救援时长 9分钟',
  resultIcon: '💚', resultTitle: '救援成功！', resultText: '同事CPR维持7分钟直到AED到达，患者送医后康复。',
  timeline: [
    { time: '21:40', text: '程序员小刘加班时突然从椅子滑落，同事发现其无意识无呼吸。' },
    { time: '21:40', text: '同事小陈参加过急救侠培训，立即开始CPR并让其他人打120。' },
    { time: '21:42', text: '系统推送附近AED位置，大楼保安取得AED后跑步送上12楼。' },
    { time: '21:47', text: 'AED到达，分析后建议电击，一次电击后患者恢复心跳。' },
    { time: '21:49', text: '120到达接手，患者已恢复自主呼吸，送南山医院进一步治疗。' },
  ],
  heroes: [
    { id: 1, avatar: '陈', name: '小陈', role: '同事 · 按压手', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
    { id: 2, avatar: '黄', name: '黄保安', role: '大楼安保 · AED取送', color: 'linear-gradient(135deg,#1F8A5B,#147547)' },
    { id: 3, avatar: '林', name: '林同事', role: '拨打120 · 引导', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
  ],
}

const caseMap: Record<string, CaseData> = {
  park: parkCase, mall: mallCase, tech: techCase,
}

const current = ref<CaseData>(parkCase)

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as any
  const id = page?.options?.id || 'park'
  if (caseMap[id]) current.value = caseMap[id]
})
</script>

<style lang="scss" scoped>
.case-header { padding: 48rpx 40rpx; background: linear-gradient(165deg, #C0392B 0%, #8B2A1F 100%); color: #fff; border-radius: 0 0 48rpx 48rpx; }
.case-tag { display: inline-flex; gap: 12rpx; background: rgba(255,255,255,0.15); padding: 8rpx 24rpx; border-radius: 32rpx; font-size: 22rpx; font-family: var(--mono); margin-bottom: 24rpx; }
.case-title { font-family: var(--serif); font-size: 48rpx; font-weight: 900; line-height: 1.3; display: block; margin-bottom: 16rpx; }
.case-meta { display: flex; gap: 32rpx; font-size: 24rpx; opacity: 0.8; }
.case-body { padding: 40rpx; }
.case-result { background: var(--green-soft); border: 1px solid rgba(31,138,91,0.3); border-radius: 28rpx; padding: 32rpx; display: flex; gap: 24rpx; align-items: flex-start; margin-bottom: 48rpx; }
.case-result-icon { font-size: 40rpx; }
.case-result-text { font-size: 28rpx; line-height: 1.6; color: var(--green); flex: 1; }
.case-section { margin-bottom: 48rpx; }
.case-section-title { font-family: var(--serif); font-weight: 700; font-size: 32rpx; margin-bottom: 24rpx; display: flex; align-items: center; gap: 16rpx;
  &::before { content: ''; width: 8rpx; height: 32rpx; background: var(--rescue-red); border-radius: 4rpx; flex-shrink: 0; }
}
.case-timeline { position: relative; padding-left: 56rpx; &::before { content: ''; position: absolute; left: 14rpx; top: 16rpx; bottom: 16rpx; width: 4rpx; background: var(--line); } }
.case-timeline-item { position: relative; padding-bottom: 40rpx; &:last-child { padding-bottom: 0; } }
.case-timeline-dot { position: absolute; left: -56rpx; top: 4rpx; width: 32rpx; height: 32rpx; border-radius: 50%; background: var(--rescue-red); border: 6rpx solid #fff; box-shadow: 0 0 0 4rpx var(--rescue-red); }
.case-timeline-time { font-family: var(--mono); font-size: 22rpx; color: var(--ink-mute); margin-bottom: 8rpx; display: block; }
.case-timeline-text { font-size: 28rpx; line-height: 1.6; color: var(--ink-soft); display: block; }
.case-heroes { display: flex; gap: 24rpx; overflow-x: auto; }
.case-hero { flex-shrink: 0; width: 160rpx; text-align: center; }
.case-hero-avatar { width: 112rpx; height: 112rpx; border-radius: 50%; margin: 0 auto 16rpx; display: flex; align-items: center; justify-content: center; font-family: var(--serif); font-weight: 700; font-size: 40rpx; color: #fff; }
.case-hero-name { font-size: 24rpx; font-weight: 600; display: block; margin-bottom: 4rpx; }
.case-hero-role { font-size: 20rpx; color: var(--ink-mute); font-family: var(--mono); display: block; }
</style>
