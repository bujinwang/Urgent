<template>
  <view class="page-login">
    <view class="login-header">
      <view class="login-logo">❤️</view>
      <text class="login-title">急救侠</text>
      <text class="login-sub">登录或创建账号</text>
    </view>
    <view class="login-form">
      <view class="login-card">
        <view class="login-tabs">
          <view class="login-tab" :class="{active:mode==='login'}" @click="mode='login'">登录</view>
          <view class="login-tab" :class="{active:mode==='register'}" @click="mode='register'">注册</view>
        </view>
        <label>手机号</label><input v-model="phone" type="number" placeholder="请输入手机号" maxlength="11">
        <label v-if="mode==='register'">姓名</label><input v-if="mode==='register'" v-model="name" placeholder="请输入姓名">
        <label>验证码</label>
        <view class="login-code-row"><input v-model="code" placeholder="验证码" maxlength="6"><view class="login-code-btn" @click="sendCode">{{codeSent?codeCountdown+'s':'获取验证码'}}</view></view>
        <view class="login-btn" @click="doLogin">{{mode==='login'?'登录':'注册并登录'}}</view>
        <view class="login-demo" @click="demoLogin">🔑 Demo 体验登录（直接进入）</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const mode=ref<'login'|'register'>('login'),phone=ref('13800138000'),name=ref(''),code=ref('')
const codeSent=ref(false),codeCountdown=ref(60)
let timer:any=null
function sendCode(){if(codeSent.value||phone.value.length<11)return;codeSent.value=true;timer=setInterval(()=>{codeCountdown.value--;if(codeCountdown.value<=0){clearInterval(timer);codeSent.value=false;codeCountdown.value=60}},1000);uni.showToast({title:'验证码已发送（Demo 填任意6位数）',icon:'none'})}
function doLogin(){if(phone.value.length<11){uni.showToast({title:'请输入正确手机号',icon:'none'});return};if(code.value.length<4){uni.showToast({title:'请输入验证码',icon:'none'});return};uni.setStorageSync('jwt_token','demo_token_'+phone.value);uni.showToast({title:mode.value==='register'?'注册成功':'登录成功',icon:'none'});setTimeout(()=>uni.reLaunch({url:'/pages/home/index'}),800)}
function demoLogin(){uni.setStorageSync('jwt_token','demo_token_demo');uni.showToast({title:'Demo 登录成功',icon:'none'});setTimeout(()=>uni.reLaunch({url:'/pages/home/index'}),500)}
</script>

<style lang="scss" scoped>
.page-login{min-height:100vh;background:linear-gradient(180deg,#FFE8E5 0%,#FAFAF7 60%);padding-bottom:60rpx}
.login-header{text-align:center;padding:100rpx 0 40rpx}.login-logo{font-size:80rpx;margin-bottom:16rpx}.login-title{font-family:var(--serif);font-size:52rpx;font-weight:900;display:block}.login-sub{font-size:24rpx;color:var(--ink-mute);margin-top:8rpx;display:block}
.login-form{padding:0 40rpx}.login-card{background:#fff;border-radius:32rpx;padding:40rpx;box-shadow:0 8rpx 40rpx rgba(0,0,0,0.06)}
.login-tabs{display:flex;gap:0;margin-bottom:32rpx}.login-tab{flex:1;text-align:center;padding:16rpx;font-size:28rpx;font-weight:600;color:var(--ink-mute);border-bottom:3px solid transparent}.login-tab.active{color:var(--rescue-red);border-bottom-color:var(--rescue-red)}
.login-card label{display:block;font-size:22rpx;color:var(--ink-mute);margin-bottom:8rpx;margin-top:16rpx}
.login-card input{width:100%;padding:20rpx;border:1px solid var(--line);border-radius:12rpx;font-size:28rpx}
.login-code-row{display:flex;gap:16rpx}.login-code-row input{flex:1}.login-code-btn{padding:20rpx 24rpx;background:var(--rescue-red-soft);color:var(--rescue-red);border-radius:12rpx;font-size:22rpx;font-weight:600;white-space:nowrap}
.login-btn{margin-top:32rpx;padding:24rpx;background:var(--rescue-red);color:#fff;text-align:center;border-radius:48rpx;font-size:30rpx;font-weight:700}
.login-demo{margin-top:20rpx;padding:20rpx;text-align:center;color:var(--rescue-red);font-size:24rpx;font-weight:600;border:1px dashed var(--rescue-red);border-radius:16rpx}
</style>
