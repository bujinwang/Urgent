<template>
  <view class="pg">
    <view v-if="task" class="card">
      <view class="ch"><view class="cpulse"/><text class="ctitle">{{task.title}}</text></view>
      <text class="cdesc">{{task.description}}</text>
      <view class="cdetails">
        <view class="cd"><text class="cdl">📍</text><text class="cdv">{{task.address}}</text></view>
        <view class="cd"><text class="cdl">📏</text><text class="cdv">{{task.distance}}m · {{sceneLabel(task.sceneType)}}</text></view>
        <view class="cd" v-if="task.patientAge"><text class="cdl">👤</text><text class="cdv">{{task.patientAge}}岁 {{task.patientGender}}</text></view>
      </view>
      <view class="cp"><view class="cpb"><view class="cpf" :style="{width:progressPct+'%'}"/></view><text class="cpt">{{task.volunteersResponded}}/{{task.volunteersNeeded}} 已响应 · {{task.volunteersEnRoute}} 在路上</text></view>
    </view>

    <view class="stitle">📡 现场动态</view>
    <view v-if="mediaList.length===0" class="empty">暂无现场更新</view>
    <view v-for="m in mediaList" :key="m.id" class="mi">
      <view class="mh"><text class="ma">{{m.userAvatar||'?'}}</text><text class="mn">{{m.userName}}</text><text class="mt">{{typeLabel(m.type)}}</text><text class="mtm">{{m.createdAt?.slice(11,16)}}</text></view>
      <text class="mc" v-if="m.content">{{m.content}}</text>
      <image v-if="m.mediaUrl&&(m.type==='photo'||m.type==='video')" :src="m.mediaUrl" class="mm" mode="widthFix" @click="preview(m.mediaUrl)"/>
    </view>

    <view class="pub">
      <input class="pi" :value="msg" @input="msg=$event.detail?.value??$event.target?.value??''" placeholder="输入现场更新..."/>
      <text class="pb" @click="send">发送</text>
      <text class="pc" @click="takePhoto">📸</text>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref,onMounted,computed } from 'vue';import { useUserStore } from '@/stores/user';import { useTaskStore } from '@/stores/task';import { request } from '@/api/index'
const s=useUserStore(),ts=useTaskStore()
const taskId=ref(''),task=ref<any>(null),mediaList=ref<any[]>([]),msg=ref('')
const progressPct=computed(()=>{if(!task.value||task.value.volunteersNeeded===0)return 0;return Math.min(100,Math.round((task.value.volunteersResponded/task.value.volunteersNeeded)*100))})
function sceneLabel(s:string){return {outdoor:'户外',office:'办公',road:'道路'}[s]||s}
function typeLabel(t:string){return {text:'💬',photo:'📸',video:'🎬',status:'📊'}[t]||t}

onMounted(()=>{
  taskId.value=uni.getLaunchOptionsSync?.()?.query?.id||''
  if(!taskId.value){const t=ts.tasks[0];if(t)taskId.value=t.id}
  loadTask();loadMedia()
})
async function loadTask(){const t=ts.tasks.find(t=>t.id===taskId.value);if(t)task.value=t}
async function loadMedia(){try{mediaList.value=await request({url:`/rescue/mobilizations/${taskId.value}/media`})}catch{}}
async function send(){
  if(!msg.value.trim())return
  const p=s.profile
  await request({url:`/rescue/mobilizations/${taskId.value}/media`,method:'POST',data:{userId:p.id,userName:p.name,userAvatar:p.avatar,type:'text',content:msg.value}})
  msg.value='';loadMedia()
}
async function takePhoto(){
  uni.chooseImage({count:1,sourceType:['camera','album'],success:async(res:any)=>{
    const p=s.profile
    await request({url:`/rescue/mobilizations/${taskId.value}/media`,method:'POST',data:{userId:p.id,userName:p.name,userAvatar:p.avatar,type:'photo',mediaUrl:res.tempFilePaths[0],content:'📸'}})
    loadMedia()
  }})
}
function preview(url:string){uni.previewImage({urls:[url]})}
</script>
<style scoped>
.pg{min-height:100vh;background:#F8F8F6;padding-bottom:140rpx}
.card{margin:16rpx 20rpx;padding:20rpx 24rpx;background:linear-gradient(135deg,#2C1810,#1A0F08);border:1px solid rgba(192,57,43,.3);border-radius:20rpx}.ch{display:flex;align-items:center;gap:10rpx;margin-bottom:10rpx}.cpulse{width:14rpx;height:14rpx;border-radius:50%;background:#E63946;animation:pulse 1s infinite}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(2)}}.ctitle{font-size:28rpx;font-weight:800;color:#fff;flex:1}.cdesc{font-size:22rpx;color:rgba(255,255,255,.7);display:block;margin-bottom:10rpx;line-height:1.5}.cdetails{margin-bottom:10rpx}.cd{display:flex;align-items:center;gap:8rpx;margin-bottom:6rpx}.cdl{font-size:22rpx}.cdv{font-size:20rpx;color:rgba(255,255,255,.6)}.cp{margin-top:10rpx}.cpb{height:8rpx;background:rgba(255,255,255,.1);border-radius:4rpx;overflow:hidden;margin-bottom:6rpx}.cpf{height:100%;background:linear-gradient(90deg,#E63946,#FF6B6B);border-radius:4rpx}.cpt{font-size:20rpx;color:rgba(255,255,255,.5)}
.stitle{font-size:28rpx;font-weight:700;padding:20rpx 20rpx 12rpx}.empty{text-align:center;padding:40rpx;color:#999}
.mi{padding:16rpx 20rpx;border-bottom:1px solid #eee}.mh{display:flex;align-items:center;gap:10rpx;margin-bottom:6rpx}.ma{width:40rpx;height:40rpx;border-radius:50%;background:#C0392B;display:flex;align-items:center;justify-content:center;font-size:20rpx;color:#fff}.mn{font-size:24rpx;font-weight:600}.mt{font-size:18rpx;color:var(--ink-mute);margin-left:auto}.mtm{font-size:18rpx;color:var(--ink-mute)}.mc{font-size:26rpx;display:block;margin-bottom:8rpx;line-height:1.5}.mm{width:100%;border-radius:12rpx}
.pub{position:fixed;bottom:0;left:0;right:0;display:flex;align-items:center;gap:12rpx;padding:12rpx 16rpx;background:#fff;border-top:1px solid #eee;box-shadow:0 -2rpx 12rpx rgba(0,0,0,.06)}.pi{flex:1;height:40px;border:1px solid #ddd;border-radius:20rpx;padding:0 16rpx;font-size:24rpx;background:#f5f5f5;box-sizing:border-box}.pb{padding:10rpx 24rpx;background:#C0392B;color:#fff;border-radius:24rpx;font-size:24rpx;font-weight:600}.pc{font-size:36rpx}
</style>
