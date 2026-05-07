<template>
  <view class="page-aed-go">
    <!-- 演习横幅 -->
    <view class="aed-drill-banner">
      <text class="aed-drill-icon">⚠️</text>
      <text class="aed-drill-text">演习模式 · 探索 AED 随时可取</text>
    </view>

    <!-- 顶部探索状态 -->
    <view class="aed-header">
      <view class="aed-header-top">
        <view class="aed-explorer-badge">
          <text class="aed-explorer-icon">🗺️</text>
          <view>
            <text class="aed-explorer-name">{{ user.profile.name }}</text>
            <text class="aed-explorer-tier">{{ user.tierLabel }} 探索者</text>
          </view>
        </view>
        <view class="aed-points-pill">
          <text class="aed-points-star">⭐</text>
          <text class="aed-points-value">{{ user.profile.points.toLocaleString() }}</text>
        </view>
      </view>

      <!-- 探索进度条 -->
      <view class="aed-progress-wrap">
        <view class="aed-progress-bar">
          <view class="aed-progress-fill" :style="{ width: aedStore.discoveryProgress + '%' }" />
          <view class="aed-progress-glow" :style="{ left: aedStore.discoveryProgress + '%' }" />
        </view>
        <text class="aed-progress-text">{{ aedStore.discoveredCount }} / {{ aedStore.totalCount }} 台已发现</text>
      </view>
    </view>

    <!-- 地图区域 -->
    <view class="aed-map-area">
      <!-- 草地质感地图 -->
      <view class="aed-map-grass">
        <view class="aed-map-grid" />
        <view class="aed-map-user-pin">
          <view class="aed-map-user-avatar">{{ user.profile.avatar }}</view>
          <view class="aed-map-user-pulse" />
        </view>
        <!-- AED Pins -->
        <view
          v-for="aed in aedStore.nearbyAeds"
          :key="aed.id"
          class="aed-map-pokestop"
          :class="{ discovered: aed.discovered, verified: aed.verified, maintenance: aed.status === 'maintenance' }"
          :style="aedPinStyle(aed)"
          @click="showAedDetail(aed)"
        >
          <view class="aed-pin-icon">{{ aed.status === 'maintenance' ? '🔧' : aed.verified ? '⚡' : aed.discovered ? '📍' : '❓' }}</view>
          <view class="aed-pin-ring" />
          <view class="aed-pin-ring-2" />
          <view class="aed-pin-label">{{ aed.distance }}m</view>
        </view>
      </view>

      <!-- 浮动统计 -->
      <view class="aed-map-overlay">
        <view class="aed-radar-label">
          <view class="aed-radar-dot" />
          <text>{{ aedStore.nearbyAeds.length }} 台 AED 在附近</text>
        </view>
      </view>
    </view>

    <!-- 附近雷达 -->
    <view class="aed-radar-section">
      <text class="aed-section-title">🔭 附近雷达</text>
      <view class="aed-radar-list">
        <view
          v-for="aed in aedStore.nearbyAeds"
          :key="aed.id"
          class="aed-radar-item"
          @click="showAedDetail(aed)"
        >
          <view class="aed-radar-rank" :style="{ opacity: 1 - (aed.distance / 600) }">
            <text>{{ aed.distance }}m</text>
          </view>
          <view class="aed-radar-icon-wrap" :class="{ found: aed.discovered, verified: aed.verified }">
            <text>{{ aed.status === 'maintenance' ? '🔧' : aed.verified ? '✓' : aed.discovered ? '📍' : '?' }}</text>
          </view>
          <view class="aed-radar-info">
            <text class="aed-radar-name">{{ aed.name }}</text>
            <text class="aed-radar-addr">{{ aed.address }}</text>
          </view>
          <view class="aed-radar-status" :class="aed.status">
            <text>{{ aed.status === 'available' ? '可用' : '维护中' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- AED 快速预览（Bottom Sheet 模拟） -->
    <view v-if="previewAed" class="aed-preview-sheet" @click.self="previewAed = null">
      <view class="aed-preview-card">
        <view class="aed-preview-handle" />
        <view class="aed-preview-photo">
          <image :src="previewAed.photo" mode="aspectFill" class="aed-preview-photo-img" />
          <view class="aed-preview-photo-badge" :class="previewAed.status">{{ previewAed.status === 'available' ? '可用' : '维护中' }}</view>
        </view>
        <text class="aed-preview-name">{{ previewAed.name }}</text>
        <text class="aed-preview-addr">{{ previewAed.address }}</text>
        <view class="aed-preview-meta">
          <text>📏 {{ previewAed.distance }}m</text>
          <text>🏢 {{ previewAed.indoor ? previewAed.floor : '户外' }}</text>
          <text>🕐 {{ previewAed.openHours }}</text>
        </view>
        <view class="aed-preview-actions">
          <view class="aed-preview-btn primary" @click="goDetail(previewAed)">
            <text>查看详情</text>
            <text class="aed-preview-btn-arrow">→</text>
          </view>
          <view class="aed-preview-btn secondary" @click="quickCheckIn(previewAed)">
            <text>📸 打卡</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAedStore } from '@/stores/aed'
import { useUserStore } from '@/stores/user'
import type { AedDevice } from '@/api/aed'

const aedStore = useAedStore()
const user = useUserStore()
const previewAed = ref<AedDevice | null>(null)

/** 计算 AED Pin 在地图上的位置（基于简单坐标系模拟） */
const pinMap = new Map<string, { x: number; y: number }>([
  ['aed_001', { x: 30, y: 28 }],
  ['aed_002', { x: 62, y: 22 }],
  ['aed_003', { x: 22, y: 68 }],
  ['aed_004', { x: 75, y: 72 }],
])

function aedPinStyle(aed: AedDevice) {
  const pos = pinMap.get(aed.id) || { x: 50, y: 50 }
  return { left: pos.x + '%', top: pos.y + '%' }
}

function showAedDetail(aed: AedDevice) {
  aedStore.discoverAed(aed.id)
  previewAed.value = aed
}

function goDetail(aed: AedDevice) {
  previewAed.value = null
  uni.navigateTo({ url: `/pages/aed/detail?id=${aed.id}` })
}

function quickCheckIn(aed: AedDevice) {
  previewAed.value = null
  uni.navigateTo({ url: `/pages/aed/detail?id=${aed.id}&action=checkin` })
}
</script>

<style lang="scss" scoped>
.page-aed-go {
  background: linear-gradient(180deg, #0D2818 0%, #0A1F14 100%);
  min-height: 100vh;
  padding-bottom: 40rpx;
}

/* 演习横幅 */
.aed-drill-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 14rpx 32rpx;
  background: rgba(245, 158, 11, 0.1);
  border-bottom: 1px solid rgba(245, 158, 11, 0.15);
}
.aed-drill-icon { font-size: 24rpx; }
.aed-drill-text { font-size: 20rpx; color: #F59E0B; font-weight: 600; }

/* ============ 顶部探索状态 ============ */
.aed-header {
  padding: 24rpx 32rpx 0;
}
.aed-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.aed-explorer-badge {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.aed-explorer-icon {
  font-size: 40rpx;
}
.aed-explorer-name {
  display: block;
  font-size: 28rpx;
  font-weight: 700;
  color: #fff;
  font-family: var(--serif);
}
.aed-explorer-tier {
  display: block;
  font-size: 20rpx;
  color: #F59E0B;
  font-family: var(--mono);
  letter-spacing: 2rpx;
}
.aed-points-pill {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  padding: 10rpx 20rpx;
  border-radius: 40rpx;
}
.aed-points-star {
  font-size: 24rpx;
}
.aed-points-value {
  font-family: var(--mono);
  font-weight: 700;
  font-size: 24rpx;
  color: #F59E0B;
}

/* 进度条 */
.aed-progress-wrap {
  position: relative;
}
.aed-progress-bar {
  height: 12rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6rpx;
  overflow: visible;
  position: relative;
}
.aed-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #34D277, #1F8A5B);
  border-radius: 6rpx;
  transition: width 0.6s ease;
}
.aed-progress-glow {
  position: absolute;
  top: -4rpx;
  width: 20rpx;
  height: 20rpx;
  background: #34D277;
  border-radius: 50%;
  box-shadow: 0 0 16rpx rgba(52, 210, 119, 0.6);
  transform: translateX(-50%);
  transition: left 0.6s ease;
}
.aed-progress-text {
  font-family: var(--mono);
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 8rpx;
  display: block;
  text-align: right;
}

/* ============ 地图区域 ============ */
.aed-map-area {
  margin: 20rpx 32rpx 0;
  height: 520rpx;
  border-radius: 36rpx;
  overflow: hidden;
  position: relative;
  border: 2px solid rgba(52, 210, 119, 0.15);
}
.aed-map-grass {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1B4D2E 0%, #0F301A 50%, #1A3F24 100%);
  position: relative;
}
.aed-map-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 60rpx 60rpx;
}

/* 用户位置 */
.aed-map-user-pin {
  position: absolute;
  left: 48%;
  top: 55%;
  transform: translate(-50%, -50%);
  z-index: 10;
}
.aed-map-user-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #4A90E2, #2563EB);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 28rpx;
  border: 4rpx solid #fff;
  box-shadow: 0 8rpx 24rpx rgba(74, 144, 226, 0.5);
  position: relative;
  z-index: 2;
}
.aed-map-user-pulse {
  position: absolute;
  inset: -16rpx;
  border-radius: 50%;
  border: 2px solid rgba(74, 144, 226, 0.3);
  animation: userPulse 2s ease-out infinite;
}

