<template>
  <view class="pg">
    <view v-if="task" class="card">
      <view class="ch"><view class="cpulse"/><text class="ctitle">{{task.title}}</text><text v-if="liveCount>0" class="live-indicator">🔴 {{liveCount}}人直播中</text></view>
      <text class="cdesc">{{task.description}}</text>
      <view class="cdetails">
        <view class="cd"><text class="cdl">📍</text><text class="cdv">{{task.address}}</text></view>
        <view class="cd"><text class="cdl">📏</text><text class="cdv">{{task.distance}}m · {{sceneLabel(task.sceneType)}}</text></view>
        <view class="cd" v-if="task.patientAge"><text class="cdl">👤</text><text class="cdv">{{task.patientAge}}岁 {{task.patientGender}}</text></view>
      </view>
      <view class="cp"><view class="cpb"><view class="cpf" :style="{width:progressPct+'%'}"/></view><text class="cpt">{{task.volunteersResponded}}/{{task.volunteersNeeded}} 已响应 · {{task.volunteersEnRoute}} 在路上</text></view>
    </view>

    <view class="stitle">📡 现场动态</view>
    <!-- ★ 空态区分「真的没有更新」与「无权限查看」：403 是**正常的权限状态**，
         不能显示成"暂无现场更新"（那等于告诉用户"现场什么都没发生"）。 -->
    <view v-if="mediaList.length===0" class="empty">{{mediaEmptyText}}</view>
    <view v-for="m in mediaList" :key="m.id" class="mi">
      <view class="mh"><text class="ma">{{m.userAvatar||'?'}}</text><text class="mn">{{m.userName}}</text><text class="mt">{{typeLabel(m.type)}}</text><text class="mtm">{{m.createdAt?.slice(11,16)}}</text></view>
      <text class="mc" v-if="m.content">{{m.content}}</text>
      <image v-if="m.mediaUrl&&(m.type==='photo'||m.type==='video')" :src="m.mediaUrl" class="mm" mode="widthFix" @click="preview(m.mediaUrl)"/>
    </view>

    <view class="pub">
      <input class="pi" :value="msg" @input="msg=uniInputValue($event)" placeholder="输入现场更新..."/>
      <text class="pb" @click="send">发送</text>
      <text class="pc" @click="takePhoto">📸</text>
      <text :class="isLive?'pl live-on':'pl'" @click="toggleLive">{{isLive?'⏹ 结束':'🔴 直播'}}</text>
    </view>
  </view>
</template>
<script setup lang="ts">
import { uniInputValue } from '@/types/uni-events'
import { ref,onMounted,computed } from 'vue';import { useUserStore } from '@/stores/user';import { useTaskStore } from '@/stores/task';import { requestFull } from '@/api/index'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { notifyIfFailed, isForbidden, showToast } from '@/utils/action-feedback'
const { t } = useI18n()
const s=useUserStore(),ts=useTaskStore()
const taskId=ref(''),task=ref<any>(null),mediaList=ref<any[]>([]),msg=ref(''),isLive=ref(false),liveCount=ref(0),liveId=ref('')
/** `GET media` 返回 403（**非该任务参与者**）⇒ 空态改显示权限说明，而不是"暂无现场更新"。 */
const mediaForbidden=ref(false)
const mediaEmptyText=computed(()=>mediaForbidden.value?t('permission.taskParticipant.readMedia'):'暂无现场更新')
const progressPct=computed(()=>{if(!task.value||task.value.volunteersNeeded===0)return 0;return Math.min(100,Math.round((task.value.volunteersResponded/task.value.volunteersNeeded)*100))})
function sceneLabel(s:string){return {outdoor:'户外',office:'办公',road:'道路'}[s]||s}
function typeLabel(t:string){return {text:'💬',photo:'📸',video:'🎬',status:'📊'}[t]||t}

/**
 * 解析当前任务 id —— **三级回退**（优先级从高到低）。
 *
 * 1. `onLoad(options)` 的**路由参数**：**唯一的跳转来源** `pages/home/index.vue:408`
 *    `uni.navigateTo({ url:'/pages/rescue/task-detail?id='+tid })` 的 `id` 在这里。
 *
 *    ⚠️ 原先**完全漏了这一级**：代码只读 `uni.getLaunchOptionsSync()`，而它返回的是
 *    **App 启动参数**（scheme / 推送唤起），**不是** `navigateTo` 的路由参数 ⇒
 *    `id` 被**静默丢弃**，页面永远落到 `ts.tasks[0]`（很可能是**别人**接的任务）。
 *    叠加 P0-2 的「仅该任务参与者可见」后，用户从首页点进详情会直接吃一个莫名其妙的
 *    403 —— 典型的「**既有 bug 被收紧放大**」。
 *
 * 2. `uni.getLaunchOptionsSync()?.query?.id`：推送 / scheme 唤起**确实**依赖它 ⇒ 必须保留。
 * 3. `ts.tasks[0]`：最后的兜底（原逻辑）。
 *
 * ⚠️ 顺带划清边界：**不要**在这里（或 `onMounted` 里）自动调 `acceptMission()` 去"顺手取得
 * 参与者资格" —— 后端 `/task/accept` 每调用一次 `task_volunteers.volunteers_responded + 1`
 * （刻意保留的非幂等行为），用户每进一次详情页就要 +1，且离开页面资格也不成立。
 */
