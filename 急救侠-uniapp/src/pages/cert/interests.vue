<template>
  <view class="page-int">
    <view class="int-header"><text class="int-title">选择兴趣方向</text><text class="int-sub">可多选，决定平台展示的模块</text></view>
    <view class="int-list">
      <view v-for="opt in options" :key="opt.value" class="int-item" :class="{active:selected.includes(opt.value)}" @click="toggle(opt.value)">
        <text class="int-icon">{{opt.icon}}</text>
        <view class="int-body"><text class="int-label">{{opt.label}}</text><text class="int-desc">{{opt.desc}}</text></view>
        <view class="int-check" :class="{checked:selected.includes(opt.value)}">✓</view>
      </view>
    </view>
    <view class="int-footer"><view class="int-btn" @click="save">💾 保存</view></view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
const userStore=useUserStore()
const options=[
  {value:'medical',icon:'❤️',label:'CPR / 急救',desc:'心肺复苏、AED 使用、人员急救'},
  {value:'pet',icon:'🐱',label:'流浪猫狗',desc:'动物上报、照料、救助'},
  {value:'wildlife',icon:'🦅',label:'野生动物',desc:'保护动物发现、报告、救援'},
  {value:'disaster',icon:'🚨',label:'规模救援',desc:'灾害响应、大规模动员、蓝天协作'},
  {value:'trail',icon:'🥾',label:'徒步体能',desc:'户外徒步训练、体能志愿者'},
  {value:'drill',icon:'📋',label:'急救演习',desc:'组织/参与急救模拟训练'},
]
const selected=ref<string[]>([])
onMounted(()=>{const types=userStore.profile.volunteer_type||'medical';selected.value=types.split(',').filter(Boolean)})
function toggle(v:string){const i=selected.value.indexOf(v);if(i>=0)selected.value.splice(i,1);else selected.value.push(v)}
async function save(){await fetch('/api/user/interests',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:userStore.profile.id,interests:selected.value})});uni.showToast({title:'已保存',icon:'none'});setTimeout(()=>uni.navigateBack(),800)}
</script>

<style lang="scss" scoped>
.page-int{padding-bottom:40rpx}.int-header{padding:60rpx 40rpx 30rpx;background:linear-gradient(180deg,#EBF5FB,transparent)}.int-title{font-family:var(--serif);font-size:40rpx;font-weight:900;display:block}.int-sub{font-size:22rpx;color:var(--ink-mute);margin-top:8rpx;display:block}
.int-list{padding:20rpx 40rpx;display:flex;flex-direction:column;gap:14rpx}
.int-item{display:flex;align-items:center;gap:16rpx;padding:22rpx;background:#fff;border:2px solid var(--line);border-radius:16rpx}.int-item.active{border-color:var(--rescue-red);background:#FFF5F5}
.int-icon{font-size:36rpx;flex-shrink:0}.int-body{flex:1}.int-label{font-size:26rpx;font-weight:700;display:block}.int-desc{font-size:20rpx;color:var(--ink-mute)}
.int-check{width:40rpx;height:40rpx;border-radius:50%;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:20rpx;color:transparent;flex-shrink:0}.int-check.checked{background:var(--rescue-red);border-color:var(--rescue-red);color:#fff}
.int-footer{padding:30rpx 40rpx}.int-btn{padding:24rpx;background:var(--rescue-red);color:#fff;text-align:center;border-radius:48rpx;font-size:28rpx;font-weight:700}
</style>
