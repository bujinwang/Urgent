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

    <!-- ===== 阶段 1：空状态（idle） ===== -->
    <template v-if="store.phase === 'idle'">
      <view class="alert-empty">
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
    </template>

    <!-- ===== 阶段 2：已选择文件，待发送（ready） ===== -->
    <template v-if="store.phase === 'ready'">
      <!-- 预览区 -->
      <view class="alert-preview">
        <view v-for="(item, i) in store.mediaList" :key="i" class="alert-preview-item">
          <image v-if="item.type === 'image'" :src="item.path" mode="aspectFill" class="alert-preview-img" />
          <video v-else :src="item.path" class="alert-preview-video" />
          <view class="alert-preview-del" @click="store.removeMedia(i)">✕</view>
          <view class="alert-preview-type" v-if="item.type === 'video'">
            <text>▶</text>
          </view>
        </view>
      </view>

      <!-- 继续添加 -->
      <view class="alert-media-btns alert-media-btns-sm">
        <view class="alert-media-btn-sm" @click="takePhoto">
          <text>📷</text>
        </view>
        <view class="alert-media-btn-sm" @click="pickFromGallery">
          <text>🖼</text>
        </view>
        <view class="alert-media-btn-sm" @click="recordVideo">
          <text>🎬</text>
        </view>
      </view>

      <!-- 发送按钮 -->
      <view class="alert-send-wrap">
        <view class="alert-send-btn" @click="store.startUpload()">
          <text>📤 发送给 120 急救中心</text>
          <text class="alert-send-count">（{{ store.fileCount }} 个文件）</text>
        </view>
      </view>
    </template>

    <!-- ===== 阶段 3：上传中（uploading） ===== -->
    <template v-if="store.phase === 'uploading'">
      <view class="upload-section">
        <!-- 总体进度 -->
        <view class="upload-global">
          <text class="upload-global-label">正在上传至 120 急救中心…</text>
          <view class="upload-progress-bar">
            <view class="upload-progress-fill" :style="{ width: store.overallProgress + '%' }" />
          </view>
          <text class="upload-global-pct">{{ store.overallProgress }}%</text>
        </view>

        <!-- 逐文件状态 -->
        <view class="upload-files">
          <view
            v-for="(item, i) in store.mediaList"
            :key="i"
            class="upload-file-row"
            :class="'upload-file--' + item.uploadStatus"
          >
            <view class="upload-file-thumb">
              <image v-if="item.type === 'image'" :src="item.path" mode="aspectFill" />
              <video v-else :src="item.path" />
            </view>
            <view class="upload-file-body">
              <text class="upload-file-name">{{ item.type === 'image' ? '图片' : '视频' }} {{ i + 1 }}</text>
              <text class="upload-file-status">
                <template v-if="item.uploadStatus === 'uploading'">上传中 {{ item.uploadProgress }}%</template>
                <template v-else-if="item.uploadStatus === 'done'">✅ 已上传</template>
                <template v-else-if="item.uploadStatus === 'failed'">❌ 失败</template>
                <template v-else>等待中</template>
              </text>
              <!-- 迷你进度条 -->
              <view v-if="item.uploadStatus === 'uploading'" class="upload-file-minib">
                <view class="upload-file-minib-fill" :style="{ width: item.uploadProgress + '%' }" />
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>

    <!-- ===== 阶段 4：上传成功（success） ===== -->
    <template v-if="store.phase === 'success'">
      <view class="result-section">
        <view class="result-hero">
          <text class="result-hero-icon">✅</text>
          <text class="result-hero-title">发送成功</text>
          <text class="result-hero-sub">文件已送达 120 急救中心</text>
        </view>

        <view class="result-card">
          <view class="result-row">
            <text class="result-label">上传文件</text>
            <text class="result-value">{{ store.okCount }} / {{ store.fileCount }}</text>
          </view>
          <view class="result-row" v-if="store.result?.reportId">
            <text class="result-label">报告编号</text>
            <text class="result-value result-mono">{{ store.result?.reportId }}</text>
          </view>
          <view class="result-row">
            <text class="result-label">状态</text>
            <text class="result-value result-green">已接收</text>
          </view>
        </view>

        <view class="result-tips">
          <text class="result-tip-title">📋 接下来</text>
          <text class="result-tip-item">• 120 调度员正在查看您发送的现场信息</text>
          <text class="result-tip-item">• 急救人员将根据图片/视频提前做好准备</text>
          <text class="result-tip-item">• 请保持手机畅通，调度员可能回拨确认</text>
        </view>

        <view class="result-actions">
          <view class="result-btn result-btn-reset" @click="store.reset()">
            <text>📸 重新发送</text>
          </view>
        </view>
      </view>
    </template>

    <!-- ===== 阶段 5：上传失败（error） ===== -->
    <template v-if="store.phase === 'error'">
      <view class="result-section">
        <view class="result-hero result-hero-error">
          <text class="result-hero-icon">{{ store.okCount > 0 ? '⚠️' : '❌' }}</text>
          <text class="result-hero-title">{{ store.okCount > 0 ? '部分发送成功' : '发送失败' }}</text>
          <text class="result-hero-sub">{{ store.result?.message || '网络异常，请重试' }}</text>
        </view>

        <view class="result-card">
          <view class="result-row">
            <text class="result-label">成功</text>
            <text class="result-value result-green">{{ store.okCount }}</text>
          </view>
          <view class="result-row">
            <text class="result-label">失败</text>
            <text class="result-value result-red">{{ store.failCount }}</text>
          </view>
        </view>

        <view class="result-actions">
          <view class="result-btn result-btn-retry" @click="store.retryFailed()">
            <text>🔄 重试失败文件</text>
          </view>
          <view class="result-btn result-btn-reset" @click="store.reset()">
            <text>📸 重新选择</text>
          </view>
        </view>
      </view>
    </template>

    <!-- 底部提示（仅在 idle/ready 阶段显示） -->
    <view class="alert-tips" v-if="store.phase === 'idle' || store.phase === 'ready'">
      <text class="alert-tip-title">📋 建议拍摄内容</text>
      <text class="alert-tip-item">• 患者整体状态与体位</text>
      <text class="alert-tip-item">• 现场环境（路标、门牌等方便定位）</text>
      <text class="alert-tip-item">• 已采取的急救措施</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useMediaAlertStore } from '@/stores/media-alert'