function resolveTaskId(routeOptions?: Record<string, unknown>): string {
  const fromRoute = typeof routeOptions?.id === 'string' ? routeOptions.id : ''
  if (fromRoute) return fromRoute
  const fromLaunch = uni.getLaunchOptionsSync?.()?.query?.id || ''
  if (fromLaunch) return fromLaunch
  return ts.tasks[0]?.id || ''
}

// `onLoad` 在页面初始化时**先于** `onMounted` 触发 ⇒ 路由参数在此先落定
onLoad((options?: Record<string, unknown>) => {
  taskId.value = resolveTaskId(options)
})

onMounted(()=>{
  // 兜底：`onLoad` 未提供路由参数（如 H5 直接打开 / 宿主未传参）⇒ 按同一套回退补齐
  if(!taskId.value) taskId.value = resolveTaskId()
  loadTask();loadMedia()
})
async function loadTask(){const t=ts.tasks.find(t=>t.id===taskId.value);if(t)task.value=t}
/**
 * 拉取现场动态。
 *
 * ★ P0-2：`GET .../media` 加了「仅该任务参与者可见」。原写法 `mediaList = await request(...)`
 * 在 403 时返回 **undefined**（`request()` 只 warn 不抛）⇒ 模板的 `mediaList.length===0`
 * **对 undefined 取 length ⇒ 渲染期 TypeError ⇒ 整页失效**（不是"空列表"，是白屏/崩溃）。
 *
 * 现在：一律给出数组（403 ⇒ `[]` + 空态权限说明，其它失败 ⇒ `[]` + 可见提示）。
 */
async function loadMedia(){
  const res=await requestFull<any[]>({url:`/rescue/mobilizations/${taskId.value}/media`})
  if(res&&res.code===0){mediaForbidden.value=false;mediaList.value=res.data??[];return}
  mediaList.value=[]
  // 403 是**权限状态**不是故障 ⇒ 用空态文案说明（不弹 toast，避免每次进页面都弹）
  mediaForbidden.value=isForbidden(res)
  if(!mediaForbidden.value)showToast(t('common.actionFailed'))
}
async function send(){
  if(!msg.value.trim())return
  const p=s.profile
  // ★ P0-1：`userId` 由服务端从 token 派生，不再从 body 取（userName/userAvatar 服务端仍读取 ⇒ 保留）
  const res=await requestFull({url:`/rescue/mobilizations/${taskId.value}/media`,method:'POST',data:{userName:p.name,userAvatar:p.avatar,type:'text',content:msg.value}})
  // ★ 失败 ⇒ **保留**输入框内容：救援现场一条现场更新被打回却被清空，是不可接受的
  if(notifyIfFailed(res,{forbiddenMessage:t('permission.taskParticipant.writeMedia')}))return
  msg.value='';loadMedia()
}
async function takePhoto(){
  uni.chooseImage({count:1,sourceType:['camera','album'],success:async(res:any)=>{
    const p=s.profile
    const r=await requestFull({url:`/rescue/mobilizations/${taskId.value}/media`,method:'POST',data:{userName:p.name,userAvatar:p.avatar,type:'photo',mediaUrl:res.tempFilePaths[0],content:'📸'}})
    if(notifyIfFailed(r,{forbiddenMessage:t('permission.taskParticipant.writeMedia')}))return
    loadMedia()
  }})
}
function preview(url:string){uni.previewImage({urls:[url]})}

/**
 * 拉取直播人数。
 *
 * ★ 原写法 `liveCount = r.length`：403 时 `r` 是 undefined ⇒ `.length` 抛 TypeError
 * 被 `catch{}` 吞掉 ⇒ 恒显示"0 人直播"（静默）。现在按 code 判定，非法一律 0。
 */
