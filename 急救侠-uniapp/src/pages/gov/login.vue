<template>
  <view class="page-gov-login">
    <view class="gov-login-card">
      <text class="gov-login-title">政府数据监管看板</text>
      <text class="gov-login-sub">仅授权政府账号可访问 · 数据仅至区级聚合</text>

      <input v-model="username" class="gov-input" placeholder="用户名" placeholder-class="ph" />
      <input v-model="password" class="gov-input" password placeholder="密码" placeholder-class="ph" />

      <view class="gov-btn" :class="{ disabled: submitting }" @click="onLogin">
        {{ submitting ? '登录中…' : '登 录' }}
      </view>

      <text v-if="error" class="gov-error">{{ error }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGovStore } from '@/stores/gov'

const store = useGovStore()
const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function onLogin() {
  if (!username.value || !password.value) {
    error.value = '请输入用户名与密码'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await store.login(username.value, password.value)
    uni.redirectTo({ url: '/pages/gov/dashboard' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-gov-login {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(180deg, #0b1220, #111c31); padding: 40rpx;
}
.gov-login-card {
  width: 100%; max-width: 640rpx; padding: 48rpx 40rpx;
  background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 28rpx;
}
.gov-login-title { display: block; font-size: 38rpx; font-weight: 800; color: #fff; }
.gov-login-sub { display: block; margin-top: 10rpx; font-size: 22rpx; color: rgba(255, 255, 255, 0.45); }
.gov-input {
  margin-top: 28rpx; height: 84rpx; padding: 0 24rpx;
  background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16rpx; color: #fff; font-size: 28rpx;
}
.ph { color: rgba(255, 255, 255, 0.3); }
.gov-btn {
  margin-top: 36rpx; height: 88rpx; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #2563eb, #22d3ee); color: #fff;
  font-size: 30rpx; font-weight: 700; border-radius: 20rpx;
}
.gov-btn.disabled { opacity: 0.6; }
.gov-error { display: block; margin-top: 20rpx; font-size: 24rpx; color: #f87171; }
</style>
