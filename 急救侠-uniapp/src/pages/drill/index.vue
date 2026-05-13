<template>
  <view class="page-drill">
    <view class="drill-header"><text class="drill-title">急救演习</text></view>
    <view class="drill-tabs">
      <view class="drill-tab" :class="{active:tab==='upcoming'}" @click="tab='upcoming'">即将开始</view>
      <view class="drill-tab" :class="{active:tab==='completed'}" @click="tab='completed'">已完成</view>
      <view class="drill-tab" :class="{active:tab==='records'}" @click="tab='records';loadRecords()">训练记录</view>
    </view>
    <view class="drill-list" v-if="tab!=='records'">
      <view v-for="d in drills" :key="d.id" class="drill-card">
        <view class="drill-card-top">
          <view class="drill-status-dot" :style="{background:statusColor(d.status)}"></view>
          <view class="drill-card-body"><text class="drill-card-title">{{d.title}}</text><text class="drill-card-scenario">{{scenarioLabel(d.scenario)}}</text></view>
          <text class="drill-card-status">{{statusLabel(d.status)}}</text>
        </view>
        <text class="drill-card-desc">{{d.description}}</text>
        <view class="drill-card-meta">
          <text>📅 {{d.date}}</text><text>📍 {{d.location}}</text><text>👤 {{d.organizerName}}</text><text>{{d.currentParticipants}}/{{d.maxParticipants}}人</text><text>🎁 +{{d.pointsReward}}分</text>
        </view>
        <view class="drill-card-actions">
          <view v-if="d.status==='upcoming'" class="drill-btn" @click="join(d)">🤝 报名</view>
          <view v-if="d.status==='upcoming' && d.organizerId===userStore.profile.id" class="drill-btn complete" @click="complete(d)">✅ 完成演习</view>
        </view>
      </view>
      <view v-if="displayDrills.length===0 && tab!=='records'" class="drill-empty">{{tab==='completed'?'暂无已完成演习':'暂无演习'}}</view>
    </view>
    <!-- Training Records -->
    <view v-if="tab==='records'" class="drill-list">
      <view v-for="r in records" :key="r.id" class="drill-card">
        <view class="drill-card-top">
          <view class="drill-status-dot" style="background:#34D277"></view>
          <view class="drill-card-body"><text class="drill-card-title">{{scenarioLabel(r.scenario)}}</text><text class="drill-card-scenario">组织者: {{r.organizerName}}</text></view>
          <text class="drill-card-status">已训练</text>
        </view>
        <text class="drill-card-desc">{{r.notes}}</text>
        <view class="drill-card-meta"><text>📅 {{r.date}}</text></view>
      </view>
      <view v-if="records.length===0" class="drill-empty">暂无训练记录</view>
    </view>
    <view class="drill-fab" @click="showCreate=true">📋</view>

    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate=false">
    <div class="modal"><h3>发起演习</h3>
      <label>标题</label><input v-model="form.title">
      <label>描述</label><textarea v-model="form.description"></textarea>
      <label>场景</label><select v-model="form.scenario"><option value="cpr">CPR 心肺复苏</option><option value="aed">AED 使用</option><option value="trauma">创伤急救</option><option value="choking">异物窒息</option><option value="mass">群体伤</option></select>
      <label>日期</label><input type="datetime-local" v-model="form.date">
      <label>地点</label><input v-model="form.location">
      <label>人数上限</label><input type="number" v-model="form.maxParticipants">
      <div class="modal-actions"><button class="btn btn-g" @click="showCreate=false">取消</button><button class="btn btn-p" @click="create">发起</button></div></div></div>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const API = '/api/drill'
const userStore = useUserStore()
const tab = ref<'upcoming'|'completed'|'records'>('upcoming')
const drills = ref<any[]>([])
const records = ref<any[]>([])
const showCreate = ref(false)
const form = ref({ title:'', description:'', scenario:'cpr', date:'', location:'深圳湾公园', maxParticipants:15 })

const displayDrills = computed(() => drills.value.filter(d => d.status === tab.value))