/* AED Pin — PokéStop 风格 */
.aed-map-pokestop {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.aed-pin-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  border: 2px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  position: relative;
  z-index: 2;
  backdrop-filter: blur(8rpx);
}
.aed-map-pokestop.discovered .aed-pin-icon {
  background: rgba(245, 158, 11, 0.2);
  border-color: rgba(245, 158, 11, 0.4);
}
.aed-map-pokestop.verified .aed-pin-icon {
  background: rgba(52, 210, 119, 0.2);
  border-color: rgba(52, 210, 119, 0.4);
}
.aed-map-pokestop.maintenance .aed-pin-icon {
  background: rgba(255, 107, 91, 0.2);
  border-color: rgba(255, 107, 91, 0.4);
}
.aed-pin-ring {
  position: absolute;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  animation: pinPulse 2s ease-out infinite;
}
.aed-pin-ring-2 {
  position: absolute;
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: pinPulse 2s ease-out infinite 0.7s;
}
.aed-map-pokestop.verified .aed-pin-ring {
  border-color: rgba(52, 210, 119, 0.4);
}
.aed-map-pokestop.verified .aed-pin-ring-2 {
  border-color: rgba(52, 210, 119, 0.2);
}
.aed-pin-label {
  font-family: var(--mono);
  font-size: 18rpx;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.4);
  padding: 4rpx 12rpx;
  border-radius: 16rpx;
}

