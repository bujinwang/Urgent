<template>
  <view>
    <view style="text-align:center;padding:60rpx 0 20rpx"><text style="font-size:80rpx;display:block">❤️</text><text style="font-size:44rpx;font-weight:900;display:block;margin-top:8rpx">急救侠</text></view>
    <view style="margin:0 40rpx;background:#fff;border-radius:24rpx;padding:30rpx">
      <view style="display:flex;margin-bottom:24rpx">
        <text style="flex:1;text-align:center;padding:12rpx;font-size:28rpx;color:#C0392B;border-bottom:3px solid #C0392B">登录</text>
        <text style="flex:1;text-align:center;padding:12rpx;font-size:28rpx;color:#8E8E8E;border-bottom:3px solid transparent" @click="mode='register'">注册</text>
      </view>
      <input style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" v-model="phone" placeholder="手机号" />
      <input v-if="mode==='register'" style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" v-model="name" placeholder="姓名" />
      <input style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" v-model="code" placeholder="验证码 (任意填)" />
      <view style="padding:14px;background:#C0392B;color:#fff;text-align:center;border-radius:24px;font-size:18px;font-weight:700;margin-top:8px" @click="doLogin">{{mode==='login'?'登录':'注册并登录'}}</view>
      <text style="display:block;margin-top:16px;text-align:center;color:#C0392B;font-size:14px;font-weight:600;padding:14px;border:1px dashed #C0392B;border-radius:12px" @click="demoLogin">🔑 Demo 体验登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const mode=ref<'login'|'register'>('login'),phone=ref(''),name=ref(''),code=ref('')
function doLogin(){
  if(phone.value.length<11){uni.showToast({title:'请输入11位手机号',icon:'none'});return}
  if(code.value.length<2){uni.showToast({title:'请输入验证码',icon:'none'});return}
  uni.setStorageSync('jwt_token','demo_token_'+phone.value);uni.showToast({title:'登录成功',icon:'none'})
  setTimeout(()=>{window.location.href='/#/pages/home/index'},800)
}
function demoLogin(){
  uni.setStorageSync('jwt_token','demo_token_demo');uni.showToast({title:'Demo 登录成功',icon:'none'})
  setTimeout(()=>{window.location.href='/#/pages/home/index'},500)
}
</script>
