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
        <view class="field"><text class="fl">手机号</text><input class="fi" v-model="phone" placeholder="请输入手机号" /></view>
        <view v-if="mode==='register'" class="field"><text class="fl">姓名</text><input class="fi" v-model="name" placeholder="请输入姓名" /></view>
        <view class="field"><text class="fl">验证码</text><view class="cr"><input class="fi ci" v-model="code" placeholder="验证码" /><text class="cb" @click="sendCode">{{codeSent?codeCountdown+'s':'获取验证码'}}</text></view></view>
        <view class="lbtn" @click="doLogin">{{mode==='login'?'登录':'注册并登录'}}</view>
        <view class="ldemo" @click="demoLogin">🔑 Demo 体验登录（直接进入）</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const mode=ref<'login'|'register'>('login'),phone=ref(''),name=ref(''),code=ref('')
const codeSent=ref(false),codeCountdown=ref(60)
let timer:any=null
function sendCode(){if(codeSent.value||phone.value.length<11)return;codeSent.value=true;timer=setInterval(()=>{codeCountdown.value--;if(codeCountdown.value<=0){clearInterval(timer);codeSent.value=false;codeCountdown.value=60}},1000);uni.showToast({title:'验证码已发送（Demo 填任意6位数）',icon:'none'})}
function doLogin(){if(phone.value.length<11){uni.showToast({title:'请输入正确手机号',icon:'none'});return}if(code.value.length<4){uni.showToast({title:'请输入验证码',icon:'none'});return}uni.setStorageSync('jwt_token','demo_token_'+phone.value);uni.showToast({title:mode.value==='register'?'注册成功':'登录成功',icon:'none'});setTimeout(()=>uni.reLaunch({url:'/pages/home/index'}),800)}
function demoLogin(){uni.setStorageSync('jwt_token','demo_token_demo');uni.showToast({title:'Demo 登录成功',icon:'none'});setTimeout(()=>uni.reLaunch({url:'/pages/home/index'}),500)}
</script>

<style>
.page-login{min-height:100vh;background:linear-gradient(180deg,#FFE8E5 0%,#FAFAF7 60%)}
.login-header{text-align:center;padding:100rpx 0 40rpx}.login-logo{font-size:80rpx}.login-title{font-size:52rpx;font-weight:900;display:block}.login-sub{font-size:24rpx;color:#8E8E8E;margin-top:8rpx}
.login-form{padding:0 40rpx}.login-card{background:#fff;border-radius:32rpx;padding:40rpx;box-shadow:0 8rpx 40rpx rgba(0,0,0,0.06)}
.login-tabs{display:flex;margin-bottom:32rpx}.login-tab{flex:1;text-align:center;padding:16rpx;font-size:28rpx;font-weight:600;color:#8E8E8E;border-bottom:3px solid transparent}.login-tab.active{color:#C0392B;border-bottom-color:#C0392B}
.field{margin-top:24rpx}.fl{display:block;font-size:22rpx;color:#8E8E8E;margin-bottom:8rpx}
.fi{display:block;width:100%;padding:20rpx;border:1px solid #E8E4DD;border-radius:12rpx;font-size:28rpx;background:#fff;box-sizing:border-box}
.cr{display:flex;gap:16rpx;align-items:center}.ci{flex:1}.cb{padding:20rpx 24rpx;background:#FFE8E5;color:#C0392B;border-radius:12rpx;font-size:22rpx;font-weight:600;white-space:nowrap}
.lbtn{margin-top:32rpx;padding:24rpx;background:#C0392B;color:#fff;text-align:center;border-radius:48rpx;font-size:30rpx;font-weight:700}
.ldemo{margin-top:20rpx;padding:20rpx;text-align:center;color:#C0392B;font-size:24rpx;font-weight:600;border:1px dashed #C0392B;border-radius:16rpx}
</style>
