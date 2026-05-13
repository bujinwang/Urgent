<template>
  <view class="page-animal">
    <view class="am-header"><text class="am-title">🐾 动物档案</text></view>
    <view class="am-list">
      <view v-for="a in animals" :key="a.id" class="am-card" @click="openDetail(a)">
        <view class="am-card-top">
          <text class="am-name">{{a.name||'未命名'}}</text>
          <text class="am-status" :style="{color:a.status==='stray'?'#F59E0B':'#34D277'}">{{a.status==='stray'?'流浪中':'已救助'}}</text>
        </view>
        <text class="am-species">{{a.species}} · {{a.color}} · {{a.size}}</text>
        <text class="am-features" v-if="a.features">{{a.features}}</text>
        <view class="am-meta"><text>📍 {{a.location}}</text><text>📅 {{a.createdAt?.slice(0,10)}}</text></view>
      </view>
      <view v-if="animals.length===0" class="am-empty">暂无动物档案</view>
    </view>
    <view class="am-fab" @click="showCreate=true">➕</view>

    <!-- Detail Modal -->
    <div v-if="detail" class="modal-overlay" @click.self="detail=null">
    <div class="modal" style="max-width:500px;max-height:85vh;overflow-y:auto">
      <h3>{{detail.name||'未命名'}} <button class="btn btn-g" style="float:right;font-size:18px" @click="detail=null">✕</button></h3>
      <div style="font-size:12px;line-height:2">
        <div>物种: {{detail.species}} · {{detail.color}} · {{detail.size}}</div>
        <div v-if="detail.features">特征: {{detail.features}}</div>
        <div>位置: {{detail.location}}</div>
        <div>状态: {{detail.status==='stray'?'流浪中':'已救助'}}</div>
      </div>
      <div class="am-tabs" style="margin-top:16px">
        <view class="am-tab" :class="{active:dt==='care'}" @click="dt='care'">照料记录</view>
        <view class="am-tab" :class="{active:dt==='health'}" @click="dt='health'">健康检查</view>
      </div>
      <div v-if="dt==='care'">
        <div v-if="detail.careRecords?.length" v-for="c in detail.careRecords" :key="c.id" class="am-record">
          <text class="am-rec-type">{{careLabel(c.careType)}}</text>
          <text class="am-rec-desc">{{c.description}}</text>
          <text class="am-rec-meta">{{c.userName}} · {{c.createdAt?.slice(0,16)}}</text>
        </div>
        <div v-else class="am-empty">暂无</div>
        <button class="btn btn-p btn-sm" style="margin-top:8px" @click="logCare">📝 记录照料</button>
      </div>
      <div v-if="dt==='health'">
        <div v-if="detail.healthRecords?.length" v-for="h in detail.healthRecords" :key="h.id" class="am-record">
          <text class="am-rec-type">{{h.checkType==='general'?'常规检查':h.checkType}}</text>
          <text class="am-rec-desc">{{h.findings}}</text>
          <text class="am-rec-meta">{{h.vetName}} · {{h.userName}} · {{h.createdAt?.slice(0,16)}}</text>
        </div>
        <div v-else class="am-empty">暂无</div>
      </div>
    </div></div>

    <!-- Create Modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate=false">
    <div class="modal"><h3>新建动物档案</h3>
      <label>名字/昵称</label><input v-model="form.name" placeholder="如：小橘">
      <label>物种</label><input v-model="form.species" placeholder="如：橘猫">
      <label>颜色</label><input v-model="form.color" placeholder="如：橘色白腹">
      <label>体型</label><select v-model="form.size"><option value="小型">小型</option><option value="中型">中型</option><option value="大型">大型</option></select>
      <label>识别特征</label><input v-model="form.features" placeholder="如：左耳缺口，尾尖弯曲">
      <label>常驻位置</label><input v-model="form.location" placeholder="如：南山社区北门">
      <div class="modal-actions"><button class="btn btn-g" @click="showCreate=false">取消</button><button class="btn btn-p" @click="create">创建</button></div></div></div>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