async function loadLive(){
  const res=await requestFull<unknown[]>({url:`/rescue/live/${taskId.value}`})
  if(res&&res.code===0){liveCount.value=res.data?.length??0;return}
  liveCount.value=0
  // 403（非参与者）是权限状态 ⇒ 只显示 0；其它失败才提示"没取到"
  if(!isForbidden(res))showToast(t('common.actionFailed'))
}
async function toggleLive(){
  const p=s.profile
  if(isLive.value){
    if(!liveId.value){isLive.value=false;return}
    const res=await requestFull({url:`/rescue/live/end/${liveId.value}`,method:'POST'})
    // ★ 失败 ⇒ 状态**保持**在直播中（服务端会话还在）：原写法无条件 `isLive=false`，
    // 界面说"已结束"而服务端仍在推流 ⇒ 用户再也停不掉它。
    if(notifyIfFailed(res,{forbiddenMessage:t('permission.taskParticipant.live')}))return
    isLive.value=false;liveId.value='';liveCount.value=Math.max(0,liveCount.value-1);loadMedia()
  }else{
    // ★ 最脏的一处原写法：`isLive=true; liveId=r.id` —— 403 时 `r` 是 undefined ⇒ `r.id`
    // 抛 TypeError，而 UI **已**乐观置 true ⇒ 界面停在"⏹ 结束"、服务端却根本没有直播会话，
    // 状态**永久错乱**（用户再点只会去 end 一个不存在的 id）。现在：**先判 code 再改 UI**。
    const res=await requestFull<{id?:string}>({url:`/rescue/live/${taskId.value}/start`,method:'POST',data:{userName:p.name,userAvatar:p.avatar,deviceInfo:'mobile'}})
    if(notifyIfFailed(res,{forbiddenMessage:t('permission.taskParticipant.live')}))return
    isLive.value=true;liveId.value=res.data?.id||'';liveCount.value++;loadMedia()
  }
}

onMounted(()=>{loadLive()})
</script>
<style scoped>
.pg{min-height:100vh;background:#F8F8F6;padding-bottom:140rpx}
.card{margin:16rpx 20rpx;padding:20rpx 24rpx;background:linear-gradient(135deg,#2C1810,#1A0F08);border:1px solid rgba(192,57,43,.3);border-radius:20rpx}.ch{display:flex;align-items:center;gap:10rpx;margin-bottom:10rpx}.cpulse{width:14rpx;height:14rpx;border-radius:50%;background:#E63946;animation:pulse 1s infinite}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(2)}}.ctitle{font-size:28rpx;font-weight:800;color:#fff;flex:1}.cdesc{font-size:22rpx;color:rgba(255,255,255,.7);display:block;margin-bottom:10rpx;line-height:1.5}.cdetails{margin-bottom:10rpx}.cd{display:flex;align-items:center;gap:8rpx;margin-bottom:6rpx}.cdl{font-size:22rpx}.cdv{font-size:20rpx;color:rgba(255,255,255,.6)}.cp{margin-top:10rpx}.cpb{height:8rpx;background:rgba(255,255,255,.1);border-radius:4rpx;overflow:hidden;margin-bottom:6rpx}.cpf{height:100%;background:linear-gradient(90deg,#E63946,#FF6B6B);border-radius:4rpx}.cpt{font-size:20rpx;color:rgba(255,255,255,.5)}
.stitle{font-size:28rpx;font-weight:700;padding:20rpx 20rpx 12rpx}.empty{text-align:center;padding:40rpx;color:#999}
.mi{padding:16rpx 20rpx;border-bottom:1px solid #eee}.mh{display:flex;align-items:center;gap:10rpx;margin-bottom:6rpx}.ma{width:40rpx;height:40rpx;border-radius:50%;background:#C0392B;display:flex;align-items:center;justify-content:center;font-size:20rpx;color:#fff}.mn{font-size:24rpx;font-weight:600}.mt{font-size:18rpx;color:var(--ink-mute);margin-left:auto}.mtm{font-size:18rpx;color:var(--ink-mute)}.mc{font-size:26rpx;display:block;margin-bottom:8rpx;line-height:1.5}.mm{width:100%;border-radius:12rpx}
.pub{position:fixed;bottom:0;left:0;right:0;display:flex;align-items:center;gap:12rpx;padding:12rpx 16rpx;background:#fff;border-top:1px solid #eee;box-shadow:0 -2rpx 12rpx rgba(0,0,0,.06)}.pi{flex:1;height:40px;border:1px solid #ddd;border-radius:20rpx;padding:0 16rpx;font-size:24rpx;background:#f5f5f5;box-sizing:border-box}.live-indicator{font-size:18rpx;color:#FF6B6B;background:rgba(255,107,107,.15);padding:2rpx 10rpx;border-radius:10rpx;margin-left:auto;flex-shrink:0}
.pb{padding:10rpx 24rpx;background:#C0392B;color:#fff;border-radius:24rpx;font-size:24rpx;font-weight:600}.pc{font-size:36rpx}
.pl{padding:10rpx 16rpx;border-radius:24rpx;font-size:22rpx;font-weight:600;background:#f0f0f0;color:#666}.live-on{background:#E63946;color:#fff;animation:livePulse 2s infinite}@keyframes livePulse{0%,100%{opacity:1}50%{opacity:.6}}
</style>
