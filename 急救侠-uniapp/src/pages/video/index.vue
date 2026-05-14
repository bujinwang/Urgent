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

    <view v-if="showPub" class="mask" @click="cancelPub"><view class="modal" @click.stop>
      <text class="mt">发布视频</text>

      <!-- 选择/预览视频 -->
      <view v-if="!selVideo" class="pick-area" @click="pickVideo">
        <text class="pick-icon">📹</text>
        <text class="pick-text">点击选择视频</text>
      </view>
      <view v-else class="preview-area">
        <video :src="selVideo.path" class="preview-video" controls />
        <view class="preview-meta">
          <text class="preview-info">时长 {{fmtDuration(selVideo.duration)}} · {{fmtSize(selVideo.size)}}</text>
          <text class="change-btn" @click="resetSel">重新选择</text>
        </view>
      </view>

      <!-- 上传进度 -->
      <view v-if="uploadState==='uploading'" class="progress-area">
        <view class="progress-bar"><view class="progress-fill" :style="{width:uploadProgress+'%'}"/></view>
        <text class="progress-text">上传中 {{uploadProgress}}%</text>
      </view>
      <text v-else-if="uploadState==='done'" class="upload-done">✅ 视频上传完成</text>
      <text v-else-if="uploadState==='fail'" class="upload-fail">❌ 上传失败，点击"发布"重试</text>

      <input class="mi" :value="pubTitle" @input="pubTitle=$event.detail?.value??$event.target?.value??''" placeholder="输入视频标题" />
      <input class="mi" :value="pubDesc" @input="pubDesc=$event.detail?.value??$event.target?.value??''" placeholder="描述（可选）" />
      <view class="mcats">
        <text v-for="c in cats" :key="c" :class="pubCat===c?'cat-sel':'cat-opt'" @click="pubCat=c">{{c}}</text>
      </view>
      <view class="btn" :class="{disabled:!selVideo||uploadState==='uploading'}" @click="publish">
        {{uploadState==='uploading'?'上传中…':uploadState==='done'?'发布':uploadState==='fail'?'重试发布':'发布'}}
      </view>
    </view></view>

    <!-- 全屏播放器（抖音式竖屏滑动） -->
    <view v-if="fsIndex>=0" class="fs-overlay" @touchstart="onFsTouchStart" @touchend="onFsTouchEnd">
      <video
        :id="'fs-player'"
        :src="videos[fsIndex]?.videoUrl||''"
        class="fs-video"
        autoplay
        object-fit="contain"
        :controls="false"
        show-center-play-btn="false"
        @click="toggleFsUi"
        @play="fsPlaying=true"
        @pause="fsPlaying=false"
        @ended="nextVideo"
        @error="fsErr=true"
      />

      <view v-if="!videos[fsIndex]?.videoUrl" class="fs-placeholder">
        <text class="fs-ph-icon">📹</text>
        <text class="fs-ph-text">视频源暂不可用</text>
      </view>

      <view v-if="!fsUiShow" class="fs-swipe-hint">↑ 上下滑动切换</view>

      <view class="fs-top" :class="{fs_hide:!fsUiShow}">
        <view class="fs-back" @click.stop="closeFs"><text>←</text></view>
        <text class="fs-counter">{{fsIndex+1}}/{{videos.length}}</text>
        <view class="fs-back" @click.stop="closeFs"><text style="visibility:hidden">←</text></view>
      </view>

      <view class="fs-bottom" :class="{fs_hide:!fsUiShow}">
        <view class="fs_bl">
          <view class="fs_author" @click.stop="goProfile(videos[fsIndex]?.userId)">
            <text class="fs_av">{{videos[fsIndex]?.userAvatar||'?'}}</text>
            <text class="fs_nm">{{videos[fsIndex]?.userName||'志愿者'}}</text>
          </view>
          <text class="fs_title">{{videos[fsIndex]?.title||'无标题'}}</text>
          <text class="fs_desc" v-if="videos[fsIndex]?.description">{{videos[fsIndex]?.description}}</text>
        </view>
        <view class="fs_br">
          <view class="fs_act" @click.stop="doLike(videos[fsIndex])">
            <text class="fs_act_icon">{{videos[fsIndex]?.liked?'❤️':'🤍'}}</text>
            <text class="fs_act_num">{{fmt(videos[fsIndex]?.likeCount||0)}}</text>
          </view>
          <view class="fs_act" @click.stop="openComments">
            <text class="fs_act_icon">💬</text>
            <text class="fs_act_num">{{fmt(videos[fsIndex]?.commentCount||0)}}</text>
          </view>
          <view class="fs_act">
            <text class="fs_act_icon">↗️</text>
            <text class="fs_act_num">{{fmt(videos[fsIndex]?.shareCount||0)}}</text>
          </view>
        </view>
      </view>

      <view v-if="!fsPlaying&&!fsErr" class="fs_pause_ol" @click.stop="resumePlay">
        <text class="fs_big_play">▶</text>
      </view>

      <view v-if="fsLikeAnim" class="fs_like_anim" @animationend="fsLikeAnim=false">❤️</view>

      <!-- 评论区浮层 -->
      <view v-if="showComments" class="fs_cmts_mask" @click.stop="showComments=false">
        <view class="fs_cmts_panel" @click.stop>
          <view class="fs_cmts_head">
            <text class="fs_cmts_title">评论 ({{videos[fsIndex]?.commentCount||0}})</text>
            <text class="fs_cmts_close" @click="showComments=false">✕</text>
          </view>

          <scroll-view class="fs_cmts_list" scroll-y>
            <view v-if="cmtsLoading" class="fs_cmts_loading">加载中...</view>
            <view v-else-if="cmts.length===0" class="fs_cmts_empty">暂无评论</view>
            <view v-for="c in cmts" :key="c.id" class="fs_cmts_item">
              <text class="fs_cmts_av">{{c.userAvatar||'?'}}</text>
              <view class="fs_cmts_body">
                <view class="fs_cmts_meta">
                  <text class="fs_cmts_name">{{c.userName||'志愿者'}}</text>
                  <text class="fs_cmts_time">{{c.createdAt?.slice(5,16)||''}}</text>
                </view>
                <text class="fs_cmts_content">{{c.content}}</text>
              </view>
            </view>
          </scroll-view>

          <view class="fs_cmts_input_row">
            <input class="fs_cmts_input" :value="cmtText" @input="cmtText=$event.detail?.value??$event.target?.value??''" placeholder="说点什么..." :disabled="cmtSubmitting" />
            <view class="fs_cmts_send" :class="{cmt_disabled:!cmtText.trim()||cmtSubmitting}" @click="submitComment">发送</view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref,onMounted } from 'vue';import { useUserStore } from '@/stores/user';import { request } from '@/api/index'
