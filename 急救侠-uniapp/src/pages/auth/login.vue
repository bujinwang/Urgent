<template>
  <view class="page">
    <view class="head"><text class="logo">❤️</text><text class="title">急救侠</text><text class="sub">登录或创建账号</text></view>
    <view class="card">
      <view class="tabs">
        <text class="tab" :class="{on:mode==='login'}" @click="mode='login'">登录</text>
        <text class="tab" :class="{on:mode==='register'}" @click="mode='register'">注册</text>
      </view>
      <input class="inp" v-model="phone" placeholder="请输入手机号" />
      <input v-if="mode==='register'" class="inp" v-model="name" placeholder="请输入姓名" />
      <input class="inp" v-model="code" placeholder="验证码（Demo 任意内容）" />
      <view class="btn" @click="doLogin">{{mode==='login'?'登录':'注册并登录'}}</view>
      <text class="demo" @click="demoLogin">🔑 Demo 体验登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const mode=ref<'login'|'register'>('login'),phone=ref(''),name=ref(''),code=ref('')
function doLogin(){
  if(phone.value.length<11){uni.showToast({title:'请输入正确手机号',icon:'none'});return}
  if(code.value.length<2){uni.showToast({title:'请输入验证码',icon:'none'});return}
  uni.setStorageSync('jwt_token','demo_token_'+phone.value);uni.showToast({title:'登录成功',icon:'none'})
  setTimeout(()=>uni.reLaunch({url:'/pages/home/index'}),800)
}
function demoLogin(){
  uni.setStorageSync('jwt_token','demo_token_demo');uni.showToast({title:'Demo 登录成功',icon:'none'})
  setTimeout(()=>uni.reLaunch({url:'/pages/home/index'}),500)
}
</script>

<style>
page{background:linear-gradient(180deg,#FFE8E5,#FAFAF7)}
.page{min-height:100vh}
.head{text-align:center;padding:80rpx 0 30rpx}.logo{font-size:80rpx;display:block}.title{font-size:52rpx;font-weight:900;display:block;margin-top:8rpx}.sub{font-size:24rpx;color:#8E8E8E;display:block;margin-top:4rpx}
.card{margin:0 40rpx;background:#fff;border-radius:32rpx;padding:40rpx}
.tabs{display:flex;margin-bottom:30rpx}.tab{flex:1;text-align:center;padding:16rpx;font-size:28rpx;color:#8E8E8E;border-bottom:3px solid transparent}.tab.on{color:#C0392B;border-bottom-color:#C0392B}
.inp{width:100%;height:80rpx;line-height:80rpx;padding:0 20rpx;border:1px solid #E8E4DD;border-radius:12rpx;font-size:28rpx;margin-bottom:20rpx;box-sizing:border-box}
.btn{margin-top:16rpx;padding:24rpx;background:#C0392B;color:#fff;text-align:center;border-radius:48rpx;font-size:30rpx;font-weight:700}
.demo{display:block;margin-top:20rpx;text-align:center;color:#C0392B;font-size:24rpx;font-weight:600;padding:20rpx;border:1px dashed #C0392B;border-radius:16rpx}
</style>
