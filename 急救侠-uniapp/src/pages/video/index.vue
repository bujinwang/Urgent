<template>
  <view class="pg">
    <view class="tab-bar">
      <text v-for="t in tabs" :key="t.key" :class="t.key===activeTab?'tab act':'tab'" @click="switchTab(t.key)">{{t.label}}</text>
    </view>

    <view class="list">
      <view v-if="videos.length===0" class="empty">暂无视频</view>
      <view v-for="v in videos" :key="v.id" class="card">
        <view class="thumb" :style="{background:v.thumbnail?'url('+v.thumbnail+') center/cover':'linear-gradient(135deg,#2C3E50,#1A2530)'}">
          <view class="th-top">
            <text class="dur-tag" v-if="v.duration">{{v.duration}}</text>
            <text class="cat-tag">{{catLabel(v.category)}}</text>
          </view>
          <view class="play-btn" @click="playVideo(v)">▶️</view>
        </view>
        <view class="body">
          <text class="title">{{v.title||'无标题'}}</text>
          <text class="desc" v-if="v.description">{{v.description}}</text>
          <view class="meta">
            <view class="author" @click="goProfile(v.userId)">
              <text class="av">{{v.userAvatar||'?'}}</text>
              <text class="nm">{{v.userName||'志愿者'}}</text>
            </view>
            <view class="stats">
              <text class="st" @click="recordView(v)">▶️ {{fmt(v.viewCount)}}</text>
              <text class="st" @click="doLike(v)">{{v.liked?'❤️':'🤍'}} {{fmt(v.likeCount)}}</text>
              <text class="st">↗️ {{fmt(v.shareCount)}}</text>
            </view>
          </view>
        </view>
      </view>
      <view v-if="loading" class="more">加载中...</view>
    </view>

    <view class="fab" @click="showPub=true">＋</view>

    <view v-if="showPub" class="mask" @click="showPub=false"><view class="modal" @click.stop>
      <text class="mt">发布视频</text>
      <input class="mi" :value="pubTitle" @input="pubTitle=$event.detail?.value??$event.target?.value??''" placeholder="标题" />
      <input class="mi" :value="pubDesc" @input="pubDesc=$event.detail?.value??$event.target?.value??''" placeholder="描述" />
      <view class="mcats">
        <text v-for="c in cats" :key="c" :class="pubCat===c?'cat-sel':'cat-opt'" @click="pubCat=c">{{c}}</text>
      </view>
      <view class="btn" @click="publish">发布</view>
    </view></view>
  </view>
</template>

<script setup lang="ts">
import { ref,onMounted } from 'vue';import { useUserStore } from '@/stores/user';import { request } from '@/api/index'
const s=useUserStore()
const tabs=[{key:'recommend',label:'推荐'},{key:'rescue',label:'救援'},{key:'training',label:'教学'},{key:'animal',label:'动物'},{key:'daily',label:'日常'}]
const cats=['rescue','training','animal','daily']
const activeTab=ref('recommend'),videos=ref<any[]>([]),page=ref(1),loading=ref(false)
const showPub=ref(false),pubTitle=ref(''),pubDesc=ref(''),pubCat=ref('rescue')

onMounted(load)
function catLabel(c:string){return {rescue:'🚨救援',training:'📚教学',animal:'🐾动物',daily:'📱日常'}[c]||c}
function fmt(n:number){return n<1000?String(n):(n/1000).toFixed(1)+'k'}

async function load(){
  loading.value=true
  try{
    const url=activeTab.value==='recommend'?`/video/recommend?page=${page.value}&size=6`:`/video/category/${activeTab.value}?page=${page.value}&size=6`
    const r=await request<any>({url})
    if(r.items){videos.value=page.value===1?r.items:[...videos.value,...r.items];if(r.hasMore)page.value++}
  }catch{}finally{loading.value=false}
}

function switchTab(k:string){activeTab.value=k;page.value=1;load()}

async function recordView(v:any){try{await request({url:`/video/${v.id}/view`,method:'POST'});v.viewCount++}catch{}}
async function doLike(v:any){try{await request({url:`/video/${v.id}/like`,method:'POST'});v.likeCount++;v.liked=true}catch{}}
function playVideo(v:any){uni.showToast({title:'视频播放',icon:'none'});recordView(v)}

