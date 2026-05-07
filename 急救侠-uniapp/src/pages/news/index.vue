<template>
  <view class="page-news-feed">
    <!-- 定位提示 -->
    <view class="feed-location-bar">
      <text class="feed-loc-icon">📍</text>
      <text class="feed-loc-text">深圳 · 南山区</text>
      <text class="feed-loc-sub">附近 3 条救援动态</text>
    </view>

    <!-- 分类 Tab -->
    <scroll-view class="feed-tabs" scroll-x :show-scrollbar="false">
      <view
        v-for="cat in store.categories"
        :key="cat.id"
        class="feed-tab"
        :class="{ active: store.activeCategory === cat.id }"
        @click="store.setCategory(cat.id)"
      >{{ cat.label }}</view>
    </scroll-view>

    <!-- 信息流 -->
    <view class="feed-list">
      <!-- 直播救援卡 -->
      <view v-if="liveItem && (store.activeCategory === 'recommend' || store.activeCategory === 'nearby')" class="feed-live-card" @click="goDetail(liveItem.id)">
        <view class="feed-live-pulse" />
        <view class="feed-live-header">
          <view class="feed-live-dot" />
          <text class="feed-live-label">正在救援 · {{ liveItem.liveStats?.duration }}</text>
          <view class="feed-live-badge">直播</view>
        </view>
        <text class="feed-live-title">{{ liveItem.title }}</text>
        <text class="feed-live-excerpt">{{ liveItem.excerpt }}</text>
        <view class="feed-live-map-preview">
          <view class="feed-live-map-grid" />
          <view class="feed-live-map-pin user">你</view>
          <view class="feed-live-map-pin sos">SOS</view>
        </view>
        <view class="feed-live-stats">
          <text>👥 {{ liveItem.liveStats?.volunteers }} 人响应</text>
          <text>📍 {{ liveItem.location.name }}</text>
        </view>
      </view>

      <!-- 普通卡片循环 -->
      <view
        v-for="item in displayItems"
        :key="item.id"
        class="feed-card"
        @click="goDetail(item.id)"
      >
        <!-- 视频卡 -->
        <template v-if="item.type === 'video'">
          <view class="feed-video-cover">
            <image :src="item.coverImage" mode="aspectFill" class="feed-video-img" />
            <view class="feed-video-play">
              <text class="feed-video-play-icon">▶</text>
            </view>
            <view class="feed-video-duration">{{ item.videoDuration }}</view>
          </view>
          <view class="feed-card-body">
            <text class="feed-card-title">{{ item.title }}</text>
            <text class="feed-card-excerpt">{{ item.excerpt }}</text>
            <view class="feed-card-footer">
              <view class="feed-card-author" v-if="item.author">
                <view class="feed-author-avatar" :class="{ volunteer: item.author.isVolunteer }">{{ item.author.avatar }}</view>
                <text>{{ item.author.name }}</text>
                <text v-if="item.author.badge" class="feed-author-badge">{{ item.author.badge }}</text>
              </view>
              <view class="feed-card-stats">
                <text>▶ {{ formatCount(item.stats.views) }}</text>
                <text>❤ {{ formatCount(item.stats.likes) }}</text>
              </view>
            </view>
          </view>
        </template>

        <!-- 图集卡 -->
        <template v-else-if="item.type === 'photo'">
          <scroll-view class="feed-photo-scroll" scroll-x :show-scrollbar="false">
            <image
              v-for="(p, i) in item.photos"
              :key="i"
              :src="p"
              mode="aspectFill"
              class="feed-photo-item"
            />
          </scroll-view>
          <view class="feed-photo-count">{{ item.photos?.length }} 图</view>
          <view class="feed-card-body">
            <text class="feed-card-title">{{ item.title }}</text>
            <text class="feed-card-excerpt">{{ item.excerpt }}</text>
            <view class="feed-card-footer">
              <view class="feed-card-author" v-if="item.author">
                <view class="feed-author-avatar" :class="{ volunteer: item.author.isVolunteer }">{{ item.author.avatar }}</view>
                <text>{{ item.author.name }}</text>
                <text v-if="item.author.badge" class="feed-author-badge">{{ item.author.badge }}</text>
              </view>
              <view class="feed-card-stats">
                <text>👁 {{ formatCount(item.stats.views) }}</text>
                <text>❤ {{ formatCount(item.stats.likes) }}</text>
              </view>
            </view>
          </view>
        </template>

        <!-- 地图卡 -->
        <template v-else-if="item.type === 'map'">
          <view class="feed-map-mini">
            <view class="feed-map-grid" />
            <view
              v-for="(m, i) in item.mapMarkers"
              :key="i"
              class="feed-map-marker"
              :style="{ left: (30 + i * 25) + '%', top: (20 + i * 20) + '%' }"
            >
              <view class="feed-map-marker-dot" />
              <text class="feed-map-marker-label">{{ m.label }}</text>
            </view>
          </view>
          <view class="feed-card-body">
            <text class="feed-card-title">{{ item.title }}</text>
            <text class="feed-card-excerpt">{{ item.excerpt }}</text>
            <view class="feed-card-footer">
              <view class="feed-card-author" v-if="item.author">
                <view class="feed-author-avatar">{{ item.author.avatar }}</view>
                <text>{{ item.author.name }}</text>
              </view>
              <view class="feed-card-stats">
                <text>👁 {{ formatCount(item.stats.views) }}</text>
              </view>
            </view>
          </view>
        </template>

        <!-- 志愿者故事卡 -->
        <template v-else-if="item.type === 'story'">
          <view class="feed-story-hero">
            <image :src="item.coverImage" mode="aspectFill" class="feed-story-img" />
            <view class="feed-story-overlay">
              <view class="feed-story-avatar">{{ item.author?.avatar }}</view>
              <text class="feed-story-name">{{ item.author?.name }}</text>
              <text class="feed-story-badge">{{ item.author?.badge }} · {{ item.author?.rescueCount }} 次救援</text>
            </view>
          </view>
          <view class="feed-card-body">
            <text class="feed-card-title">{{ item.title }}</text>
            <text class="feed-card-excerpt">{{ item.excerpt }}</text>
            <view class="feed-card-footer">
              <view class="feed-card-stats">
                <text>👁 {{ formatCount(item.stats.views) }}</text>
                <text>❤ {{ formatCount(item.stats.likes) }}</text>
                <text>💬 {{ formatCount(item.stats.comments) }}</text>
              </view>
            </view>
          </view>
        </template>

        <!-- 文章卡 (默认) -->
        <template v-else>
          <image v-if="item.coverImage" :src="item.coverImage" mode="aspectFill" class="feed-article-cover" />
          <view class="feed-card-body">
            <text class="feed-card-title">{{ item.title }}</text>
            <text class="feed-card-excerpt">{{ item.excerpt }}</text>
            <view class="feed-card-footer">
              <view class="feed-card-author" v-if="item.author">
                <view class="feed-author-avatar" :class="{ volunteer: item.author.isVolunteer }">{{ item.author.avatar }}</view>
                <text>{{ item.author.name }}</text>
              </view>
              <view class="feed-card-stats">
                <text>👁 {{ formatCount(item.stats.views) }}</text>
                <text>❤ {{ formatCount(item.stats.likes) }}</text>
              </view>
            </view>
          </view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNewsStore } from '@/stores/news'