const s=useUserStore()
const tabs=[{key:'recommend',label:'推荐'},{key:'rescue',label:'救援'},{key:'training',label:'教学'},{key:'animal',label:'动物'},{key:'daily',label:'日常'}]
const cats=['rescue','training','animal','daily']
const activeTab=ref('recommend'),videos=ref<any[]>([]),page=ref(1),loading=ref(false)
const showPub=ref(false),pubTitle=ref(''),pubDesc=ref(''),pubCat=ref('rescue')

// 视频选择 & 上传
const selVideo=ref<{path:string;duration:number;size:number}|null>(null)
const uploadState=ref<'idle'|'uploading'|'done'|'fail'>('idle')
const uploadProgress=ref(0)
const uploadResult=ref<{videoUrl:string;thumbnail:string;duration:string}|null>(null)

/** API base URL — 与 api/index.ts 保持一致 */
let BASE_URL = '/api'
// #ifdef H5
BASE_URL = '/api'
// #endif
// #ifndef H5
BASE_URL = 'https://api.jiujiaxia.com/api'
// #endif

onMounted(load)
function catLabel(c:string){return {rescue:'🚨救援',training:'📚教学',animal:'🐾动物',daily:'📱日常'}[c]||c}
function fmt(n:number){return n<1000?String(n):(n/1000).toFixed(1)+'k'}
function fmtDuration(s:number){const m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+String(sec).padStart(2,'0')}
function fmtSize(b:number){return b<1024*1024?(b/1024).toFixed(0)+'KB':(b/(1024*1024)).toFixed(1)+'MB'}
function resetSel(){selVideo.value=null;uploadState.value='idle';uploadProgress.value=0;uploadResult.value=null}

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
function playVideo(v:any){
  if(!v.videoUrl){uni.showToast({title:'视频源不可用',icon:'none'});return}
  const i=videos.value.findIndex(x=>x.id===v.id)
  if(i>=0)openFs(i)
}

