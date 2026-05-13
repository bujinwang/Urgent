<template>
  <view class="pg">
    <view class="hd"><text class="t">动物档案</text><text class="s">流浪猫狗信息 · 照料记录 · 健康检查</text></view>
    <view class="list">
      <view v-if="animals.length===0" class="empty">暂无动物档案</view>
      <view v-for="a in animals" :key="a.id" class="card" @click="openDetail(a)">
        <text class="ci">{{ animalIcon(a.species) }}</text>
        <view class="cb">
          <text class="cn">{{ a.name || a.species }}</text>
          <text class="cs">{{ a.color }} {{ a.size }} · {{ a.status === 'active' ? '需照料' : a.status }}</text>
          <text class="cl">{{ a.location }}</text>
        </view>
        <text class="ca">→</text>
      </view>
    </view>
    <view class="fab" @click="showForm=!showForm">{{ showForm ? '✕' : '＋' }}</view>

    <view v-if="showForm" class="modalmask" @click="showForm=false"><view class="modal" @click.stop>
      <text class="mt">登记动物</text>
      <input class="mi" :value="form.species" @input="form.species=$event.target.value" placeholder="物种 * (猫/狗/其他)" />
      <input class="mi" :value="form.name" @input="form.name=$event.target.value" placeholder="名字 (选填)" />
      <input class="mi" :value="form.color" @input="form.color=$event.target.value" placeholder="颜色" />
      <input class="mi" :value="form.size" @input="form.size=$event.target.value" placeholder="体型 (小/中/大)" />
      <input class="mi" :value="form.features" @input="form.features=$event.target.value" placeholder="特征 (花纹/项圈/伤情)" />
      <input class="mi" :value="form.location" @input="form.location=$event.target.value" placeholder="发现地点" />
      <view class="mb"><view class="btn" @click="create">提交</view></view>
    </view></view>

    <view v-if="detail" class="modalmask" @click="detail=null"><view class="modal detail" @click.stop>
      <text class="mt">{{ detailIcon }} {{ detail.name || detail.species }}</text>
      <text class="ds">{{ detail.color }} {{ detail.size }} · {{ detail.features }}</text>
      <text class="ds" style="margin-bottom:16px">{{ detail.location }}</text>
      <text class="mt" style="font-size:24rpx;margin-top:12px">照料记录</text>
      <view v-if="detail.careRecords?.length" class="rl">
        <view v-for="r in detail.careRecords" :key="r.id" class="ri">
          <text class="rt">{{ careLabel(r.careType) }} — {{ r.userName || '志愿者' }}</text>
          <text class="rd">{{ r.description }} · {{ r.createdAt?.slice(0,10) }}</text>
        </view>
      </view>
      <view v-else class="empty" style="padding:20rpx">暂无照料记录</view>
      <text class="mt" style="font-size:24rpx;margin-top:12px">健康检查</text>
      <view v-if="detail.healthRecords?.length" class="rl">
        <view v-for="r in detail.healthRecords" :key="r.id" class="ri">
          <text class="rt">{{ r.checkType }} — {{ r.userName || '志愿者' }}</text>
          <text class="rd">{{ r.findings }} · {{ r.createdAt?.slice(0,10) }}</text>
        </view>
      </view>
      <view v-else class="empty" style="padding:20rpx">暂无健康记录</view>
      <view class="mb" style="display:flex;gap:12rpx">
        <view class="btn" style="flex:1" @click="openCare">记录照料</view>
        <view class="btn" style="flex:1" @click="openHealth">记录健康</view>
      </view>
    </view></view>

    <view v-if="logMode" class="modalmask" @click="logMode=''"><view class="modal" @click.stop>
      <text class="mt">{{ logMode==='care'?'记录照料':'健康检查' }}</text>
      <input v-if="logMode==='care'" class="mi" :value="logForm.careType" @input="logForm.careType=$event.target.value" placeholder="类型 (feeding/check/other)" />
      <input v-if="logMode==='health'" class="mi" :value="logForm.checkType" @input="logForm.checkType=$event.target.value" placeholder="检查类型" />
      <input class="mi" :value="logForm.description" @input="logForm.description=$event.target.value" placeholder="描述" />
      <input v-if="logMode==='health'" class="mi" :value="logForm.vetName" @input="logForm.vetName=$event.target.value" placeholder="兽医姓名 (选填)" />
      <view class="mb"><view class="btn" @click="submitLog">提交</view></view>
    </view></view>
  </view>
</template>

