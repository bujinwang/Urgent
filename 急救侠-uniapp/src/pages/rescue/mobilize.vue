<template>
  <view class="page-mob">
    <view class="mob-header"><text class="mob-title">救援动员</text></view>
    <view class="mob-list">
      <view v-for="m in mobilizations" :key="m.id" class="mob-card">
        <view class="mob-card-top">
          <view class="mob-status-dot" :style="{background:statusColor(m.status)}"></view>
          <view class="mob-card-body">
            <text class="mob-card-title">{{ m.title }}</text>
            <text class="mob-card-desc">{{ m.description }}</text>
          </view>
          <text class="mob-card-status">{{ statusLabel(m.status) }}</text>
        </view>
        <view class="mob-card-meta">
          <text>{{ m.address }}</text>
          <text>{{ m.volunteersResponded }}/{{ m.volunteersNeeded }} 人已响应</text>
          <text>发起人: {{ m.leaderName }}</text>
        </view>
        <view class="mob-card-actions" v-if="m.status==='active'">
          <view class="mob-btn" @click="respond(m)">🤝 我要参与</view>
        </view>
        <view class="mob-card-actions" v-if="m.status==='pending' && userStore.profile.id === 'user_001'">
          <view class="mob-btn approve" @click="approve(m)">✅ 批准</view>
        </view>
      </view>
      <view v-if="mobilizations.length===0" class="mob-empty">暂无救援动员</view>
    </view>
    <view class="mob-fab" @click="showCreate=true" v-if="userStore.profile.id==='user_001'">📢</view>

    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate=false">
    <div class="modal"><h3>发起动员</h3>
      <label>标题</label><input v-model="form.title">
      <label>描述</label><textarea v-model="form.description"></textarea>
      <label>地点</label><input v-model="form.address">
      <label>类型</label><select v-model="form.type"><option value="rescue">救援</option><option value="training">训练</option><option value="assist">协助</option></select>
      <label>需要人数</label><input type="number" v-model="form.volunteersNeeded">
      <div class="modal-actions"><button class="btn btn-g" @click="showCreate=false">取消</button><button class="btn btn-p" @click="createMob">发起</button></div></div></div>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const API = 'http://localhost:3001/api/rescue'
const userStore = useUserStore()
const mobilizations = ref<any[]>([])
const showCreate = ref(false)
const form = ref({ title:'', description:'', address:'深圳湾公园', type:'rescue', volunteersNeeded:5 })

async function load() {
  try{const r=await fetch(`${API}/mobilizations`).then(r=>r.json());mobilizations.value=r.data||[]}catch(e){}
}
async function respond(m: any) {
  await fetch(`${API}/mobilizations/${m.id}/respond`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:userStore.profile.id,userName:userStore.profile.name})})
  uni.showToast({title:'已响应',icon:'none'});load()
}
async function approve(m: any) {
  await fetch(`${API}/mobilizations/${m.id}/approve`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({approvedBy:'admin'})})
  uni.showToast({title:'已批准',icon:'none'});load()
}
async function createMob() {
  const f = form.value
  await fetch(`${API}/mobilize`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,leaderId:userStore.profile.id,leaderName:userStore.profile.name,lat:22.517,lng:113.947})})
  showCreate.value=false;uni.showToast({title:'已发起',icon:'none'});load()
}
function statusColor(s: string) { return {pending:'#F59E0B',active:'#34D277',completed:'#8E8E8E'}[s]||'#6B7280' }
function statusLabel(s: string) { return {pending:'待审批',active:'进行中',completed:'已完成'}[s]||s }
onMounted(load)
</script>

<style lang="scss" scoped>
.page-mob{padding-bottom:80rpx}
.mob-header{padding:60rpx 40rpx 24rpx;background:linear-gradient(180deg,#FFEBEE,transparent)}
.mob-title{font-family:var(--serif);font-size:44rpx;font-weight:900}
.mob-list{padding:0 40rpx;display:flex;flex-direction:column;gap:16rpx}
.mob-card{background:#fff;border:1px solid var(--line);border-radius:20rpx;padding:24rpx}
.mob-card-top{display:flex;align-items:center;gap:12rpx}
.mob-status-dot{width:12rpx;height:12rpx;border-radius:50%;flex-shrink:0}
.mob-card-body{flex:1}.mob-card-title{font-size:28rpx;font-weight:700;display:block}.mob-card-desc{font-size:20rpx;color:var(--ink-mute)}
.mob-card-status{font-size:20rpx;font-family:var(--mono)}
.mob-card-meta{display:flex;gap:16rpx;margin-top:14rpx;padding-top:14rpx;border-top:1px solid var(--line);font-size:18rpx;color:var(--ink-mute);font-family:var(--mono);flex-wrap:wrap}
.mob-card-actions{margin-top:14rpx;display:flex;gap:12rpx}
.mob-btn{padding:12rpx 24rpx;border-radius:20rpx;font-size:22rpx;font-weight:600;background:var(--rescue-red-soft);color:var(--rescue-red)}
.mob-btn.approve{background:#D1FAE5;color:#065F46}
.mob-fab{position:fixed;bottom:28rpx;right:28rpx;width:52px;height:52px;border-radius:50%;background:var(--rescue-red);color:#fff;font-size:24rpx;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4rpx 16rpx rgba(192,57,43,0.4)}
.mob-empty{padding:80rpx;text-align:center;color:var(--ink-mute);font-size:22rpx}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:#fff;border-radius:16rpx;padding:28rpx;width:90%;max-width:400rpx;box-shadow:0 8rpx 40rpx rgba(0,0,0,0.15)}
.modal h3{font-size:17px;margin-bottom:16rpx}
.modal label{display:block;font-size:12px;color:#8E8E8E;margin-bottom:6rpx}
.modal input,.modal select,.modal textarea{width:100%;padding:10rpx 12rpx;border:1px solid #E5E5E0;border-radius:8rpx;font-size:13px;margin-bottom:14rpx;font-family:inherit}
.modal textarea{resize:vertical;min-height:50rpx}
.modal-actions{display:flex;gap:10rpx;justify-content:flex-end}
.btn{padding:10rpx 20rpx;border-radius:8rpx;font-size:13px;cursor:pointer;border:none}
.btn-p{background:#C0392B;color:#fff}.btn-g{background:transparent;color:#8E8E8E}
</style>