async function load() { try{const r=await fetch(`${API}/events`).then(r=>r.json());drills.value=r.data||[]}catch(e){} }
async function loadRecords() { try{const r=await fetch(`/api/user/training-records?userId=${userStore.profile.id}`).then(r=>r.json());records.value=r.data||[]}catch(e){} }
async function join(d: any) { await fetch(`${API}/events/${d.id}/join`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:userStore.profile.id,userName:userStore.profile.name})}); uni.showToast({title:'已报名',icon:'none'});load() }
async function complete(d: any) { await fetch(`${API}/events/${d.id}/complete`, {method:'PUT'}); uni.showToast({title:'积分已发放',icon:'none'});load() }
async function create() { const f=form.value; await fetch(`${API}/events`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,organizerId:userStore.profile.id,organizerName:userStore.profile.name,lat:22.517,lng:113.947})}); showCreate.value=false;uni.showToast({title:'已创建',icon:'none'});load() }
function statusColor(s:string) { return {upcoming:'#4A90E2',completed:'#8E8E8E'}[s]||'#6B7280' }
function statusLabel(s:string) { return {upcoming:'即将开始',completed:'已完成'}[s]||s }
function scenarioLabel(s:string) { return {cpr:'CPR 心肺复苏',aed:'AED 使用',trauma:'创伤急救',choking:'异物窒息',mass:'群体伤'}[s]||s }
onMounted(load)
</script>

<style lang="scss" scoped>
.page-drill{padding-bottom:80rpx}
.drill-tabs{display:flex;gap:12rpx;padding:20rpx 40rpx}
.drill-tab{padding:14rpx 28rpx;border-radius:32rpx;font-size:24rpx;border:1px solid var(--line);color:var(--ink-mute)}
.drill-tab.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.drill-header{padding:60rpx 40rpx 24rpx;background:linear-gradient(180deg,#FFF3E0,transparent)}
.drill-title{font-family:var(--serif);font-size:44rpx;font-weight:900}
.drill-list{padding:0 40rpx;display:flex;flex-direction:column;gap:16rpx}
.drill-card{background:#fff;border:1px solid var(--line);border-radius:20rpx;padding:24rpx}
.drill-card-top{display:flex;align-items:center;gap:12rpx}
.drill-status-dot{width:12rpx;height:12rpx;border-radius:50%;flex-shrink:0}
.drill-card-body{flex:1}.drill-card-title{font-size:28rpx;font-weight:700;display:block}.drill-card-scenario{font-size:20rpx;color:var(--ink-mute)}
.drill-card-status{font-size:20rpx;font-family:var(--mono)}
.drill-card-desc{font-size:22rpx;color:var(--ink-mute);margin-top:8rpx;display:block}
.drill-card-meta{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:12rpx;padding-top:12rpx;border-top:1px solid var(--line);font-size:18rpx;color:var(--ink-mute)}
.drill-card-actions{margin-top:12rpx;display:flex;gap:12rpx}
.drill-btn{padding:12rpx 24rpx;border-radius:20rpx;font-size:22rpx;font-weight:600;background:var(--rescue-red-soft);color:var(--rescue-red);display:inline-block}
.drill-btn.complete{background:#D1FAE5;color:#065F46}
.drill-fab{position:fixed;bottom:28rpx;right:28rpx;width:52px;height:52px;border-radius:50%;background:#F59E0B;color:#fff;font-size:24rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 4rpx 16rpx rgba(245,158,11,0.4)}
.drill-empty{padding:80rpx;text-align:center;color:var(--ink-mute);font-size:22rpx}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:#fff;border-radius:16rpx;padding:28rpx;width:90%;max-width:400rpx;box-shadow:0 8rpx 40rpx rgba(0,0,0,0.15)}
.modal h3{font-size:17px;margin-bottom:16rpx}.modal label{display:block;font-size:12px;color:#8E8E8E;margin-bottom:6rpx}
.modal input,.modal select,.modal textarea{width:100%;padding:10rpx 12rpx;border:1px solid #E5E5E0;border-radius:8rpx;font-size:13px;margin-bottom:14rpx;font-family:inherit}.modal textarea{resize:vertical;min-height:50rpx}
.modal-actions{display:flex;gap:10rpx;justify-content:flex-end}
.btn{padding:10rpx 20rpx;border-radius:8rpx;font-size:13px;cursor:pointer;border:none}.btn-p{background:#C0392B;color:#fff}.btn-g{background:transparent;color:#8E8E8E}
</style>