import type { NewsItem } from '@/api/news'

const store = useNewsStore()

const liveItem = computed(() =>
  store.items.find((n) => n.type === 'live' && n.isLive)
)

const displayItems = computed(() =>
  store.filteredItems.filter((n) => n.type !== 'live')
)

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/news/detail?id=${id}` })
}

function formatCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
</script>

<style lang="scss" scoped>
.page-news-feed {
  background: #F5F5F5;
  min-height: 100vh;
  padding-bottom: 60rpx;
}

/* 定位栏 */
.feed-location-bar {
  display: flex;
  align-items: baseline;
  gap: 10rpx;
  padding: 20rpx 32rpx 16rpx;
}
.feed-loc-icon { font-size: 24rpx; }
.feed-loc-text { font-size: 28rpx; font-weight: 700; color: var(--ink); }
.feed-loc-sub { font-size: 22rpx; color: var(--ink-mute); margin-left: auto; }

/* Tab */
.feed-tabs {
  white-space: nowrap;
  padding: 8rpx 32rpx 20rpx;
}
.feed-tab {
  display: inline-block;
  padding: 14rpx 32rpx;
  margin-right: 16rpx;
  border-radius: 40rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--ink-mute);
  background: #fff;
  border: 1px solid #E8E8E8;
  &.active { background: var(--rescue-red); color: #fff; border-color: var(--rescue-red); }
}

/* === 直播救援卡 === */
.feed-live-card {
  margin: 0 32rpx 24rpx;
  padding: 32rpx;
  background: linear-gradient(135deg, #C0392B, #8B2A1F);
  border-radius: 32rpx;
  color: #fff;
  position: relative;
  overflow: hidden;
  border: 2px solid rgba(255, 107, 91, 0.5);
}
.feed-live-pulse {
  position: absolute;
  inset: -4rpx;
  border-radius: 36rpx;
  border: 2px solid rgba(255, 107, 91, 0.4);
  animation: livePulse 1.5s ease-in-out infinite;
}
.feed-live-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.feed-live-dot {
  width: 16rpx; height: 16rpx; border-radius: 50%; background: #FF6B5B;
  animation: blink 0.8s infinite;
}
.feed-live-label { font-family: var(--mono); font-size: 22rpx; letter-spacing: 2rpx; }
.feed-live-badge {
  margin-left: auto;
  padding: 6rpx 18rpx;
  background: rgba(255,255,255,0.25);
  border-radius: 20rpx;
  font-size: 20rpx;
  font-family: var(--mono);
  font-weight: 700;
}
.feed-live-title { font-family: var(--serif); font-size: 34rpx; font-weight: 900; display: block; margin-bottom: 12rpx; }
.feed-live-excerpt { font-size: 24rpx; opacity: 0.85; line-height: 1.6; display: block; margin-bottom: 20rpx; }

.feed-live-map-preview {
  height: 200rpx;
  background: rgba(0,0,0,0.3);
  border-radius: 20rpx;
  position: relative;
  overflow: hidden;
  margin-bottom: 20rpx;
}
.feed-live-map-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
  background-size: 40rpx 40rpx;
}
.feed-live-map-pin {
  position: absolute;
  width: 48rpx; height: 48rpx; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18rpx; font-weight: 700; border: 3rpx solid #fff;
  &.user { left: 48%; top: 55%; background: #4A90E2; }
  &.sos { right: 15%; top: 40%; background: #FF6B5B; animation: pulse 1.4s infinite; }
}
.feed-live-stats {
  display: flex; gap: 32rpx; font-size: 22rpx; opacity: 0.85;
}

/* === 通用信息流卡片 === */
.feed-list {
  padding: 0 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.feed-card {
  background: #fff;
  border-radius: 28rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.04);
}

/* 视频卡 */
.feed-video-cover {
  position: relative;
  height: 380rpx;
}
.feed-video-img { width: 100%; height: 100%; }
.feed-video-play {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.2);
}
.feed-video-play-icon {
  width: 88rpx; height: 88rpx; border-radius: 50%;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(8rpx);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 36rpx;
}
.feed-video-duration {
  position: absolute; bottom: 16rpx; right: 16rpx;
  padding: 4rpx 16rpx; background: rgba(0,0,0,0.6);
  border-radius: 12rpx; font-size: 20rpx; color: #fff; font-family: var(--mono);
}

/* 图集卡 */
.feed-photo-scroll {
  white-space: nowrap;
  height: 340rpx;
}
.feed-photo-item {
  display: inline-block;
  width: 260rpx; height: 340rpx;
  border-radius: 0;
  margin-right: 6rpx;
}
.feed-photo-item:first-child { width: 340rpx; }
.feed-photo-count {
  position: absolute; top: 20rpx; right: 20rpx;
  padding: 6rpx 18rpx; background: rgba(0,0,0,0.5);
  border-radius: 20rpx; font-size: 20rpx; color: #fff; font-family: var(--mono);
}

.feed-card { position: relative; }
.feed-photo-scroll + .feed-photo-count {
  position: absolute; top: 20rpx; right: 20rpx;
}

/* 地图卡 */
.feed-map-mini {
  height: 240rpx;
  background: linear-gradient(135deg, #E8F5EF, #D4EDE0);
  position: relative;
  overflow: hidden;
}
.feed-map-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px);
  background-size: 40rpx 40rpx;
}
.feed-map-marker {
  position: absolute;
  display: flex; flex-direction: column; align-items: center; gap: 4rpx;
}
.feed-map-marker-dot {
  width: 24rpx; height: 24rpx; border-radius: 50%;
  background: var(--rescue-red); border: 2px solid #fff;
  box-shadow: 0 4rpx 12rpx rgba(192,57,43,0.4);
}
.feed-map-marker-label {
  font-size: 18rpx; color: var(--ink-soft); font-weight: 600;
}

/* 志愿者故事卡 */
.feed-story-hero {
  position: relative;
  height: 320rpx;
}
.feed-story-img { width: 100%; height: 100%; }
.feed-story-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.7) 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
  padding-bottom: 28rpx; gap: 8rpx;
}
.feed-story-avatar {
  width: 80rpx; height: 80rpx; border-radius: 50%;
  background: linear-gradient(135deg, var(--rescue-red), var(--rescue-red-deep));
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 32rpx; font-weight: 700; border: 3rpx solid #fff;
}
.feed-story-name { font-size: 28rpx; font-weight: 700; color: #fff; }
.feed-story-badge { font-size: 20rpx; color: #F59E0B; font-family: var(--mono); }

/* 文章卡 */
.feed-article-cover {
  width: 100%; height: 340rpx;
}

/* 卡片内容区 */
.feed-card-body {
  padding: 28rpx 32rpx;
}
.feed-card-title {
  font-family: var(--serif);
  font-size: 32rpx;
  font-weight: 700;
  line-height: 1.4;
  margin-bottom: 12rpx;
  display: block;
  color: var(--ink);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.feed-card-excerpt {
  font-size: 24rpx;
  color: var(--ink-mute);
  line-height: 1.6;
  margin-bottom: 20rpx;
  display: block;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.feed-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.feed-card-author {
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 22rpx;
  color: var(--ink-mute);
}
.feed-author-avatar {
  width: 44rpx; height: 44rpx; border-radius: 50%;
  background: var(--paper-warm);
  display: flex; align-items: center; justify-content: center;
  font-size: 20rpx; font-weight: 700; color: var(--ink-soft);
  &.volunteer { background: linear-gradient(135deg, var(--rescue-red), var(--rescue-red-deep)); color: #fff; }
}
.feed-author-badge {
  padding: 2rpx 12rpx; border-radius: 10rpx;
  font-size: 18rpx; font-family: var(--mono); font-weight: 700;
  background: rgba(200, 166, 86, 0.15); color: var(--gold);
}
.feed-card-stats {
  display: flex; gap: 20rpx; font-size: 22rpx; color: var(--ink-mute);
}

/* 动画 */
@keyframes livePulse {
  0% { opacity: 0.8; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.02); }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 107, 91, 0.6); }
  50% { box-shadow: 0 0 0 20rpx rgba(255, 107, 91, 0); }
}
</style>
