<template>
  <view class="page-case-detail">
    <view class="case-header">
      <text class="case-tag">✓ 成功案例</text>
      <text class="case-title">深圳湾公园 · 心脏骤停紧急救援</text>
      <view class="case-meta">
        <text>📅 2026-05-03</text>
        <text>📍 深圳湾公园南门</text>
        <text>⏱ 救援时长 8分钟</text>
      </view>
    </view>
    <view class="case-body">
      <view class="case-result">
        <text class="case-result-icon">💚</text>
        <text class="case-result-text"><strong>救援成功！</strong>患者已恢复自主心跳，送医后生命体征稳定。</text>
      </view>
      <view class="case-section">
        <text class="case-section-title">事件经过</text>
        <view class="case-timeline">
          <view v-for="(item, i) in timeline" :key="i" class="case-timeline-item">
            <view class="case-timeline-dot" :style="i === timeline.length - 1 ? { background: 'var(--green)' } : {}" />
            <text class="case-timeline-time">{{ item.time }}</text>
            <text class="case-timeline-text">{{ item.text }}</text>
          </view>
        </view>
      </view>
      <view class="case-section">
        <text class="case-section-title">参与志愿者</text>
        <view class="case-heroes">
          <view v-for="h in heroes" :key="h.id" class="case-hero">
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
const timeline = [
  { time: '14:32', text: '患者张先生（45岁）在深圳湾公园慢跑时突然倒地。' },
  { time: '14:32', text: '路人李女士（急救侠SZ-023）5秒内响应，确认无意识无呼吸，启动CPR。' },
  { time: '14:33', text: '系统自动呼叫120，调度3名志愿者携带AED赶赴现场。最近AED仅120米。' },
  { time: '14:35', text: '第1名志愿者到达接替按压。AED到达，分析心律建议电击。' },
  { time: '14:36', text: 'AED电击1次后，患者恢复自主心律。继续CPR维持循环。' },
  { time: '14:40', text: '120到达，患者已恢复意识，生命体征稳定，送往北大深圳医院。' },
]
const heroes = [
  { id: 1, avatar: '李', name: '李女士', role: 'SZ-023 · 按压手', color: 'linear-gradient(135deg,#C0392B,#8B2A1F)' },
  { id: 2, avatar: '王', name: '王先生', role: 'SZ-045 · AED手', color: 'linear-gradient(135deg,#1F8A5B,#147547)' },
  { id: 3, avatar: '张', name: '张护士', role: 'SZ-002 · 记录员', color: 'linear-gradient(135deg,#4A90E2,#2563EB)' },
  { id: 4, avatar: '陈', name: '陈医生', role: 'SZ-001 · 指导', color: 'linear-gradient(135deg,#C8A656,#B8941A)' },
]
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