<script setup lang="ts">
import { ref,onMounted } from 'vue';import { useUserStore } from '@/stores/user';import { request } from '@/api/index'
const s=useUserStore()
const animals=ref<any[]>([]),form=ref({species:'',name:'',color:'',size:'',features:'',location:''})
const showForm=ref(false),detail=ref<any>(null),logMode=ref('')
const logForm=ref({careType:'',checkType:'',description:'',vetName:''}),detailIcon=ref('')
onMounted(()=>load())
async function load(){try{animals.value=await request({url:'/animals'})}catch{}}
function animalIcon(s:string){return s==='猫'?'🐱':s==='狗'?'🐕':'🐾'}
function careLabel(t:string){return t==='feeding'?'🍽️ 喂食':t==='check'?'👀 查看':t==='rescue'?'🚑 救助':t||'照料'}
async function create(){
  if(!form.value.species){uni.showToast({title:'请填写物种',icon:'none'});return}
  await request({url:'/animals',method:'POST',data:{...form.value,createdBy:s.profile.id}})
  uni.showToast({title:'已登记',icon:'success'});showForm.value=false
  form.value={species:'',name:'',color:'',size:'',features:'',location:''};load()
}
async function openDetail(a:any){try{detail.value=await request({url:`/animals/${a.id}`});detailIcon.value=animalIcon(detail.value.species)}catch{}}
function openCare(){logMode.value='care';logForm.value={careType:'',checkType:'',description:'',vetName:''}}
function openHealth(){logMode.value='health';logForm.value={careType:'',checkType:'',description:'',vetName:''}}
async function submitLog(){
  if(!logForm.value.description){uni.showToast({title:'请填写描述',icon:'none'});return}
  const d=detail.value;if(!d)return
  if(logMode.value==='care')await request({url:`/animals/${d.id}/care`,method:'POST',data:{userId:s.profile.id,userName:s.profile.name,careType:logForm.value.careType,description:logForm.value.description}})
  else await request({url:`/animals/${d.id}/health`,method:'POST',data:{userId:s.profile.id,userName:s.profile.name,checkType:logForm.value.checkType,findings:logForm.value.description,vetName:logForm.value.vetName}})
  uni.showToast({title:'已记录',icon:'success'});logMode.value=''
  try{detail.value=await request({url:`/animals/${d.id}`});detailIcon.value=animalIcon(detail.value.species)}catch{}
}
</script>

<style scoped>
.pg{padding-bottom:60rpx}.hd{padding:40rpx 32rpx 24rpx;background:var(--rescue-red)}.t{font-size:40rpx;font-weight:900;color:#fff;display:block}.s{font-size:24rpx;color:rgba(255,255,255,.7);margin-top:8rpx;display:block}
.list{padding:20rpx 32rpx}.empty{text-align:center;padding:60rpx 0;color:var(--ink-mute);font-size:24rpx}
.card{display:flex;align-items:center;gap:16rpx;padding:24rpx;background:#fff;border:1px solid #E5E5E0;border-radius:16rpx;margin-bottom:12rpx}
.ci{font-size:44rpx;flex-shrink:0}.cb{flex:1}.cn{font-size:28rpx;font-weight:700;display:block}.cs{font-size:20rpx;color:var(--ink-soft);display:block;margin-top:2rpx}.cl{font-size:18rpx;color:var(--ink-mute);margin-top:2rpx}.ca{color:var(--ink-mute);font-size:24rpx}
.fab{position:fixed;right:32rpx;bottom:80rpx;width:96rpx;height:96rpx;border-radius:50%;background:var(--rescue-red);color:#fff;display:flex;align-items:center;justify-content:center;font-size:44rpx;font-weight:300;box-shadow:0 8rpx 32rpx rgba(192,57,43,.4);z-index:50}
.modalmask{position:fixed;inset:0;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;justify-content:center;z-index:100}
.modal{background:#fff;border-radius:24rpx 24rpx 0 0;padding:32rpx;width:100%;max-width:600rpx;max-height:80vh;overflow-y:auto}.mt{font-size:32rpx;font-weight:900;display:block;margin-bottom:16rpx}.mi{width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:14px;box-sizing:border-box;margin-bottom:12rpx}.mb{padding-top:8rpx}.btn{background:var(--rescue-red);color:#fff;text-align:center;padding:20rpx;border-radius:48rpx;font-size:26rpx;font-weight:700}
.detail{max-height:70vh}.ds{font-size:22rpx;color:var(--ink-mute);display:block;margin-top:4rpx}.rl{margin-bottom:8rpx}.ri{padding:12rpx;background:#f8f8f6;border-radius:8rpx;margin-bottom:6rpx}.rt{font-size:22rpx;font-weight:600;display:block}.rd{font-size:18rpx;color:var(--ink-mute);margin-top:2rpx}
</style>