/* 地图浮层 */
.aed-map-overlay {
  position: absolute;
  bottom: 16rpx;
  left: 16rpx;
  right: 16rpx;
  display: flex;
  justify-content: space-between;
}
.aed-radar-label {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12rpx);
  padding: 10rpx 20rpx;
  border-radius: 20rpx;
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.8);
  font-family: var(--mono);
}
.aed-radar-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #34D277;
  animation: blink 1.2s infinite;
}

/* ============ 附近雷达 ============ */
.aed-radar-section {
  padding: 32rpx 32rpx 0;
}
.aed-section-title {
  font-family: var(--serif);
  font-size: 30rpx;
  font-weight: 700;
  color: #fff;
  display: block;
  margin-bottom: 20rpx;
}
.aed-radar-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.aed-radar-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24rpx;
}
.aed-radar-rank {
  width: 80rpx;
  font-family: var(--mono);
  font-size: 22rpx;
  font-weight: 700;
  color: #34D277;
  text-align: right;
  flex-shrink: 0;
}
.aed-radar-icon-wrap {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  flex-shrink: 0;
  &.found { background: rgba(245, 158, 11, 0.15); }
  &.verified { background: rgba(52, 210, 119, 0.15); }
}
.aed-radar-info {
  flex: 1;
  min-width: 0;
}
.aed-radar-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
  display: block;
  margin-bottom: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.aed-radar-addr {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}
.aed-radar-status {
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  font-family: var(--mono);
  font-weight: 600;
  flex-shrink: 0;
  &.available { background: rgba(52, 210, 119, 0.15); color: #34D277; }
  &.maintenance { background: rgba(255, 107, 91, 0.15); color: #FF6B5B; }
}

/* ============ 预览卡片 (Bottom Sheet) ============ */
.aed-preview-sheet {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8rpx);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  padding-bottom: 100rpx;
}
.aed-preview-card {
  width: 100%;
  max-height: 70vh;
  overflow-y: auto;
  background: linear-gradient(180deg, #1A3F24 0%, #0F2A18 100%);
  border-radius: 40rpx 40rpx 0 0;
  padding: 0 32rpx 32rpx;
  border-top: 2px solid rgba(52, 210, 119, 0.2);
  animation: slideUp 0.28s ease;
}
.aed-preview-handle {
  width: 56rpx;
  height: 6rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3rpx;
  margin: 16rpx auto 24rpx;
}
.aed-preview-photo {
  position: relative;
  border-radius: 20rpx;
  overflow: hidden;
  height: 200rpx;
  margin-bottom: 16rpx;
}
.aed-preview-photo-img {
  width: 100%;
  height: 100%;
}
.aed-preview-photo-badge {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-family: var(--mono);
  font-size: 20rpx;
  font-weight: 700;
  &.available { background: rgba(52, 210, 119, 0.9); color: #fff; }
  &.maintenance { background: rgba(255, 107, 91, 0.9); color: #fff; }
}
.aed-preview-name {
  font-family: var(--serif);
  font-size: 34rpx;
  font-weight: 900;
  color: #fff;
  display: block;
  margin-bottom: 8rpx;
}
.aed-preview-addr {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.5);
  display: block;
  margin-bottom: 16rpx;
}
.aed-preview-meta {
  display: flex;
  gap: 24rpx;
  margin-bottom: 24rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.45);
  font-family: var(--mono);
}
.aed-preview-actions {
  display: flex;
  gap: 16rpx;
}
.aed-preview-btn {
  flex: 1;
  padding: 24rpx;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  &.primary {
    background: linear-gradient(135deg, #34D277, #1F8A5B);
    color: #fff;
  }
  &.secondary {
    background: rgba(245, 158, 11, 0.2);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: #F59E0B;
  }
}
.aed-preview-btn-arrow {
  font-size: 28rpx;
}

/* ============ 动画 ============ */
@keyframes pinPulse {
  0% { transform: scale(0.6); opacity: 0.8; }
  100% { transform: scale(1.5); opacity: 0; }
}
@keyframes userPulse {
  0% { transform: scale(0.8); opacity: 0.6; }
  100% { transform: scale(1.8); opacity: 0; }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>
