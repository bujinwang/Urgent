<template>
  <view>
    <view style="text-align:center;padding:60rpx 0 20rpx"><text style="font-size:80rpx;display:block">❤️</text><text style="font-size:44rpx;font-weight:900;display:block;margin-top:8rpx">急救侠</text></view>
    <view style="margin:0 40rpx;background:#fff;border-radius:24rpx;padding:30rpx">
      <view style="display:flex;margin-bottom:24rpx">
        <text :style="tabStyle('login')" @click="curTab='login'">登录</text>
        <text :style="tabStyle('register')" @click="curTab='register'">注册</text>
      </view>
      <input style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" :value="phone" @input="onPhoneInput" placeholder="手机号" type="tel" />
      <input v-if="curTab==='register'" style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" :value="name" @input="name=$event.detail?.value ?? $event.target?.value ?? ''" placeholder="姓名（选填）" />
      <view v-if="curTab==='register'" style="margin-bottom:12px;font-size:12px;color:#8E8E8E">选择兴趣方向（可多选）</view>
      <view v-if="curTab==='register'" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <text v-for="opt in interestOpts" :key="opt.key" :style="interestStyle(opt.key)" @click="toggle(opt.key)">{{opt.label}}</text>
      </view>
      <view v-if="curTab==='register'" style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;background:#EBF5FB;border-radius:12px" @click="isBlueSky=!isBlueSky">
        <text style="font-size:20px">{{isBlueSky?'🔷':'◻️'}}</text>
        <text style="font-size:13px;color:#2C5282;font-weight:600">我是蓝天救援队队员</text>
      </view>
      <view v-if="curTab==='register' && isBlueSky" style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;background:#FFF5F5;border-radius:12px" @click="isBlueSkyLeader=!isBlueSkyLeader">
        <text style="font-size:20px">{{isBlueSkyLeader?'👑':'◻️'}}</text>
        <text style="font-size:13px;color:#991B1B;font-weight:600">我是队长</text>
      </view>
      <input style="width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:16px;margin-bottom:12px;box-sizing:border-box" :value="pwd" @input="pwd=$event.detail?.value ?? $event.target?.value ?? ''" placeholder="密码" type="password" />
      <view style="padding:14px;background:#C0392B;color:#fff;text-align:center;border-radius:24px;font-size:18px;font-weight:700;margin-top:8px" @click="submit">{{curTab==='login'?'登录':'注册并登录'}}</view>
      <text style="display:block;margin-top:16px;text-align:center;color:#C0392B;font-size:14px;font-weight:600;padding:14px;border:1px dashed #C0392B;border-radius:12px" @click="demoLogin">🔑 Demo 体验登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { phoneRegister, phoneLogin } from '@/api/auth'

const curTab = ref<'login'|'register'>('login')
const phone = ref(''), name = ref(''), pwd = ref('')
const isBlueSky = ref(false), isBlueSkyLeader = ref(false)
const selected: string[] = ['medical']

const interestOpts = [
  { key:'medical', label:'🩺 CPR/急救' },
  { key:'pet', label:'🐱 流浪猫狗' },
  { key:'wildlife', label:'🦅 野生动物' },
  { key:'disaster', label:'🚨 规模救援' },
  { key:'trail', label:'🥾 徒步' },
]

function tabStyle(tab: string) {
  const active = curTab.value === tab
  return `flex:1;text-align:center;padding:12rpx;font-size:28rpx;border-bottom:3px solid ${active?'#C0392B':'transparent'};color:${active?'#C0392B':'#8E8E8E'}`
}

function interestStyle(key: string) {
  return `padding:6px 14px;border-radius:20px;font-size:13px;${selected.includes(key)?'background:#C0392B;color:#fff':'background:#f0f0f0;color:#666'}`
}

function onPhoneInput(e: any) {
  phone.value = (e.detail?.value ?? e.target?.value ?? '')
}

function toggle(k: string) {
  const i = selected.indexOf(k)
  if (i >= 0) selected.splice(i, 1); else selected.push(k)
}

async function submit() {
  const p = phone.value; const w = pwd.value
  if (!p || p.length < 11) { uni.showToast({ title:'请输入11位手机号', icon:'none' }); return }
  if (!w) { uni.showToast({ title:'请输入密码', icon:'none' }); return }
  try {
    const interests = selected.length ? selected.join(',') : 'medical'
    const aff = isBlueSky.value ? '蓝天救援队' : undefined
    const ld = isBlueSkyLeader.value ? true : undefined
    const result = curTab.value === 'register'
      ? await phoneRegister(p, w, name.value, interests, aff, ld)
      : await phoneLogin(p, w)
    uni.setStorageSync('jwt_token', result.token)
    uni.showToast({ title: curTab.value === 'register' ? '注册成功' : '登录成功', icon: 'none' })
    setTimeout(() => { window.location.href = '/#/pages/home/index' }, 800)
  } catch (e: any) {
    uni.showToast({ title: '操作失败，请用 Demo 登录', icon: 'none' })
  }
}

function demoLogin() {
  uni.setStorageSync('jwt_token', 'demo_token_demo')
  uni.showToast({ title: 'Demo 登录成功', icon: 'none' })
  setTimeout(() => { window.location.href = '/#/pages/home/index' }, 500)
}
</script>
