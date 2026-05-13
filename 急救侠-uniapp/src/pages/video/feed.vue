<template>
  <view class="pg">
    <view class="topbar">
      <text class="logo">急救侠 · 视频</text>
      <view class="tag-row">
        <text v-for="t in tags" :key="t" :class="tagCls(t)" @click="curTag=t">{{t}}</text>
      </view>
    </view>

    <view class="list">
      <view v-if="videos.length===0" class="empty">暂无视频，下拉刷新</view>
      <view v-for="v in videos" :key="v.id" class="card">
        <view class="thumb" :style="{background:v.thumbnail?'url('+v.thumbnail+') center/cover':'linear-gradient(135deg,#2C3E50,#1A2530)'}">
          <view v-if="v.isLive" class="live-badge">🔴 LIVE</view>
        </view>
        <view class="body">
          <view class="user-row">
            <text class="avatar">{{v.userAvatar||'?'}}</text>
            <text class="uname">{{v.userName}}</text>
          </view>
          <text class="title">{{v.title||'无标题'}}</text>
          <text class="desc" v-if="v.description">{{v.description}}</text>
          <view class="actions">
            <view class="act" @click="view(v)">👁 {{v.viewCount||0}}</view>
            <view class="act" @click="like(v)">❤️ {{v.likeCount||0}}</view>
          </view>
        </view>
      </view>
    </view>

    <view class="fab" @click="showPub=!showPub">{{showPub?'✕':'＋'}}</view>

    <view v-if="showPub" class="mask" @click="showPub=false"><view class="modal" @click.stop>
      <text class="mt">发起直播</text>
      <input class="mi" :value="pubTitle" @input="pubTitle=$event.detail?.value??$event.target?.value??''" placeholder="直播标题" />
      <input class="mi" :value="pubDesc" @input="pubDesc=$event.detail?.value??$event.target?.value??''" placeholder="直播描述" />
      <view class="btn" @click="publish">发布</view>
    </view></view>
  </view>
</template>

<script setup lang="ts">
import { ref,onMounted } from 'vue';import { useUserStore } from '@/stores/user';import { request } from '@/api/index'
const s=useUserStore()
const curTag=ref('全部'), tags=['全部','急救现场','CPR训练','动物救助','户外徒步'], videos=ref<any[]>([])
const showPub=ref(false),pubTitle=ref(''),pubDesc=ref('')

onMounted(load)
async function load(){try{videos.value=await request({url:'/video/feed'})}catch{}}
function tagCls(t:string){return 'tag'+(curTag.value===t?' act':'')}

async function view(v:any){try{await request({url:`/video/${v.id}/view`,method:'POST'});v.viewCount++}catch{}}
async function like(v:any){try{await request({url:`/video/${v.id}/like`,method:'POST'});v.likeCount++}catch{}}

async function publish(){
  if(!pubTitle.value){uni.showToast({title:'请输入标题',icon:'none'});return}
  const p = s.profile
  await request({url:'/video',method:'POST',data:{userId:p.id,userName:p.name,userAvatar:p.avatar,title:pubTitle.value,description:pubDesc.value}})
  uni.showToast({title:'已发布',icon:'success'});showPub.value=false;pubTitle.value=pubDesc.value='';load()
}
</script>

<style scoped>
.pg{padding-bottom:120rpx;background:#111;min-height:100vh}
.topbar{padding:20rpx 24rpx;background:#1A1A2E;position:sticky;top:0;z-index:10}
.logo{font-size:36rpx;font-weight:900;color:#fff;font-family:serif;display:block;margin-bottom:12rpx}
.tag-row{display:flex;gap:12rpx}.tag{padding:6rpx 18rpx;border-radius:16rpx;font-size:22rpx;background:rgba(255,255,255,.08);color:#aaa}.tag.act{background:#E63946;color:#fff}
.list{padding:12rpx 20rpx}
.empty{text-align:center;padding:120rpx 0;color:#666;font-size:24rpx}
.card{border-radius:16rpx;overflow:hidden;margin-bottom:20rpx;background:#1E1E30}
.thumb{height:360rpx;display:flex;align-items:flex-end;justify-content:flex-start;padding:16rpx}
.live-badge{background:#E63946;color:#fff;padding:4rpx 14rpx;border-radius:12rpx;font-size:20rpx;font-weight:700}
.body{padding:20rpx}.user-row{display:flex;align-items:center;gap:10rpx;margin-bottom:10rpx}
.avatar{width:48rpx;height:48rpx;border-radius:50%;background:#E63946;display:flex;align-items:center;justify-content:center;font-size:24rpx;color:#fff;font-weight:700}.uname{font-size:24rpx;color:#ccc;font-weight:600}
.title{font-size:30rpx;color:#fff;font-weight:700;display:block;margin-bottom:6rpx}.desc{font-size:22rpx;color:#999;display:block;margin-bottom:12rpx}
.actions{display:flex;gap:24rpx}.act{font-size:22rpx;color:#888;display:flex;align-items:center;gap:4rpx}
.fab{position:fixed;right:28rpx;bottom:80rpx;width:88rpx;height:88rpx;border-radius:50%;background:#E63946;color:#fff;display:flex;align-items:center;justify-content:center;font-size:40rpx;box-shadow:0 8rpx 32rpx rgba(230,57,70,.5);z-index:50}
.mask{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;z-index:100}
.modal{background:#1E1E30;border-radius:24rpx 24rpx 0 0;padding:32rpx;width:100%;max-width:600rpx}
.mt{font-size:32rpx;font-weight:900;color:#fff;display:block;margin-bottom:20rpx}
.mi{width:100%;height:48px;border:1px solid #333;border-radius:10rpx;padding:0 16rpx;font-size:28rpx;color:#fff;background:#111;box-sizing:border-box;margin-bottom:16rpx}
.btn{background:#E63946;color:#fff;text-align:center;padding:24rpx;border-radius:48rpx;font-size:28rpx;font-weight:700;margin-top:12rpx}
</style>