// ---- 全屏竖屏播放器 ----
const fsIndex=ref(-1),fsUiShow=ref(true),fsPlaying=ref(false),fsErr=ref(false),fsLikeAnim=ref(false)
let fsTouchY=0,fsTouchT=0,fsLastTap=0

function openFs(i:number){
  fsIndex.value=i;fsUiShow.value=true;fsPlaying.value=true;fsErr.value=false
  recordView(videos.value[i])
}
function closeFs(){fsIndex.value=-1}

function toggleFsUi(){fsUiShow.value=!fsUiShow.value}

function resumePlay(){
  const ctx=uni.createVideoContext('fs-player')
  ctx?.play()
}

function nextVideo(){
  if(fsIndex.value<videos.value.length-1){
    fsIndex.value++;fsPlaying.value=true;fsErr.value=false
    recordView(videos.value[fsIndex.value])
  }
}
function prevVideo(){
  if(fsIndex.value>0){
    fsIndex.value--;fsPlaying.value=true;fsErr.value=false
    recordView(videos.value[fsIndex.value])
  }
}

// ---- 评论区 ----
const showComments=ref(false),cmts=ref<any[]>([]),cmtText=ref(''),cmtSubmitting=ref(false),cmtsLoading=ref(false)

async function openComments(){
  showComments.value=true
  const v=videos.value[fsIndex.value]
  if(!v)return
  cmtsLoading.value=true
  try{
    const r=await request<any>({url:`/video/${v.id}/comments`})
    cmts.value=r||[]
  }catch{}finally{cmtsLoading.value=false}
}

async function submitComment(){
  const txt=cmtText.value.trim()
  if(!txt||cmtSubmitting.value)return
  cmtSubmitting.value=true
  const p=s.profile
  try{
    await request({
      url:`/video/${videos.value[fsIndex.value].id}/comment`,
      method:'POST',
      data:{userId:p.id,userName:p.name,userAvatar:p.avatar,content:txt}
    })
    cmtText.value=''
    cmts.value.unshift({id:'tmp',userId:p.id,userName:p.name,userAvatar:p.avatar,content:txt,createdAt:new Date().toISOString()})
    if(videos.value[fsIndex.value])videos.value[fsIndex.value].commentCount=(videos.value[fsIndex.value].commentCount||0)+1
    openComments()
  }catch{}finally{cmtSubmitting.value=false}
}

// 触摸事件 — 处理滑动切换 & 双击点赞
function onFsTouchStart(e:TouchEvent){
  fsTouchY=e.touches[0].clientY
  fsTouchT=Date.now()
}
function onFsTouchEnd(e:TouchEvent){
  const dy=e.changedTouches[0].clientY-fsTouchY
  const dt=Date.now()-fsTouchT

  // 双击检测
  if(dt<300&&Math.abs(dy)<20){
    const now=Date.now()
    if(now-fsLastTap<500){
      fsLastTap=0
      doLike(videos.value[fsIndex.value])
      fsLikeAnim.value=true
      setTimeout(()=>{fsLikeAnim.value=false},800)
      return
    }
    fsLastTap=now
  }

  // 滑动切换
  if(Math.abs(dy)>60&&dt<500){
    dy<0?nextVideo():prevVideo()
  }
}

/** 从相册/相机选择视频 */
function pickVideo(){
  uni.chooseVideo({
    sourceType:['album','camera'],
    maxDuration:600,
    success:(res)=>{
      selVideo.value={path:res.tempFilePath,duration:res.duration,size:res.size}
      uploadState.value='idle'
      uploadProgress.value=0
    }
  })
}