async function publish(){
  if(!pubTitle.value){uni.showToast({title:'请输入标题',icon:'none'});return}
  const p=s.profile
  await request({url:'/video',method:'POST',data:{userId:p.id,userName:p.name,userAvatar:p.avatar,title:pubTitle.value,description:pubDesc.value,category:pubCat.value}})
  uni.showToast({title:'已发布',icon:'success'});showPub.value=false;pubTitle.value=pubDesc.value=''
  activeTab.value='recommend';page.value=1;load()
}
</script>

<style scoped>
.pg{min-height:100vh;background:#F8F8F6;padding-bottom:120rpx}
.tab-bar{display:flex;gap:8rpx;padding:16rpx 20rpx;background:#fff;position:sticky;top:0;z-index:10;overflow-x:auto}
.tab{padding:8rpx 20rpx;border-radius:16rpx;font-size:24rpx;background:#F0F0F0;color:#666;white-space:nowrap}.tab.act{background:#C0392B;color:#fff}
.list{padding:12rpx 16rpx}
.empty{text-align:center;padding:120rpx 0;color:#999;font-size:24rpx}
.card{background:#fff;border-radius:16rpx;overflow:hidden;margin-bottom:20rpx;box-shadow:0 2rpx 12rpx rgba(0,0,0,.04)}
.thumb{height:400rpx;display:flex;flex-direction:column;justify-content:space-between;padding:12rpx;position:relative}
.th-top{display:flex;justify-content:space-between}
.dur-tag{background:rgba(0,0,0,.7);color:#fff;padding:2rpx 10rpx;border-radius:8rpx;font-size:20rpx}
.cat-tag{background:rgba(192,57,43,.8);color:#fff;padding:2rpx 10rpx;border-radius:8rpx;font-size:20rpx}
.play-btn{width:64rpx;height:64rpx;border-radius:50%;background:rgba(255,255,255,.85);display:flex;align-items:center;justify-content:center;font-size:28rpx;margin:auto}
.body{padding:20rpx}.title{font-size:28rpx;font-weight:700;display:block;margin-bottom:4rpx}.desc{font-size:22rpx;color:#999;display:block;margin-bottom:12rpx}
.meta{display:flex;align-items:center;justify-content:space-between}.author{display:flex;align-items:center;gap:8rpx}
.av{width:40rpx;height:40rpx;border-radius:50%;background:#C0392B;display:flex;align-items:center;justify-content:center;font-size:20rpx;color:#fff}.nm{font-size:22rpx;font-weight:600}
.stats{display:flex;gap:16rpx;font-size:22rpx;color:#999}.st{display:flex;align-items:center;gap:4rpx}
.more{text-align:center;padding:24rpx;font-size:22rpx;color:#999}
.fab{position:fixed;right:28rpx;bottom:80rpx;width:96rpx;height:96rpx;border-radius:50%;background:#C0392B;color:#fff;display:flex;align-items:center;justify-content:center;font-size:44rpx;font-weight:300;box-shadow:0 8rpx 32rpx rgba(192,57,43,.4);z-index:50}
.mask{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center;z-index:100}
.modal{background:#fff;border-radius:24rpx 24rpx 0 0;padding:32rpx;width:100%;max-width:600rpx}.mt{font-size:32rpx;font-weight:900;display:block;margin-bottom:16rpx}
.mi{width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:14px;box-sizing:border-box;margin-bottom:12px}
.mcats{display:flex;gap:8rpx;flex-wrap:wrap;margin-bottom:12px}.cat-opt{padding:6rpx 16rpx;border-radius:16rpx;font-size:22rpx;background:#F0F0F0;color:#666}.cat-sel{background:#C0392B;color:#fff;padding:6rpx 16rpx;border-radius:16rpx;font-size:22rpx}
.btn{background:#C0392B;color:#fff;text-align:center;padding:20rpx;border-radius:48rpx;font-size:28rpx;font-weight:700}
</style>
