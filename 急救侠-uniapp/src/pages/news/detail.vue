<template>
  <view class="page-news-detail">
    <!-- 顶栏 -->
    <view class="detail-topbar">
      <view class="detail-back" @click="goBack">‹</view>
      <text class="detail-topbar-title">{{ item.type === 'video' ? '视频' : item.type === 'photo' ? '图集' : '资讯' }}</text>
    </view>

    <!-- 视频播放区 -->
    <view v-if="item.type === 'video'" class="detail-video-area">
      <image :src="item.coverImage" mode="aspectFill" class="detail-video-bg" />
      <view class="detail-video-overlay">
        <view class="detail-video-play-btn">
          <text>▶</text>
        </view>
        <text class="detail-video-duration">{{ item.videoDuration }}</text>
      </view>
    </view>

    <!-- 图集浏览区 -->
    <swiper v-if="item.type === 'photo' && item.photos" class="detail-photo-swiper" indicator-dots>
      <swiper-item v-for="(p, i) in item.photos" :key="i">
        <image :src="p" mode="aspectFill" class="detail-photo-full" />
      </swiper-item>
    </swiper>

    <!-- 地图区 -->
    <view v-if="item.type === 'map'" class="detail-map-area">
      <view class="detail-map-grid" />
      <view v-for="(m, i) in item.mapMarkers" :key="i"
        class="detail-map-pin"
        :style="{ left: (25 + i * 22) + '%', top: (25 + i * 18) + '%' }"
      >
        <view class="detail-map-pin-dot" />
        <text>{{ m.label }}</text>
      </view>
    </view>

    <!-- 文章内容 -->
    <view class="detail-body">
      <!-- 志愿者故事头 -->
      <view v-if="item.type === 'story' && item.author" class="detail-story-header">
        <image :src="item.coverImage" mode="aspectFill" class="detail-story-cover" />
        <view class="detail-story-avatar-wrap">
          <view class="detail-story-avatar-lg">{{ item.author.avatar }}</view>
          <text class="detail-story-name-lg">{{ item.author.name }}</text>
          <text class="detail-story-badge-lg">{{ item.author.badge }} · {{ item.author.rescueCount }} 次救援</text>
        </view>
      </view>

      <text class="detail-title">{{ item.title }}</text>

      <!-- 作者行 -->
      <view class="detail-author-row">
        <view class="detail-author-left" v-if="item.author">
          <view class="detail-author-avatar" :class="{ volunteer: item.author.isVolunteer }">{{ item.author.avatar }}</view>
          <view>
            <text class="detail-author-name">{{ item.author.name }}</text>
            <text class="detail-author-badge-sm" v-if="item.author.badge">{{ item.author.badge }}志愿者</text>
          </view>
        </view>
        <text class="detail-time">{{ item.time }}</text>
      </view>

      <!-- 标签 -->
      <view class="detail-tags">
        <text v-for="t in item.tags" :key="t" class="detail-tag">#{{ t }}</text>
      </view>

      <!-- 正文 -->
      <text class="detail-content">{{ item.excerpt }}</text>
      <text v-if="item.body" class="detail-content-full">{{ item.body }}</text>
      <text v-else class="detail-content-full">这是一篇关于急救救援的新闻报道。{{ item.excerpt }} 标签：{{ item.tags.join('、') }}。更多详情请关注急救侠后续报道。</text>

      <!-- 救援案例入口：当新闻关联了救援案例时显示 -->
      <view v-if="item.caseId && item.tags.includes('成功案例')" class="detail-case-entry" @click="goCaseDetail">
        <view class="detail-case-entry-left">
          <text class="detail-case-entry-icon">📋</text>
          <view>
            <text class="detail-case-entry-title">查看救援详情</text>
            <text class="detail-case-entry-sub">完整时间线 · 参与者信息</text>
          </view>
        </view>
        <text class="detail-case-entry-arrow">→</text>
      </view>

      <!-- 位置卡 -->
      <view class="detail-location-card">
        <text class="detail-loc-icon">📍</text>
        <view>
          <text class="detail-loc-name">{{ item.location.name }}</text>
          <text class="detail-loc-sub" v-if="item.location.distance">距您 {{ item.location.distance }} km</text>
        </view>
        <text class="detail-loc-arrow">→</text>
      </view>

      <!-- 互动栏 -->
      <view class="detail-actions">
        <view class="detail-action">
          <text>❤ {{ formatCount(item.stats.likes) }}</text>
        </view>
        <view class="detail-action">
          <text>💬 {{ formatCount(item.stats.comments) }}</text>
        </view>
        <view class="detail-action" v-if="item.stats.shares">
          <text>↗ {{ formatCount(item.stats.shares) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getNewsById } from '@/api/news'
import type { NewsItem } from '@/api/news'

const item = ref<NewsItem>({} as NewsItem)

onMounted(() => {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as any
  const id = page?.options?.id
  if (id) {
    const found = getNewsById(id)
    if (found) item.value = found
  }
})

function goBack() { uni.navigateBack() }
function goCaseDetail() {
  if (item.value.caseId) {
    uni.navigateTo({ url: `/pages/case-detail/index?id=${item.value.caseId}` })
  }
}
function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
</script>

<style lang="scss" scoped>
.page-news-detail {
  background: #fff;
  min-height: 100vh;
}

/* 顶栏 */
.detail-topbar {
  display: flex;
  align-items: center;
  padding: 24rpx 32rpx;
  gap: 20rpx;
}
.detail-back {
  font-size: 48rpx;
  width: 72rpx; height: 72rpx;
  display: flex; align-items: center; justify-content: center;
  color: var(--ink);
}
.detail-topbar-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--ink-mute);
}

