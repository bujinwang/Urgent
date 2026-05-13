<template>
  <view>
    <view class="header"><text class="h1">选择兴趣方向</text><text class="h2">首页会展示对应功能模块</text></view>
    <view class="grid">
      <view v-for="o in options" :key="o.key" class="card" :class="{sel:selected.includes(o.key)}" @click="toggle(o.key)">
        <text class="i">{{o.icon}}</text><text class="l">{{o.label}}</text>
        <text v-if="selected.includes(o.key)" class="c">✓</text>
      </view>
    </view>
    <view class="btns"><view class="btn" @click="save">保存</view></view>
  </view>
</template>
<script setup lang="ts">
import { ref,onMounted } from 'vue';import { useUserStore } from '@/stores/user';import { put } from '@/api/index'
const s=useUserStore()
const options=[{key:'medical',icon:'🩺',label:'CPR/急救'},{key:'pet',icon:'🐱',label:'流浪猫狗'},{key:'wildlife',icon:'🦅',label:'野生动物'},{key:'disaster',icon:'🚨',label:'规模救援'},{key:'trail',icon:'🥾',label:'徒步'}]
const selected=ref<string[]>(['medical'])
onMounted(()=>{const t=(s.profile as any).volunteer_type||'medical';selected.value=t.split(',').filter(Boolean)})
function toggle(k:string){const i=selected.value.indexOf(k);if(i>=0)selected.value.splice(i,1);else selected.value.push(k)}
async function save(){const vt=selected.value.join(',')||'medical';await put('/user/interests',{userId:s.profile.id,volunteerType:vt});(s.profile as any).volunteer_type=vt;uni.showToast({title:'已保存',icon:'success'});setTimeout(()=>uni.navigateBack(),600)}
</script>
<style scoped>
.header{padding:40rpx 32rpx 24rpx;background:var(--rescue-red)}.h1{font-size:40rpx;font-weight:900;color:#fff;display:block}.h2{font-size:24rpx;color:rgba(255,255,255,.7);margin-top:8rpx;display:block}
.grid{display:flex;flex-wrap:wrap;gap:16rpx;padding:28rpx 32rpx;justify-content:center}
.card{width:calc(50% - 12rpx);max-width:220rpx;padding:28rpx 16rpx;border-radius:16rpx;border:2px solid transparent;background:#fff;text-align:center;position:relative;box-shadow:0 2rpx 12rpx rgba(0,0,0,.04)}
.card.sel{border-color:var(--rescue-red);background:#FFF5F5}.i{font-size:44rpx;display:block}.l{font-size:24rpx;font-weight:600;color:var(--ink-primary);margin-top:8rpx;display:block}
.c{position:absolute;top:6rpx;right:10rpx;font-size:20rpx;color:#fff;background:var(--rescue-red);width:32rpx;height:32rpx;border-radius:50%;display:flex;align-items:center;justify-content:center}
.btns{padding:0 32rpx 40rpx}.btn{background:var(--rescue-red);color:#fff;text-align:center;padding:24rpx;border-radius:48rpx;font-size:30rpx;font-weight:700}
</style>
