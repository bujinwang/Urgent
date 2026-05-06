<template>
  <view class="page-news">
    <view class="news-tabs">
      <view v-for="t in tabs" :key="t.id" class="news-tab" :class="{ active: activeTab === t.id }" @click="activeTab = t.id">{{ t.label }}</view>
    </view>
    <view class="news-list">
      <view v-for="item in filteredNews" :key="item.id" class="news-card" :class="{ featured: item.featured }" @click="goDetail(item.id)">
        <text class="news-card-tag" :class="item.tagClass">{{ item.tag }}</text>
        <text class="news-card-title">{{ item.title }}</text>
        <text class="news-excerpt">{{ item.excerpt }}</text>
        <view class="news-meta">
          <text>{{ item.location }}</text>
          <text>{{ item.time }}</text>
        </view>
        <view v-if="item.stats" class="news-stats">
          <text v-for="s in item.stats" :key="s" class="news-stat">{{ s }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const tabs = [
  { id: 'all', label: '全部' }, { id: 'live', label: '进行中' },
  { id: 'case', label: '成功案例' }, { id: 'news', label: '新闻资讯' },
]
const activeTab = ref('all')

interface NewsItem {
  id: number
  tag: string
  tagClass: string
  title: string
  excerpt: string
  location: string
  time: string
  featured?: boolean
  stats?: string[]
  category: string
}

const newsItems: NewsItem[] = [
  { id: 1, tag: '● 正在救援', tagClass: 'live', title: '深圳湾公园 · 心脏骤停紧急救援', excerpt: '3名志愿者已响应，AED已就位，持续CPR中…', location: '📍 深圳湾公园南门', time: '🕐 2分钟前', featured: true, stats: ['👥 3人响应', '⏱ 已持续 6分钟', '💚 状态稳定'], category: 'live' },
  { id: 2, tag: '资讯', tagClass: 'news', title: '深圳120与急救侠联动，救援响应时间缩短40%', excerpt: '自急救侠网络上线以来，深圳市院外心脏骤停平均救援响应时间从8.2分钟缩短至4.9分钟...', location: '📅 2026-05-02', time: '👁 2,340阅读', category: 'news' },
  { id: 3, tag: '成功案例', tagClass: 'case', title: '福田CBD · 午休时刻的生死救援', excerpt: '白领李先生用餐时突然倒地，同楼急救侠王女士5秒内响应，成功挽回生命...', location: '📅 2026-05-01', time: '👁 1,892阅读', category: 'case' },
  { id: 4, tag: '成功案例', tagClass: 'case', title: '龙岗商场 · 老人晕倒，多名志愿者协作救援', excerpt: '72岁老人逛商场时突然晕倒，3名急救侠同时响应，AED电击后恢复心跳...', location: '📅 2026-04-28', time: '👁 3,451阅读', category: 'case' },
  { id: 5, tag: '资讯', tagClass: 'news', title: '急救侠获深圳市卫健委官方推荐', excerpt: '深圳市卫健委发文推荐急救侠网络，鼓励市民参与急救培训...', location: '📅 2026-04-25', time: '👁 5,678阅读', category: 'news' },
  { id: 6, tag: '成功案例', tagClass: 'case', title: '南山科技园 · 程序员心脏骤停，同事成功施救', excerpt: '加班期间突发心脏骤停，同组同事立即启动急救流程...', location: '📅 2026-04-22', time: '👁 2,156阅读', category: 'case' },
]

const filteredNews = computed(() => {
  if (activeTab.value === 'all') return newsItems
  return newsItems.filter(n => n.category === activeTab.value)
})

function goDetail(_id: number) {
  uni.navigateTo({ url: '/pages/case-detail/index' })
}
</script>

<style lang="scss" scoped>
.page-news { padding-bottom: 60rpx; }
.news-tabs { display: flex; gap: 16rpx; padding: 32rpx 40rpx 24rpx; }
.news-tab { padding: 16rpx 32rpx; border-radius: 40rpx; font-size: 26rpx; font-weight: 600; border: 1px solid var(--line); color: var(--ink-mute); background: #fff; &.active { background: var(--rescue-red); color: #fff; border-color: var(--rescue-red); } }
.news-list { padding: 0 40rpx; display: flex; flex-direction: column; gap: 24rpx; }
.news-card { background: #fff; border: 1px solid var(--line); border-radius: 36rpx; padding: 36rpx; width: 100%;
  &.featured { background: linear-gradient(135deg, #C0392B 0%, #8B2A1F 100%); color: #fff; border-color: var(--rescue-red);
    .news-excerpt, .news-meta { color: rgba(255,255,255,0.85); }
    .news-stats { border-top-color: rgba(255,255,255,0.2); }
  }
}
.news-card-tag { display: inline-block; padding: 6rpx 20rpx; border-radius: 20rpx; font-size: 20rpx; font-family: var(--mono); font-weight: 600; letter-spacing: 1rpx; margin-bottom: 20rpx;
  &.live { background: rgba(192,57,43,0.1); color: var(--rescue-red); border: 1px solid rgba(192,57,43,0.3); }
  &.case { background: rgba(31,138,91,0.1); color: var(--green); border: 1px solid rgba(31,138,91,0.3); }
  &.news { background: rgba(74,144,226,0.1); color: var(--diamond); border: 1px solid rgba(74,144,226,0.3); }
}
.news-card.featured .news-card-tag { background: rgba(255,255,255,0.2); color: #fff; border-color: rgba(255,255,255,0.3); }
.news-card-title { font-family: var(--serif); font-size: 32rpx; font-weight: 700; line-height: 1.4; margin-bottom: 16rpx; display: block; }
.news-excerpt { font-size: 26rpx; color: var(--ink-mute); line-height: 1.6; margin-bottom: 24rpx; display: block; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.news-meta { display: flex; align-items: center; gap: 24rpx; font-size: 22rpx; color: var(--ink-mute); font-family: var(--mono); }
.news-stats { display: flex; gap: 32rpx; padding: 24rpx 0 0; border-top: 1px solid var(--line); margin-top: 24rpx; }
.news-stat { font-size: 22rpx; }
</style>
