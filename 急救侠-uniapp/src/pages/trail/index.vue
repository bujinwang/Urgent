<template>
  <view class="page-trail">
    <view class="trail-header"><text class="trail-title">徒友社区</text></view>
    <view class="trail-tabs">
      <view class="trail-tab" :class="{active:tab==='hikers'}" @click="tab='hikers';loadHikers()">徒友排行</view>
      <view class="trail-tab" :class="{active:tab==='events'}" @click="tab='events';loadEvents()">徒步活动</view>
    </view>

    <!-- Hikers Leaderboard -->
    <view v-if="tab==='hikers'" class="trail-list">
      <view v-for="(h,i) in hikers" :key="h.userId" class="trail-item">
        <text class="trail-rank" :class="rankClass(i)">{{ i+1 }}</text>
        <view class="trail-avatar" :style="{background:tierGradient(h.tier)}">{{h.avatar}}</view>
        <view class="trail-body">
          <view class="trail-name-row"><text class="trail-name">{{h.userName}}</text><view class="trail-badge">{{h.badge}}</view></view>
          <text class="trail-sub">{{h.totalDistance}}km · ↑{{h.totalElevation}}m · {{h.hikesCompleted}}次</text>
        </view>
        <text class="trail-longest">最长 {{h.longestHike}}km</text>
      </view>
      <view v-if="hikers.length===0" class="trail-empty">暂无徒友数据</view>
    </view>

    <!-- Trail Events -->
    <view v-if="tab==='events'" class="trail-list">
      <view v-for="e in events" :key="e.id" class="trail-card">
        <view class="trail-card-top">
          <text class="trail-card-title">{{e.title}}</text>
          <text class="trail-card-diff" :class="e.difficulty">{{diffLabel(e.difficulty)}}</text>
        </view>
        <text class="trail-card-desc">{{e.description}}</text>
        <view class="trail-card-meta">
          <text>📏 {{e.route}}</text>
          <text>📐 {{e.distance}}km · ↑{{e.elevation}}m</text>
          <text>📅 {{e.date}}</text>
          <text>📍 {{e.meetingPoint}}</text>
          <text>👤 {{e.organizerName}} · {{e.currentParticipants}}/{{e.maxParticipants}}人</text>
        </view>
        <view class="trail-card-actions">
          <view class="trail-btn" @click="join(e)">🤝 报名参加</view>
        </view>
      </view>
      <view v-if="events.length===0" class="trail-empty">暂无徒步活动</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const API = '/api/trail'
const userStore = useUserStore()
const tab = ref<'hikers'|'events'>('hikers')
const hikers = ref<any[]>([])
const events = ref<any[]>([])

async function loadHikers() {
  try{const r=await fetch(`${API}/hikers`).then(r=>r.json());hikers.value=r.data||[]}catch(e){}
}
async function loadEvents() {
  try{const r=await fetch(`${API}/events`).then(r=>r.json());events.value=r.data||[]}catch(e){}
}
async function join(e: any) {
  await fetch(`${API}/events/${e.id}/join`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:userStore.profile.id,userName:userStore.profile.name})})
  uni.showToast({title:'已报名',icon:'none'});loadEvents()
}

function rankClass(i: number) { return i===0?'top1':i===1?'top2':i===2?'top3':'' }
function tierGradient(t: string) { return {gold:'linear-gradient(135deg,#D4A017,#8B6914)',silver:'linear-gradient(135deg,#8BA3B5,#5A6B78)',bronze:'linear-gradient(135deg,#B87333,#8B5220)',diamond:'linear-gradient(135deg,#4A90E2,#2563EB)'}[t]||'' }
function diffLabel(d: string) { return {easy:'简单',moderate:'中等',hard:'困难'}[d]||d }
onMounted(loadHikers)
</script>

<style lang="scss" scoped>
.page-trail{padding-bottom:60rpx}
.trail-header{padding:60rpx 40rpx 24rpx;background:linear-gradient(180deg,#E8F5E9,transparent)}
.trail-title{font-family:var(--serif);font-size:44rpx;font-weight:900}
.trail-tabs{display:flex;gap:12rpx;padding:20rpx 40rpx}
.trail-tab{padding:14rpx 28rpx;border-radius:32rpx;font-size:24rpx;border:1px solid var(--line);color:var(--ink-mute)}
.trail-tab.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.trail-list{padding:0 40rpx}
.trail-item{display:flex;align-items:center;gap:16rpx;padding:20rpx 0;border-bottom:1px solid var(--line)}
.trail-rank{width:48rpx;font-family:var(--mono);font-size:28rpx;font-weight:700;color:var(--ink-mute);text-align:center;flex-shrink:0}
.trail-rank.top1{color:#D4A017;font-size:36rpx}.trail-rank.top2{color:#8BA3B5;font-size:32rpx}.trail-rank.top3{color:#B87333;font-size:32rpx}
.trail-avatar{width:72rpx;height:72rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:28rpx;flex-shrink:0}
.trail-body{flex:1}.trail-name-row{display:flex;align-items:center;gap:8rpx}
.trail-name{font-size:26rpx;font-weight:600}.trail-badge{padding:2rpx 12rpx;border-radius:10rpx;font-size:18rpx;background:#FEF3C7;color:#92400E}
.trail-sub{font-size:20rpx;color:var(--ink-mute)}
.trail-longest{font-size:20rpx;color:var(--ink-mute);font-family:var(--mono);flex-shrink:0}
.trail-card{background:#fff;border:1px solid var(--line);border-radius:20rpx;padding:24rpx;margin-bottom:16rpx}
.trail-card-top{display:flex;justify-content:space-between;align-items:center}
.trail-card-title{font-size:28rpx;font-weight:700}.trail-card-diff{font-size:20rpx;padding:4rpx 12rpx;border-radius:10rpx}.trail-card-diff.easy{background:#D1FAE5;color:#065F46}.trail-card-diff.moderate{background:#FEF3C7;color:#92400E}.trail-card-diff.hard{background:#FEE2E2;color:#991B1B}
.trail-card-desc{font-size:22rpx;color:var(--ink-mute);margin-top:8rpx;display:block}
.trail-card-meta{display:flex;flex-wrap:wrap;gap:12rpx;margin-top:14rpx;padding-top:14rpx;border-top:1px solid var(--line);font-size:18rpx;color:var(--ink-mute)}
.trail-card-actions{margin-top:14rpx}.trail-btn{padding:12rpx 24rpx;border-radius:20rpx;font-size:22rpx;font-weight:600;background:#D1FAE5;color:#065F46;display:inline-block}
.trail-empty{padding:80rpx;text-align:center;color:var(--ink-mute);font-size:22rpx}
</style>
