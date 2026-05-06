<template>
  <view class="page-aed">
    <!-- 引导横幅 -->
    <view class="aed-banner">
      <view class="aed-banner-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>
      </view>
      <view class="aed-banner-body">
        <text class="aed-banner-title">提前知道身边 AED 在哪</text>
        <text class="aed-banner-sub">心脏骤停黄金 4 分钟 · 每秒都重要</text>
      </view>
    </view>

    <!-- 地图（CSS 模拟） -->
    <view class="aed-map">
      <view class="map-pin me" style="left:48%;top:55%;">我</view>
      <view v-for="(a, i) in aedList" :key="a.id" class="map-pin" :style="{ left: pinPositions[i].x + '%', top: pinPositions[i].y + '%' }">{{ i + 1 }}</view>
      <view class="map-stats-left">{{ aedList.length }} 台 · 1km 内</view>
    </view>

    <!-- AED 列表 -->
    <view class="aed-list">
      <view v-for="(a, i) in aedList" :key="a.id" class="aed-card" @click="goContact(a)">
        <text class="aed-card-rank">{{ i + 1 }}</text>
        <view class="aed-card-info">
          <text class="aed-card-name">{{ a.name }}</text>
          <text class="aed-card-addr">{{ a.address }}</text>
          <view class="aed-card-tags">
            <text class="aed-tag aed-tag-ok">{{ a.status === 'available' ? '可用' : '维护中' }}</text>
            <text class="aed-tag aed-tag-distance">{{ a.distance }}m</text>
          </view>
        </view>
        <view class="aed-card-actions">
          <text class="aed-card-btn aed-card-btn-primary" @click.stop="goContact(a)">导航</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getNearbyAeds } from '@/api/aed'

const aedList = ref(getNearbyAeds())
const pinPositions = [
  { x: 30, y: 30 }, { x: 65, y: 35 }, { x: 20, y: 70 }, { x: 75, y: 75 },
]

function goContact(_aed: any) {
  uni.showToast({ title: '责任人联络功能开发中', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.page-aed { padding-bottom: 60rpx; }
.aed-banner {
  margin: 24rpx 40rpx 32rpx;
  background: linear-gradient(135deg, rgba(192,57,43,0.06), rgba(192,57,43,0.02));
  border: 1px solid rgba(192,57,43,0.15);
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
  display: flex; gap: 24rpx; align-items: center;
}
.aed-banner-icon {
  width: 80rpx; height: 80rpx;
  background: var(--rescue-red); border-radius: 24rpx;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.aed-banner-body { flex: 1; }
.aed-banner-title { font-family: var(--serif); font-weight: 700; font-size: 28rpx; display: block; margin-bottom: 4rpx; }
.aed-banner-sub { font-size: 22rpx; color: var(--ink-mute); display: block; }

.aed-map {
  margin: 0 40rpx; height: 480rpx; border-radius: 36rpx; border: 1px solid var(--line);
  background: linear-gradient(135deg, #E8EBE5 0%, #D4DBD3 100%);
  position: relative; overflow: hidden;
  &::before {
    content: '';
    position: absolute; inset: 0;
    background-image: linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px);
    background-size: 80rpx 80rpx;
  }
}
.map-pin {
  position: absolute; width: 56rpx; height: 56rpx;
  background: var(--rescue-red); border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 22rpx; font-weight: 700; font-family: var(--mono);
  box-shadow: 0 8rpx 24rpx rgba(192,57,43,0.4); border: 4rpx solid #fff;
  &.me { background: var(--green); box-shadow: 0 8rpx 24rpx rgba(31,138,91,0.4); }
}
.map-stats-left {
  position: absolute; bottom: 24rpx; left: 24rpx;
  background: rgba(255,255,255,0.95); backdrop-filter: blur(20rpx);
  padding: 16rpx 24rpx; border-radius: 24rpx;
  font-size: 22rpx; color: var(--ink-soft); box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08);
}
.aed-list { padding: 32rpx 40rpx; }
.aed-card {
  display: flex; align-items: stretch; gap: 24rpx;
  padding: 28rpx; background: #fff; border: 1px solid var(--line);
  border-radius: 32rpx; margin-bottom: 20rpx;
}
.aed-card-rank { width: 72rpx; font-family: var(--mono); font-size: 48rpx; font-weight: 700; color: var(--rescue-red); padding-top: 4rpx; }
.aed-card-info { flex: 1; min-width: 0; }
.aed-card-name { font-family: var(--serif); font-size: 30rpx; font-weight: 700; display: block; margin-bottom: 8rpx; }
.aed-card-addr { font-size: 24rpx; color: var(--ink-mute); display: block; margin-bottom: 16rpx; }
.aed-card-tags { display: flex; gap: 12rpx; }
.aed-tag { padding: 4rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; font-family: var(--mono); font-weight: 600; }
.aed-tag-ok { background: var(--green-soft); color: var(--green); }
.aed-tag-distance { background: var(--paper-warm); color: var(--ink-soft); }
.aed-card-actions { display: flex; flex-direction: column; gap: 12rpx; justify-content: center; }
.aed-card-btn { padding: 20rpx 24rpx; border-radius: 20rpx; font-size: 24rpx; color: var(--ink-soft); font-weight: 600; text-align: center; }
.aed-card-btn-primary { background: var(--rescue-red); color: #fff; }
</style>
