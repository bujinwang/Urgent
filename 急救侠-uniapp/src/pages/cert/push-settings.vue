<template>
  <view class="page-push">
    <view class="push-header">
      <text class="push-header-title">消息通知</text>
      <text class="push-header-desc">管理您希望收到的推送通知类型</text>
    </view>

    <view class="push-list">
      <view
        v-for="tmpl in push.templateOptions"
        :key="tmpl.key"
        class="push-item"
        @click="toggle(tmpl)"
      >
        <view class="push-item-info">
          <text class="push-item-label">{{ tmpl.label }}</text>
          <text class="push-item-desc">{{ tmpl.description }}</text>
        </view>
        <view :class="['push-toggle', tmpl.subscribed ? 'on' : 'off']">
          <view class="push-toggle-knob" />
        </view>
      </view>
    </view>

    <view v-if="!push.isSubscribed && platform === 'mp-weixin'" class="push-tip">
      <text class="push-tip-icon">💡</text>
      <text class="push-tip-text">点击任意开关，微信将弹出订阅授权窗口，请选择"允许"以接收通知。</text>
    </view>

    <view class="push-footer">
      <text class="push-footer-text">通知通过微信订阅消息发送。您可以在微信中随时关闭某类通知。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { usePushStore } from '@/stores/push'
import type { PushTemplateOption } from '@/stores/push'

const push = usePushStore()

// #ifdef MP-WEIXIN
const platform = 'mp-weixin'
// #endif
// #ifdef H5
const platform = 'h5'
// #endif
// #ifdef APP-PLUS
const platform = 'app'
// #endif

async function toggle(tmpl: PushTemplateOption) {
  try {
    if (tmpl.subscribed) {
      await push.unsubscribeOne(tmpl.templateId)
      uni.showToast({ title: '已关闭通知', icon: 'none' })
    } else {
      // 单个订阅：使用 requestAndRegister 触发微信弹窗
      await push.subscribeOne(tmpl.templateId)
      uni.showToast({ title: '订阅成功', icon: 'success' })
    }
  } catch (e: any) {
    console.warn('[Push] 操作失败:', e.message || e)
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function subscribeAll() {
  if (push.isSubscribed) return
  try {
    uni.showLoading({ title: '请求授权...' })
    await push.subscribeAll()
    uni.hideLoading()
    if (push.isSubscribed) {
      uni.showToast({ title: '订阅成功', icon: 'success' })
    }
  } catch (e: any) {
    uni.hideLoading()
    console.warn('[Push] 批量订阅失败:', e.message || e)
  }
}

onMounted(() => {
  // 首次进入且未订阅，自动弹窗引导
  if (!push.isSubscribed) {
    setTimeout(() => subscribeAll(), 600)
  }
})
</script>

<style scoped>
.page-push { padding: 32rpx 40rpx 60rpx; min-height: 100vh; background: #FAFAF7; }
.push-header { margin-bottom: 40rpx; }
.push-header-title { font-family: var(--serif); font-size: 40rpx; font-weight: 700; display: block; margin-bottom: 8rpx; }
.push-header-desc { font-size: 24rpx; color: var(--ink-mute); }

.push-list { display: flex; flex-direction: column; gap: 16rpx; margin-bottom: 32rpx; }
.push-item { display: flex; align-items: center; justify-content: space-between; padding: 32rpx; background: #fff; border-radius: 24rpx; border: 1px solid var(--line); }
.push-item-info { flex: 1; margin-right: 24rpx; }
.push-item-label { font-size: 28rpx; font-weight: 600; display: block; margin-bottom: 6rpx; }
.push-item-desc { font-size: 22rpx; color: var(--ink-mute); }

.push-toggle { width: 96rpx; height: 52rpx; border-radius: 26rpx; position: relative; transition: background 0.2s; flex-shrink: 0; }
.push-toggle.on { background: var(--rescue-red); }
.push-toggle.off { background: #D1D5DB; }
.push-toggle-knob { width: 44rpx; height: 44rpx; border-radius: 50%; background: #fff; position: absolute; top: 4rpx; left: 4rpx; transition: left 0.2s; box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.15); }
.push-toggle.on .push-toggle-knob { left: 48rpx; }

.push-tip { display: flex; gap: 16rpx; padding: 24rpx; background: #FFF8E1; border: 1px solid #FFE082; border-radius: 16rpx; margin-bottom: 32rpx; }
.push-tip-icon { font-size: 28rpx; flex-shrink: 0; }
.push-tip-text { font-size: 22rpx; color: #795548; line-height: 1.6; }

.push-footer { padding: 0 8rpx; }
.push-footer-text { font-size: 20rpx; color: var(--ink-mute); line-height: 1.6; }
</style>
