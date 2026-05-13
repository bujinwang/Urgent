<template>
  <view class="page-community">
    <view class="comm-header"><text class="comm-title">社区</text></view>

    <!-- Tabs -->
    <view class="comm-tabs">
      <view class="comm-tab" :class="{active:tab==='nearby'}" @click="tab='nearby'">附近的人</view>
      <view class="comm-tab" :class="{active:tab==='groups'}" @click="tab='groups';loadGroups()">群组</view>
      <view class="comm-tab" :class="{active:tab==='msgs'}" @click="tab='msgs';loadMessages()">消息</view>
    </view>

    <!-- Nearby Volunteers -->
    <view v-if="tab==='nearby'" class="comm-list">
      <view v-if="nearby.length===0" class="comm-empty">开启位置后可发现附近的急救志愿者</view>
      <view v-for="v in nearby" :key="v.userId" class="comm-item" @click="contactUser(v)">
        <view class="comm-avatar" :style="{background:tierGradient(v.tier)}">{{v.userName[0]}}</view>
        <view class="comm-body"><text class="comm-name">{{v.userName}}</text><text class="comm-sub">{{tierLabel(v.tier)}} · {{v.rescueCount}}次救援</text></view>
        <text class="comm-action">💬</text>
      </view>
    </view>

    <!-- Groups -->
    <view v-if="tab==='groups'" class="comm-list">
      <view v-for="g in groups" :key="g.id" class="comm-item" @click="openGroup(g)">
        <view class="comm-avatar" style="background:linear-gradient(135deg,#4A90E2,#2563EB)">👥</view>
        <view class="comm-body"><text class="comm-name">{{g.name}}</text><text class="comm-sub">{{g.description}} · {{g.memberCount}}人</text></view>
        <text class="comm-action">→</text>
      </view>
      <view v-if="groups.length===0" class="comm-empty">暂无群组</view>
    </view>

    <!-- Messages -->
    <view v-if="tab==='msgs'" class="comm-list">
      <view v-for="m in messageThreads" :key="m.peerId" class="comm-item" @click="openChat(m)">
        <view class="comm-avatar" :style="{background:'linear-gradient(135deg,#D4A017,#8B6914)'}">{{m.peerName[0]}}</view>
        <view class="comm-body"><text class="comm-name">{{m.peerName}}</text><text class="comm-sub">{{m.lastContent}}</text></view>
        <view v-if="m.unread" class="comm-badge">{{m.unread}}</view>
      </view>
      <view v-if="messageThreads.length===0" class="comm-empty">暂无消息</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const API = 'http://localhost:3001/api/community'
const userStore = useUserStore()
const tab = ref<'nearby'|'groups'|'msgs'>('nearby')
const nearby = ref<any[]>([])
const groups = ref<any[]>([])
const allMessages = ref<any[]>([])

// Group message threads by peer
const messageThreads = computed(() => {
  const threads = new Map<string, any>()
  for (const m of allMessages.value) {
    const peerId = m.fromUserId === userStore.profile.id ? m.toUserId : m.fromUserId
    const peerName = m.fromUserId === userStore.profile.id ? '→ ' + (m.toUserId||'') : m.fromUserName
    if (!threads.has(peerId)) {
      threads.set(peerId, { peerId, peerName, lastContent: m.content, unread: 0 })
    }
    if (m.toUserId === userStore.profile.id && !m.isRead) threads.get(peerId).unread++
  }
  return [...threads.values()]
})

async function loadNearby() {
  try {
    const r = await fetch(`${API}/nearby?lat=22.517&lng=113.947&radius=10000`).then(r=>r.json())
    nearby.value = (r.data||[]).filter((v:any)=>v.userId!==userStore.profile.id)
  } catch(e){}
}
async function loadGroups() {
  try{const r=await fetch(`${API}/groups`).then(r=>r.json());groups.value=r.data||[]}catch(e){}
}
async function loadMessages() {
  try{const r=await fetch(`${API}/messages?userId=${userStore.profile.id}`).then(r=>r.json());allMessages.value=r.data||[]}catch(e){}
}

function contactUser(v: any) {
  uni.showModal({ title: `联系 ${v.userName}`, editable: true, placeholderText: '输入消息', success: async (res) => {
    if (res.confirm && res.content) {
      await fetch(`${API}/messages`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromUserId:userStore.profile.id,fromUserName:userStore.profile.name,toUserId:v.userId,content:res.content})})
      uni.showToast({title:'已发送',icon:'none'})
    }
  }})
}
function openGroup(g: any) {
  uni.showModal({ title: g.name, content: `${g.description}\n${g.memberCount} 名成员`, confirmText: '加入', cancelText: '关闭', success: async (res) => {
    if (res.confirm) {
      await fetch(`${API}/groups/${g.id}/join`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:userStore.profile.id,userName:userStore.profile.name})})
      uni.showToast({title:'已加入',icon:'none'})
    }
  }})
}
function openChat(thread: any) {
  uni.showModal({ title: `与 ${thread.peerName} 的对话`, content: `最近消息: ${thread.lastContent}`, confirmText: '回复', cancelText: '关闭', editable: true, placeholderText: '输入回复', success: async (res) => {
    if (res.confirm && res.content) {
      await fetch(`${API}/messages`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromUserId:userStore.profile.id,fromUserName:userStore.profile.name,toUserId:thread.peerId,content:res.content})})
      uni.showToast({title:'已发送',icon:'none'})
    }
  }})
}

function tierLabel(t: string) { return {gold:'金牌',silver:'银牌',bronze:'铜牌',diamond:'钻石'}[t]||t }
function tierGradient(t: string) { return {gold:'linear-gradient(135deg,#D4A017,#8B6914)',silver:'linear-gradient(135deg,#8BA3B5,#5A6B78)',bronze:'linear-gradient(135deg,#B87333,#8B5220)',diamond:'linear-gradient(135deg,#4A90E2,#2563EB)'}[t]||'' }

onMounted(loadNearby)
</script>

<style lang="scss" scoped>
.page-community{padding-bottom:60rpx}
.comm-header{padding:60rpx 40rpx 24rpx;background:linear-gradient(180deg,#E8F5E9,transparent)}
.comm-title{font-family:var(--serif);font-size:44rpx;font-weight:900}
.comm-tabs{display:flex;gap:12rpx;padding:20rpx 40rpx}
.comm-tab{padding:14rpx 28rpx;border-radius:32rpx;font-size:24rpx;border:1px solid var(--line);color:var(--ink-mute)}
.comm-tab.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.comm-list{padding:0 40rpx}
.comm-item{display:flex;align-items:center;gap:20rpx;padding:24rpx 0;border-bottom:1px solid var(--line)}
.comm-avatar{width:80rpx;height:80rpx;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:32rpx;flex-shrink:0}
.comm-body{flex:1}.comm-name{font-size:26rpx;font-weight:600;display:block}.comm-sub{font-size:20rpx;color:var(--ink-mute)}
.comm-action{font-size:28rpx;flex-shrink:0}
.comm-badge{background:var(--rescue-red);color:#fff;font-size:18rpx;padding:4rpx 12rpx;border-radius:20rpx;font-weight:700}
.comm-empty{padding:80rpx 40rpx;text-align:center;color:var(--ink-mute);font-size:22rpx}
</style>
