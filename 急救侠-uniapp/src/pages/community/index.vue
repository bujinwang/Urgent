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
import { request, requestFull } from '@/api'
import { notifyIfFailed } from '@/utils/action-feedback'

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

/**
 * 读列表：P0-2 起 `/community/nearby` 与 `/community/groups` 都要求登录，
 * 而裸 `fetch` **不带 `Authorization`** ⇒ 一律 401；原写法还用 `catch{}` 空吞 ⇒
 * 用户只看到"附近没有志愿者 / 暂无群组"，**以为真的没数据**（静默降级）。
 *
 * 现在：改用 `requestFull` 判业务码，失败**必须有可见反馈**（403 说"无权"，
 * 其它说"失败请重试"），列表置空 —— 空列表本身不再伪装成"确实没有"。
 */
async function loadNearby() {
  const res = await requestFull<any[]>({ url:'/community/nearby?lat=22.517&lng=113.947&radius=10000' })
  if (notifyIfFailed(res)) { nearby.value = []; return }
  nearby.value = (res.data||[]).filter((v:any)=>v.userId!==userStore.profile.id)
}
async function loadGroups() {
  const res = await requestFull<any[]>({ url:'/community/groups' })
  if (notifyIfFailed(res)) { groups.value = []; return }
  groups.value = res.data||[]
}
// ★ P0-1：`GET /community/messages` 已改为只返回**调用者本人**的私信，**不再接受 `?userId=`**
// （此前换任意 userId 即可读他人私信正文）。身份由 token 决定 ⇒ 去掉 query，并改用 request。
async function loadMessages() {
  try{ allMessages.value = await request<any[]>({ url:'/community/messages' }) ?? [] }catch(e){}
}

/**
 * 发私信（联系志愿者 / 回复会话共用）。
 *
 * ★ P0-2：原来是无条件 `showToast('已发送')` —— `request()` 在 401/403 时
 * **只 `console.warn` 不抛错** ⇒ 服务端根本没收下，界面却说已发送（假成功）。
 * 现在先判 code，成功才弹。
 */
async function sendMessage(toUserId: string, content: string): Promise<void> {
  // ★ P0-1：`fromUserId` 由服务端从 token 派生，不再从 body 取（留着会误导以为生效）
  const res = await requestFull({
    url:'/community/messages', method:'POST',
    data:{ fromUserName:userStore.profile.name, toUserId, content },
  })
  if (notifyIfFailed(res)) return
  uni.showToast({title:'已发送',icon:'none'})
}

function contactUser(v: any) {
  uni.showModal({ title: `联系 ${v.userName}`, editable: true, placeholderText: '输入消息', success: (res) => {
    if (res.confirm && res.content) void sendMessage(v.userId, res.content)
  }})
}
function openGroup(g: any) {
  uni.showModal({ title: g.name, content: `${g.description}\n${g.memberCount} 名成员`, confirmText: '加入', cancelText: '关闭', success: (res) => {
    if (res.confirm) void joinGroup(g)
  }})
}
/**
 * 加入群组。
 *
 * ★ P0-2 最典型的一处：原来是**裸 `fetch`**（无 token）+ 无条件 `showToast('已加入')`
 * ⇒ 端点加鉴权后会变成"加群从未发生，界面报已加入"，且**永远不可自愈**
 * （用户以为已在群里，不会再点第二次）。现在改成 `requestFull` + `notifyIfFailed`。
 */
async function joinGroup(g: any): Promise<void> {
  // ★ `userId` 已由服务端从 token 派生（死字段，留着会误导以为生效）⇒ 只传展示名
  const res = await requestFull({
    url:`/community/groups/${g.id}/join`, method:'POST',
    data:{ userName:userStore.profile.name },
  })
  if (notifyIfFailed(res)) return
  uni.showToast({title:'已加入',icon:'none'})
}
function openChat(thread: any) {
  uni.showModal({ title: `与 ${thread.peerName} 的对话`, content: `最近消息: ${thread.lastContent}`, confirmText: '回复', cancelText: '关闭', editable: true, placeholderText: '输入回复', success: (res) => {
    if (res.confirm && res.content) void sendMessage(thread.peerId, res.content)
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
