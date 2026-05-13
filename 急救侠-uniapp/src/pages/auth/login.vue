<template>
  <view>
    <view style="text-align:center;padding:60rpx 0 20rpx"><text style="font-size:80rpx;display:block">❤️</text><text style="font-size:44rpx;font-weight:900;display:block;margin-top:8rpx">急救侠</text></view>
    <view style="margin:0 40rpx;background:#fff;border-radius:24rpx;padding:30rpx">
      <view style="display:flex;margin-bottom:24rpx">
        <text :style="'flex:1;text-align:center;padding:12rpx;font-size:28rpx;border-bottom:3px solid '+(mode==='login'?'#C0392B':'transparent')+';color:'+(mode==='login'?'#C0392B':'#8E8E8E')" @click="mode='login'">登录</text>
        <text :style="'flex:1;text-align:center;padding:12rpx;font-size:28rpx;border-bottom:3px solid '+(mode==='register'?'#C0392B':'transparent')+';color:'+(mode==='register'?'#C0392B':'#8E8E8E')" @click="mode='register'">注册</text>
      </view>
      <input style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" :value="phone" @input="phone=($event.target as HTMLInputElement).value" placeholder="手机号" type="tel" />
      <input v-if="mode==='register'" style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" :value="name" @input="name=($event.target as HTMLInputElement).value" placeholder="姓名（选填）" />
      <view v-if="mode==='register'" style="margin-bottom:12px;font-size:12px;color:#8E8E8E">选择你的兴趣方向（可多选）</view>
      <view v-if="mode==='register'" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <text v-for="o in interestOptions" :key="o.key" :style="'padding:6px 14px;border-radius:20px;font-size:13px;'+(selectedInterests.includes(o.key)?'background:#C0392B;color:#fff':'background:#f0f0f0;color:#666')" @click="toggleInterest(o.key)">{{o.label}}</text>
      </view>
      <input style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" :value="pwd" @input="pwd=($event.target as HTMLInputElement).value" placeholder="密码" type="password" />
      <view style="padding:14px;background:#C0392B;color:#fff;text-align:center;border-radius:24px;font-size:18px;font-weight:700;margin-top:8px" @click="submit">{{mode==='login'?'登录':'注册并登录'}}</view>
      <text style="display:block;margin-top:16px;text-align:center;color:#C0392B;font-size:14px;font-weight:600;padding:14px;border:1px dashed #C0392B;border-radius:12px" @click="demoLogin">🔑 Demo 体验登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const mode=ref<'login'|'register'>('login'),phone=ref(''),name=ref(''),pwd=ref('')
const interestOptions = [
  { key:'medical', label:'🩺 CPR/急救' },
  { key:'pet', label:'🐱 流浪猫狗' },
  { key:'wildlife', label:'🦅 野生动物' },
  { key:'disaster', label:'🚨 规模救援' },
  { key:'trail', label:'🥾 徒步' },

]
const selectedInterests = ref<string[]>(['medical'])
function toggleInterest(k: string) {
  const i = selectedInterests.value.indexOf(k)
  if (i >= 0) selectedInterests.value.splice(i, 1); else selectedInterests.value.push(k)
}
import { phoneRegister, phoneLogin } from '@/api/auth'
async function submit(){
  if(phone.value.length<11){uni.showToast({title:'请输入11位手机号',icon:'none'});return}
  if(!pwd.value){uni.showToast({title:'请输入密码',icon:'none'});return}
  try{
    const result=mode.value==='register'?await phoneRegister(phone.value,pwd.value,name.value,selectedInterests.value.join(',')):await phoneLogin(phone.value,pwd.value)
    uni.setStorageSync('jwt_token',result.token);uni.showToast({title:mode.value==='register'?'注册成功':'登录成功',icon:'none'})
    setTimeout(()=>{window.location.href='/#/pages/home/index'},800)
  }catch(e:any){uni.showToast({title:'操作失败，请用 Demo 登录',icon:'none'})}
}
function demoLogin(){uni.setStorageSync('jwt_token','demo_token_demo');uni.showToast({title:'Demo 登录成功',icon:'none'});setTimeout(()=>{window.location.href='/#/pages/home/index'},500)}
</script>