const U='/api',userStore=useUserStore()
const animals=ref<any[]>([]),detail=ref<any>(null),dt=ref('care'),showCreate=ref(false)
const form=ref({name:'',species:'',color:'',size:'中型',features:'',location:''})

async function load(){try{animals.value=(await fetch(`${U}/animals`).then(r=>r.json())).data||[]}catch(e){}}
async function openDetail(a:any){const r=await fetch(`${U}/animals/${a.id}`).then(r=>r.json());detail.value=r.data;dt.value='care'}
async function create(){const f=form.value;await fetch(`${U}/animals`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,createdBy:userStore.profile.id,lat:22.517,lng:113.947})});showCreate.value=false;load()}
async function logCare(){if(!detail.value)return;uni.showModal({title:'记录照料',editable:true,placeholderText:'描述',success:async(res)=>{if(res.confirm&&res.content){await fetch(`${U}/animals/${detail.value.id}/care`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:userStore.profile.id,userName:userStore.profile.name,careType:'feeding',description:res.content})});openDetail(detail.value)}}})}
function careLabel(t:string){return{feeding:'🍽 喂食',checkup:'🔍 观察',treatment:'💊 治疗',transport:'🚗 转运',other:'📝 其他'}[t]||t}
onMounted(load)
</script>

<style lang="scss" scoped>
.page-animal{padding-bottom:80rpx}.am-header{padding:60rpx 40rpx 24rpx;background:linear-gradient(180deg,#FFF3E0,transparent)}.am-title{font-family:var(--serif);font-size:44rpx;font-weight:900}
.am-list{padding:0 40rpx;display:flex;flex-direction:column;gap:16rpx}
.am-card{background:#fff;border:1px solid var(--line);border-radius:16rpx;padding:20rpx}
.am-card-top{display:flex;justify-content:space-between}.am-name{font-size:28rpx;font-weight:700}.am-status{font-size:20rpx}.am-species{font-size:22rpx;color:var(--ink-mute);margin-top:4rpx;display:block}.am-features{font-size:18rpx;color:var(--ink-mute);margin-top:4rpx;display:block}.am-meta{display:flex;gap:16rpx;margin-top:10rpx;font-size:18rpx;color:var(--ink-mute)}
.am-tabs{display:flex;gap:8rpx}.am-tab{padding:8rpx 18rpx;border-radius:16rpx;font-size:12px;border:1px solid var(--line);color:var(--ink-mute)}.am-tab.active{background:var(--ink);color:#fff}
.am-record{padding:12rpx 0;border-bottom:1px solid var(--line)}.am-rec-type{font-size:13px;font-weight:600;display:block}.am-rec-desc{font-size:12px;color:var(--ink-mute);margin-top:2rpx;display:block}.am-rec-meta{font-size:10px;color:#aaa;margin-top:2rpx}
.am-fab{position:fixed;bottom:28rpx;right:28rpx;width:52px;height:52px;border-radius:50%;background:#F59E0B;color:#fff;font-size:24rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 4rpx 16rpx rgba(245,158,11,0.4)}.am-empty{padding:80rpx;text-align:center;color:var(--ink-mute);font-size:22rpx}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:#fff;border-radius:16rpx;padding:28rpx;width:90%;max-width:400rpx;box-shadow:0 8rpx 40rpx rgba(0,0,0,0.15)}.modal h3{font-size:17px;margin-bottom:16rpx}.modal label{display:block;font-size:12px;color:#8E8E8E;margin-bottom:6rpx}
.modal input,.modal select{width:100%;padding:10rpx 12rpx;border:1px solid #E5E5E0;border-radius:8rpx;font-size:13px;margin-bottom:14rpx;font-family:inherit}.modal-actions{display:flex;gap:10rpx;justify-content:flex-end}
.btn{padding:10rpx 20rpx;border-radius:8rpx;font-size:13px;cursor:pointer;border:none}.btn-p{background:#10B981;color:#fff}.btn-g{background:transparent;color:#8E8E8E}.btn-sm{padding:6rpx 14rpx;font-size:12px}
</style>