/* 视频区 */
.detail-video-area {
  height: 500rpx;
  position: relative;
}
.detail-video-bg { width: 100%; height: 100%; }
.detail-video-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.3);
  gap: 16rpx;
}
.detail-video-play-btn {
  width: 100rpx; height: 100rpx; border-radius: 50%;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8rpx);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 40rpx;
}
.detail-video-duration {
  padding: 6rpx 18rpx; background: rgba(0,0,0,0.5);
  border-radius: 12rpx; color: #fff; font-size: 22rpx; font-family: var(--mono);
}

/* 图集 */
.detail-photo-swiper {
  height: 600rpx;
}
.detail-photo-full { width: 100%; height: 100%; }

/* 地图 */
.detail-map-area {
  height: 400rpx;
  background: linear-gradient(135deg, #E8F5EF, #C8E6D0);
  position: relative;
  overflow: hidden;
}
.detail-map-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
  background-size: 50rpx 50rpx;
}
.detail-map-pin {
  position: absolute;
  display: flex; flex-direction: column; align-items: center; gap: 6rpx;
  font-size: 20rpx; font-weight: 600; color: var(--ink);
}
.detail-map-pin-dot {
  width: 32rpx; height: 32rpx; border-radius: 50%;
  background: var(--rescue-red);
  border: 3px solid #fff;
  box-shadow: 0 6rpx 18rpx rgba(192,57,43,0.3);
}

/* 正文 */
.detail-body {
  padding: 32rpx 32rpx 60rpx;
}
.detail-story-header {
  margin: -32rpx -32rpx 32rpx;
  position: relative;
}
.detail-story-cover {
  width: 100%; height: 400rpx;
}
.detail-story-avatar-wrap {
  margin-top: -60rpx;
  position: relative;
  z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 8rpx;
}
.detail-story-avatar-lg {
  width: 96rpx; height: 96rpx; border-radius: 50%;
  background: linear-gradient(135deg, var(--rescue-red), var(--rescue-red-deep));
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 36rpx; font-weight: 700; border: 4rpx solid #fff;
}
.detail-story-name-lg { font-size: 32rpx; font-weight: 700; }
.detail-story-badge-lg { font-size: 22rpx; color: var(--gold); font-family: var(--mono); }

.detail-title {
  font-family: var(--serif);
  font-size: 40rpx;
  font-weight: 900;
  line-height: 1.35;
  display: block;
  margin-bottom: 24rpx;
  color: var(--ink);
}
.detail-author-row {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 28rpx; border-bottom: 1px solid #F0F0F0; margin-bottom: 24rpx;
}
.detail-author-left {
  display: flex; align-items: center; gap: 14rpx;
}
.detail-author-avatar {
  width: 56rpx; height: 56rpx; border-radius: 50%;
  background: var(--paper-warm); display: flex; align-items: center; justify-content: center;
  font-size: 24rpx; font-weight: 700;
  &.volunteer { background: linear-gradient(135deg, var(--rescue-red), var(--rescue-red-deep)); color: #fff; }
}
.detail-author-name { font-size: 24rpx; font-weight: 600; display: block; }
.detail-author-badge-sm { font-size: 20rpx; color: var(--gold); font-family: var(--mono); }
.detail-time { font-size: 22rpx; color: var(--ink-mute); }
.detail-tags { display: flex; gap: 14rpx; margin-bottom: 28rpx; flex-wrap: wrap; }
.detail-tag { font-size: 22rpx; color: #4A90E2; }
.detail-content {
  font-size: 28rpx; line-height: 1.85; color: var(--ink-soft); display: block; margin-bottom: 28rpx;
}
.detail-content-full {
  font-size: 28rpx; line-height: 1.85; color: var(--ink-mute); display: block; margin-bottom: 32rpx;
}

/* 救援案例入口 */
.detail-case-entry {
  display: flex; align-items: center; justify-content: space-between;
  padding: 28rpx 32rpx; margin-bottom: 28rpx;
  background: linear-gradient(135deg, rgba(192,57,43,0.06), rgba(139,42,31,0.03));
  border: 1.5px solid rgba(192,57,43,0.2);
  border-radius: 24rpx;
}
.detail-case-entry-left { display: flex; align-items: center; gap: 16rpx; }
.detail-case-entry-icon { font-size: 40rpx; }
.detail-case-entry-title { display: block; font-size: 26rpx; font-weight: 700; color: var(--rescue-red); }
.detail-case-entry-sub { display: block; font-size: 22rpx; color: var(--ink-mute); margin-top: 2rpx; }
.detail-case-entry-arrow { font-size: 28rpx; color: var(--rescue-red); font-weight: 700; }

.detail-location-card {
  display: flex; align-items: center; gap: 16rpx;
  padding: 28rpx; background: #F8F8F8; border-radius: 20rpx; margin-bottom: 32rpx;
}
.detail-loc-icon { font-size: 32rpx; }
.detail-loc-name { font-size: 26rpx; font-weight: 600; display: block; }
.detail-loc-sub { font-size: 22rpx; color: var(--ink-mute); }
.detail-loc-arrow { margin-left: auto; font-size: 28rpx; color: var(--ink-mute); }
.detail-actions {
  display: flex; gap: 48rpx; justify-content: center;
  padding: 28rpx 0; border-top: 1px solid #F0F0F0;
}
.detail-action {
  font-size: 28rpx; color: var(--ink-soft);
}
</style>
