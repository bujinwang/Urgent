<template>
  <view class="page-media-alert">
    <!-- 演习横幅 -->
    <view class="alert-banner">
      <text class="alert-banner-icon">⚠️</text>
      <text class="alert-banner-text">演习模式 · 不会真实发送给 120</text>
    </view>

    <!-- 顶栏 -->
    <view class="alert-appbar">
      <text class="alert-back" @click="goBack">‹</text>
      <text class="alert-title">图片视频报警</text>
    </view>

    <!-- 预览区 -->
    <view class="alert-preview" v-if="mediaList.length > 0">
      <view v-for="(item, i) in mediaList" :key="i" class="alert-preview-item">
        <image v-if="item.type === 'image'" :src="item.path" mode="aspectFill" class="alert-preview-img" />
        <video v-else :src="item.path" class="alert-preview-video" />
        <view class="alert-preview-del" @click="removeMedia(i)">✕</view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="alert-empty">
      <text class="alert-empty-icon">📸</text>
      <text class="alert-empty-title">拍照或录像</text>
      <text class="alert-empty-sub">记录现场情况，帮助 120 提前判断</text>
    </view>

    <!-- 操作按钮 -->
    <view class="alert-media-btns">
      <view class="alert-media-btn" @click="takePhoto">
        <text class="alert-media-btn-icon">📷</text>
        <text class="alert-media-btn-label">拍照</text>
      </view>
      <view class="alert-media-btn" @click="pickFromGallery">
        <text class="alert-media-btn-icon">🖼</text>
        <text class="alert-media-btn-label">选图片</text>
      </view>
      <view class="alert-media-btn" @click="recordVideo">
        <text class="alert-media-btn-icon">🎬</text>
        <text class="alert-media-btn-label">录像</text>
      </view>
    </view>

    <!-- 发送按钮 -->
    <view class="alert-send-wrap" v-if="mediaList.length > 0">
      <view class="alert-send-btn" @click="sendAlert">
        <text>📤 发送给 120 急救中心</text>
        <text class="alert-send-count">（{{ mediaList.length }} 个文件）</text>
      </view>
    </view>

    <!-- 底部提示 -->
    <view class="alert-tips">
      <text class="alert-tip-title">📋 建议拍摄内容</text>
      <text class="alert-tip-item">• 患者整体状态与体位</text>
      <text class="alert-tip-item">• 现场环境（路标、门牌等方便定位）</text>
      <text class="alert-tip-item">• 已采取的急救措施</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface MediaItem {
  type: 'image' | 'video'
  path: string
}

const mediaList = ref<MediaItem[]>([])

function goBack() {
  uni.navigateBack()
}

/** 拍照 */
function takePhoto() {
  uni.chooseImage({
    count: 3,
    sourceType: ['camera'],
    success: (res) => {
      res.tempFilePaths.forEach((path) => {
        mediaList.value.push({ type: 'image', path })
      })
    },
    fail: () => {
      uni.showToast({ title: '演习模式 · 相机权限未开启', icon: 'none' })
    },
  })
}

/** 从相册选 */
function pickFromGallery() {
  uni.chooseImage({
    count: 3,
    sourceType: ['album'],
    success: (res) => {
      res.tempFilePaths.forEach((path) => {
        mediaList.value.push({ type: 'image', path })
      })
    },
  })
}

/** 录像 */
function recordVideo() {
  uni.chooseVideo({
    sourceType: ['camera'],
    maxDuration: 30,
    success: (res) => {
      mediaList.value.push({ type: 'video', path: res.tempFilePath })
    },
    fail: () => {
      uni.showToast({ title: '演习模式 · 相机权限未开启', icon: 'none' })
    },
  })
}

/** 移除媒体 */
function removeMedia(index: number) {
  mediaList.value.splice(index, 1)
}

/** 发送 */
function sendAlert() {
  uni.showModal({
    title: '演习模式',
    content: `本次为演习，不会真实将 ${mediaList.value.length} 个文件发送给 120 急救中心。\n\n真实场景下，图片和视频将随 GPS 位置一同发送至最近的 120 调度中心。`,
    confirmText: '知道了',
    showCancel: false,
    success: () => {
      mediaList.value = []
    },
  })
}
</script>

<style lang="scss" scoped>
.page-media-alert {
  background: linear-gradient(180deg, #2A0F0C 0%, #1A0907 100%);
  color: #fff;
  min-height: 100vh;
  padding-bottom: 60rpx;
}

/* 演习横幅 */
.alert-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 16rpx 40rpx;
  background: rgba(245, 158, 11, 0.12);
  border-bottom: 1px solid rgba(245, 158, 11, 0.2);
}
.alert-banner-icon {
  font-size: 24rpx;
}
.alert-banner-text {
  font-size: 20rpx;
  color: #F59E0B;
  font-weight: 600;
}

/* 顶栏 */
.alert-appbar {
  display: flex;
  align-items: center;
  padding: 28rpx 40rpx;
  gap: 24rpx;
  text { color: #fff; }
}
.alert-back {
  font-size: 48rpx;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.alert-title {
  flex: 1;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 36rpx;
}

/* 预览区 */
.alert-preview {
  margin: 24rpx 40rpx;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}
.alert-preview-item {
  position: relative;
  border-radius: 20rpx;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  aspect-ratio: 1;
}
.alert-preview-img {
  width: 100%;
  height: 100%;
}
.alert-preview-video {
  width: 100%;
  height: 100%;
}
.alert-preview-del {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
}

/* 空状态 */
.alert-empty {
  margin: 80rpx 40rpx 48rpx;
  text-align: center;
  padding: 80rpx 40rpx;
  border: 2rpx dashed rgba(255, 255, 255, 0.12);
  border-radius: 32rpx;
}
.alert-empty-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 24rpx;
}
.alert-empty-title {
  font-family: var(--serif);
  font-size: 32rpx;
  font-weight: 700;
  display: block;
  margin-bottom: 12rpx;
}
.alert-empty-sub {
  font-size: 24rpx;
  opacity: 0.5;
  display: block;
}

/* 操作按钮 */
.alert-media-btns {
  display: flex;
  gap: 20rpx;
  padding: 0 40rpx;
}
.alert-media-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  padding: 40rpx 16rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 28rpx;
  &:active { background: rgba(255, 255, 255, 0.1); }
}
.alert-media-btn-icon {
  font-size: 56rpx;
}
.alert-media-btn-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
}

/* 发送按钮 */
.alert-send-wrap {
  padding: 48rpx 40rpx 32rpx;
}
.alert-send-btn {
  width: 100%;
  padding: 36rpx;
  background: var(--rescue-red);
  color: #fff;
  border-radius: 32rpx;
  font-family: var(--serif);
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
  box-shadow: 0 16rpx 48rpx rgba(192, 57, 43, 0.4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}
.alert-send-count {
  font-size: 22rpx;
  font-weight: 400;
  opacity: 0.7;
}

/* 底部提示 */
.alert-tips {
  margin: 24rpx 40rpx 0;
  padding: 32rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24rpx;
}
.alert-tip-title {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  margin-bottom: 16rpx;
  opacity: 0.8;
}
.alert-tip-item {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.5);
  line-height: 2;
}
</style>