function cancelPub(){
  showPub.value=false
  resetSel()
  pubTitle.value=''
  pubDesc.value=''
}

/** 上传视频 → 发布 */
async function publish(){
  if(!selVideo.value){uni.showToast({title:'请先选择视频',icon:'none'});return}
  if(!pubTitle.value){uni.showToast({title:'请输入视频标题',icon:'none'});return}

  // Step 1: 上传视频文件
  if(uploadState.value!=='done'){
    uploadState.value='uploading'
    uploadProgress.value=0

    const videoRes = await new Promise<{code:number;data:any;message:string}>((resolve,reject)=>{
      const task=uni.uploadFile({
        url: BASE_URL+'/video/upload',
        filePath: selVideo.value!.path,
        name:'video',
        formData:{duration:String(Math.round(selVideo.value!.duration))},
        success:(r)=>{try{resolve(JSON.parse(r.data as string))}catch{reject(new Error('解析上传结果失败'))}},
        fail:reject,
      })
      task.onProgressUpdate((r)=>{uploadProgress.value=r.progress})
    })

    if(videoRes.code!==0){
      uploadState.value='fail'
      return uni.showToast({title:'上传失败: '+videoRes.message,icon:'none'})
    }
    uploadState.value='done'
    uploadResult.value=videoRes.data
  }

  // Step 2: 发布视频帖
  const p=s.profile
  const ur=uploadResult.value
  await request({
    url:'/video',method:'POST',
    data:{
      userId:p.id,userName:p.name,userAvatar:p.avatar,
      title:pubTitle.value,description:pubDesc.value,
      videoUrl:ur?.videoUrl||'',
      thumbnail:ur?.thumbnail||'',
      duration:ur?.duration||fmtDuration(selVideo.value!.duration),
      category:pubCat.value,
    }
  })

  uni.showToast({title:'已发布',icon:'success'})
  cancelPub()
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
.btn{background:#C0392B;color:#fff;text-align:center;padding:20rpx;border-radius:48rpx;font-size:28rpx;font-weight:700;transition:opacity .2s}
.btn.disabled{opacity:.5}
.pick-area{display:flex;flex-direction:column;align-items:center;justify-content:center;height:180rpx;border:2rpx dashed #ddd;border-radius:16rpx;margin-bottom:12px;background:#FAFAFA}
.pick-icon{font-size:48rpx;margin-bottom:8rpx}.pick-text{font-size:24rpx;color:#999}
.preview-area{margin-bottom:12px}.preview-video{width:100%;height:220rpx;border-radius:12rpx;background:#000}
.preview-meta{display:flex;align-items:center;justify-content:space-between;margin-top:6rpx}
.preview-info{font-size:20rpx;color:#999}.change-btn{font-size:22rpx;color:#C0392B}
.progress-area{margin-bottom:12px}.progress-bar{height:6rpx;background:#F0F0F0;border-radius:3rpx;overflow:hidden;margin-bottom:6rpx}
.progress-fill{height:100%;background:#C0392B;border-radius:3rpx;transition:width .3s}
.progress-text{font-size:20rpx;color:#999}.upload-done{font-size:22rpx;color:#27AE60;display:block;margin-bottom:12px}
.upload-fail{font-size:22rpx;color:#E74C3C;display:block;margin-bottom:12px}

/* 全屏竖屏播放器 */
.fs-overlay{position:fixed;inset:0;background:#000;z-index:200;display:flex;flex-direction:column}
.fs-video{flex:1;width:100%;height:100%}
.fs-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.fs-ph-icon{font-size:64rpx;margin-bottom:12rpx}.fs-ph-text{color:#999;font-size:26rpx}
.fs-swipe-hint{position:absolute;top:60rpx;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.5);font-size:22rpx;z-index:5}
.fs-top{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:64rpx 20rpx 20rpx;background:linear-gradient(180deg,rgba(0,0,0,.6),transparent);z-index:10;transition:opacity .3s}
.fs-back{width:60rpx;height:60rpx;display:flex;align-items:center;justify-content:center;color:#fff;font-size:36rpx}
.fs-counter{color:rgba(255,255,255,.7);font-size:24rpx}
.fs-bottom{position:absolute;bottom:0;left:0;right:0;display:flex;align-items:flex-end;justify-content:space-between;padding:20rpx 20rpx 80rpx;background:linear-gradient(0deg,rgba(0,0,0,.7),transparent);z-index:10;transition:opacity .3s}
.fs_bl{flex:1;margin-right:20rpx}
.fs_author{display:flex;align-items:center;gap:8rpx;margin-bottom:8rpx}
.fs_av{width:40rpx;height:40rpx;border-radius:50%;background:#C0392B;display:flex;align-items:center;justify-content:center;font-size:20rpx;color:#fff}
.fs_nm{color:#fff;font-size:24rpx;font-weight:600}
.fs_title{color:#fff;font-size:28rpx;font-weight:700;display:block;margin-bottom:4rpx;line-height:1.4}
.fs_desc{color:rgba(255,255,255,.7);font-size:22rpx;display:block;margin-bottom:4rpx;line-height:1.4}
.fs_br{display:flex;flex-direction:column;gap:20rpx;padding-bottom:20rpx}
.fs_act{display:flex;flex-direction:column;align-items:center;gap:4rpx}
.fs_act_icon{font-size:44rpx;color:#fff}
.fs_act_num{color:#fff;font-size:20rpx}
.fs_hide{opacity:0!important;pointer-events:none}
.fs_pause_ol{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:8}
.fs_big_play{font-size:80rpx;color:rgba(255,255,255,.7);width:100rpx;height:100rpx;border-radius:50%;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center}
.fs_like_anim{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:120rpx;z-index:20;animation:fsLikeAnim .8s ease-out forwards;pointer-events:none}
@keyframes fsLikeAnim{0%{opacity:1;transform:translate(-50%,-50%) scale(0)}30%{transform:translate(-50%,-50%) scale(1.2)}60%{transform:translate(-50%,-50%) scale(.95)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}

/* 评论区浮层 */
.fs_cmts_mask{position:absolute;inset:0;background:rgba(0,0,0,.3);z-index:30;display:flex;align-items:flex-end;justify-content:center}
.fs_cmts_panel{background:#fff;border-radius:20rpx 20rpx 0 0;width:100%;max-height:70vh;display:flex;flex-direction:column;animation:cmtSlideUp .25s ease-out}
@keyframes cmtSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.fs_cmts_head{display:flex;align-items:center;justify-content:space-between;padding:24rpx 20rpx;border-bottom:1px solid #F0F0F0}
.fs_cmts_title{font-size:28rpx;font-weight:700}.fs_cmts_close{font-size:32rpx;color:#999;padding:8rpx}
.fs_cmts_list{flex:1;overflow-y:auto;padding:0 20rpx;max-height:55vh}
.fs_cmts_loading,.fs_cmts_empty{text-align:center;padding:60rpx 0;color:#999;font-size:24rpx}
.fs_cmts_item{display:flex;gap:12rpx;padding:16rpx 0;border-bottom:1px solid #F8F8F8}
.fs_cmts_av{width:44rpx;height:44rpx;border-radius:50%;background:#C0392B;display:flex;align-items:center;justify-content:center;font-size:18rpx;color:#fff;flex-shrink:0}
.fs_cmts_body{flex:1;min-width:0}.fs_cmts_meta{display:flex;align-items:center;gap:10rpx;margin-bottom:4rpx}
.fs_cmts_name{font-size:22rpx;font-weight:600;color:#333}.fs_cmts_time{font-size:18rpx;color:#bbb}
.fs_cmts_content{font-size:24rpx;color:#444;line-height:1.5}
.fs_cmts_input_row{display:flex;align-items:center;gap:12rpx;padding:12rpx 20rpx;border-top:1px solid #F0F0F0;background:#fff}
.fs_cmts_input{flex:1;height:40px;border:1px solid #ddd;border-radius:20px;padding:0 16px;font-size:14px;box-sizing:border-box}
.fs_cmts_send{background:#C0392B;color:#fff;padding:10rpx 24rpx;border-radius:24rpx;font-size:26rpx;font-weight:600}
.fs_cmts_send.cmt_disabled{opacity:.4}
</style>