const store = useMediaAlertStore()

function goBack() {
  uni.navigateBack()
}

function takePhoto() {
  uni.chooseImage({
    count: 3,
    sourceType: ['camera'],
    success: (res) => {
      store.addMedia(res.tempFilePaths.map((path) => ({ type: 'image' as const, path })))
    },
    fail: () => {
      uni.showToast({ title: '演习模式 · 相机权限未开启', icon: 'none' })
    },
  })
}

function pickFromGallery() {
  uni.chooseImage({
    count: 3,
    sourceType: ['album'],
    success: (res) => {
      store.addMedia(res.tempFilePaths.map((path) => ({ type: 'image' as const, path })))
    },
  })
}

function recordVideo() {
  uni.chooseVideo({
    sourceType: ['camera'],
    maxDuration: 30,
    success: (res) => {
      store.addMedia([{ type: 'video' as const, path: res.tempFilePath }])
    },
    fail: () => {
      uni.showToast({ title: '演习模式 · 相机权限未开启', icon: 'none' })
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
.alert-banner-icon { font-size: 24rpx; }
.alert-banner-text { font-size: 20rpx; color: #F59E0B; font-weight: 600; }

/* 顶栏 */
.alert-appbar {
  display: flex; align-items: center; padding: 28rpx 40rpx; gap: 24rpx;
  text { color: #fff; }
}
.alert-back {
  font-size: 48rpx; width: 72rpx; height: 72rpx;
  display: flex; align-items: center; justify-content: center;
}
.alert-title {
  flex: 1; font-family: var(--serif); font-weight: 700; font-size: 36rpx;
}

/* ============ idle 空状态 ============ */
.alert-empty {
  margin: 80rpx 40rpx 48rpx; text-align: center;
  padding: 80rpx 40rpx; border: 2rpx dashed rgba(255,255,255,0.12);
  border-radius: 32rpx;
}
.alert-empty-icon { font-size: 80rpx; display: block; margin-bottom: 24rpx; }
.alert-empty-title { font-family: var(--serif); font-size: 32rpx; font-weight: 700; display: block; margin-bottom: 12rpx; }
.alert-empty-sub { font-size: 24rpx; opacity: 0.5; display: block; }

/* 操作按钮（idle 大版） */
.alert-media-btns {
  display: flex; gap: 20rpx; padding: 0 40rpx;
}
.alert-media-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 12rpx;
  padding: 40rpx 16rpx; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 28rpx;
  &:active { background: rgba(255,255,255,0.1); }
}
.alert-media-btn-icon { font-size: 56rpx; }
.alert-media-btn-label { font-size: 24rpx; color: rgba(255,255,255,0.7); font-weight: 600; }

/* 操作按钮（ready 小版） */
.alert-media-btns-sm {
  display: flex; justify-content: center; gap: 16rpx; padding: 16rpx 40rpx 0;
}
.alert-media-btn-sm {
  width: 80rpx; height: 80rpx; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 50%; font-size: 36rpx;
  &:active { background: rgba(255,255,255,0.1); }
}

/* 预览区 */
.alert-preview {
  margin: 24rpx 40rpx; display: grid; grid-template-columns: repeat(2, 1fr); gap: 16rpx;
}
.alert-preview-item {
  position: relative; border-radius: 20rpx; overflow: hidden;
  background: rgba(255,255,255,0.05); aspect-ratio: 1;
}
.alert-preview-img { width: 100%; height: 100%; }
.alert-preview-video { width: 100%; height: 100%; }
.alert-preview-del {
  position: absolute; top: 12rpx; right: 12rpx; width: 44rpx; height: 44rpx;
  border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 22rpx;
}
.alert-preview-type {
  position: absolute; bottom: 12rpx; left: 12rpx;
  background: rgba(0,0,0,0.5); border-radius: 8rpx; padding: 4rpx 12rpx;
  font-size: 20rpx; color: #fff;
}

/* 发送按钮 */
.alert-send-wrap { padding: 48rpx 40rpx 32rpx; }
.alert-send-btn {
  width: 100%; padding: 36rpx; background: var(--rescue-red); color: #fff;
  border-radius: 32rpx; font-family: var(--serif); font-size: 30rpx; font-weight: 700;
  text-align: center; box-shadow: 0 16rpx 48rpx rgba(192,57,43,0.4);
  display: flex; flex-direction: column; align-items: center; gap: 4rpx;
}
.alert-send-count { font-size: 22rpx; font-weight: 400; opacity: 0.7; }

/* ============ uploading 上传中 ============ */
.upload-section { padding: 40rpx; }

.upload-global {
  text-align: center; margin-bottom: 48rpx;
}
.upload-global-label {
  font-size: 28rpx; font-weight: 600; display: block; margin-bottom: 24rpx;
}
.upload-progress-bar {
  width: 100%; height: 12rpx; background: rgba(255,255,255,0.08);
  border-radius: 6rpx; overflow: hidden; margin-bottom: 16rpx;
}
.upload-progress-fill {
  height: 100%; background: linear-gradient(90deg, var(--rescue-red), #E74C3C);
  border-radius: 6rpx; transition: width 0.15s ease;
}
.upload-global-pct {
  font-family: var(--mono); font-size: 48rpx; font-weight: 700; color: var(--rescue-red);
}

/* 逐文件列表 */
.upload-files {
  display: flex; flex-direction: column; gap: 16rpx;
}
.upload-file-row {
  display: flex; align-items: center; gap: 20rpx;
  padding: 20rpx; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06); border-radius: 20rpx;
  transition: border-color 0.3s;

  &.upload-file--uploading { border-color: rgba(192,57,43,0.3); }
  &.upload-file--done { border-color: rgba(31,138,91,0.3); background: rgba(31,138,91,0.06); }
  &.upload-file--failed { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.06); }
}
.upload-file-thumb {
  width: 72rpx; height: 72rpx; border-radius: 16rpx; overflow: hidden;
  flex-shrink: 0; background: rgba(255,255,255,0.06);
  image, video { width: 100%; height: 100%; }
}
.upload-file-body { flex: 1; min-width: 0; }
.upload-file-name { font-size: 24rpx; font-weight: 600; display: block; margin-bottom: 4rpx; }
.upload-file-status { font-size: 20rpx; opacity: 0.6; display: block; margin-bottom: 8rpx; }

.upload-file-minib {
  width: 100%; height: 6rpx; background: rgba(255,255,255,0.06); border-radius: 3rpx; overflow: hidden;
}
.upload-file-minib-fill {
  height: 100%; background: var(--rescue-red); border-radius: 3rpx; transition: width 0.15s ease;
}

/* ============ success / error 结果页 ============ */
.result-section { padding: 32rpx 40rpx; }

.result-hero {
  text-align: center; padding: 80rpx 40rpx 64rpx;
}
.result-hero-icon { font-size: 96rpx; display: block; margin-bottom: 32rpx; }
.result-hero-title { font-family: var(--serif); font-size: 48rpx; font-weight: 900; display: block; margin-bottom: 12rpx; }
.result-hero-sub { font-size: 26rpx; opacity: 0.5; display: block; }
.result-hero-error {
  .result-hero-title { color: #F59E0B; }
}

.result-card {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24rpx; padding: 32rpx; margin-bottom: 32rpx;
}
.result-row {
  display: flex; justify-content: space-between; align-items: center; padding: 16rpx 0;
  & + & { border-top: 1px solid rgba(255,255,255,0.06); }
}
.result-label { font-size: 24rpx; opacity: 0.5; }
.result-value { font-size: 24rpx; font-weight: 600; }
.result-mono { font-family: var(--mono); font-size: 20rpx; }
.result-green { color: #34D277; }
.result-red { color: #F59E0B; }

.result-tips {
  padding: 32rpx; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 24rpx; margin-bottom: 32rpx;
}
.result-tip-title { display: block; font-size: 24rpx; font-weight: 700; margin-bottom: 16rpx; opacity: 0.8; }
.result-tip-item { display: block; font-size: 22rpx; color: rgba(255,255,255,0.5); line-height: 2; }

.result-actions { display: flex; gap: 20rpx; }
.result-btn {
  flex: 1; padding: 32rpx; border-radius: 28rpx; text-align: center;
  font-family: var(--serif); font-size: 28rpx; font-weight: 700;
}
.result-btn-retry { background: linear-gradient(135deg, #F59E0B, #D97606); color: #fff; }
.result-btn-reset { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }

/* ============ 底部提示 ============ */
.alert-tips {
  margin: 24rpx 40rpx 0; padding: 32rpx;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 24rpx;
}
.alert-tip-title { display: block; font-size: 24rpx; font-weight: 700; margin-bottom: 16rpx; opacity: 0.8; }
.alert-tip-item { display: block; font-size: 22rpx; color: rgba(255,255,255,0.5); line-height: 2; }
</style>
