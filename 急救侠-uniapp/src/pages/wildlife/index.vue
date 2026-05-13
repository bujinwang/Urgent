<template>
  <view class="page-wl">
    <view class="wl-header"><text class="wl-title">🐾 动物救援</text></view>
    <view class="wl-legal">
      <text class="wl-legal-title">⚠️ 法律提醒</text>
      <text class="wl-legal-text">根据《野生动物保护法》第12条，发现受伤保护动物应及时报告当地林业部门。私自捕捉、圈养、转运保护动物属违法行为。本平台仅协助上报和授权救援，不替代执法机构。</text>
    </view>
    <view class="wl-tabs">
      <view class="wl-tab" :class="{active:tab==='wildlife'}" @click="tab='wildlife';lr()">🦅 野生动物</view>
      <view class="wl-tab" :class="{active:tab==='pet'}" @click="tab='pet';lr()">🐱 流浪宠物</view>
      <view class="wl-tab" :class="{active:tab==='rescue'}" @click="tab='rescue';lt()">救援任务</view>
    </view>

    <view v-if="tab!=='rescue'" class="wl-list">
      <view v-for="r in dr" :key="r.id" class="wl-card">
        <view class="wl-card-top"><text class="wl-species">{{r.category==='pet'?'🐱':'🦅'}} {{r.species}}</text><text class="wl-status" :style="{color:r.status==='reported'?'#F59E0B':'#34D277'}">{{r.status==='reported'?'待处理':'已分配'}}</text></view>
        <text class="wl-desc">{{r.description}}</text>
        <view v-if="r.photos" class="wl-photos"><image v-for="(p,i) in r.photos.split(',')" :key="i" :src="'http://localhost:3001'+p" mode="aspectFill" class="wl-photo" @click="pv('http://localhost:3001'+p)"></image></view>
        <view class="wl-meta"><text>📍 {{r.location}}</text><text>👤 {{r.userName}}</text></view>
        <view v-if="r.status==='reported'&&r.category==='pet'" class="wl-btn" @click="cr(r)">🚑 发起救援</view>
        <view v-else-if="r.status==='reported'&&r.category==='wildlife'" class="wl-btn-legal" @click="nc">📞 通知保护机构</view>
      </view>
      <view v-if="dr.length===0" class="wl-empty">暂无上报</view>
    </view>

    <view v-if="tab==='rescue'" class="wl-list">
      <view v-for="t in tasks" :key="t.id" class="wl-card">
        <view class="wl-card-top"><text class="wl-species">{{t.species}} · {{t.title}}</text><text class="wl-status" :style="{color:sc(t.status)}">{{sl(t.status)}}</text></view>
        <text class="wl-desc">{{t.description}}</text>
        <view class="wl-meta"><text>📍 {{t.address}}</text><text>👤 {{t.leaderName}}</text><text>{{t.volunteersResponded}}/{{t.volunteersNeeded}}人</text></view>
        <view v-if="t.status==='active'" class="wl-btn" @click="nc">🤝 应召参与（需保护机构确认）</view>
      </view>
      <view v-if="tasks.length===0" class="wl-empty">暂无救援任务</view>
    </view>

    <view class="wl-fab" @click="showReport=true">📝</view>

    <div v-if="showReport" class="modal-overlay" @click.self="showReport=false">
    <div class="modal"><h3>上报动物</h3>
      <label>类型</label><select v-model="form.category"><option value="pet">🐱 流浪宠物</option><option value="wildlife">🦅 野生动物（保护机构处理）</option></select>
      <label>物种</label><input v-model="form.species">
      <label>描述</label><textarea v-model="form.description"></textarea>
      <label>地点</label><input v-model="form.location">
      <label>照片</label>
      <view class="wl-upload-row"><image v-for="(p,i) in form.photos" :key="i" :src="'http://localhost:3001'+p" class="wl-upload-pv" @click="rp(i)"></image><view class="wl-upload-btn" @click="tp">📷</view></view>
      <text v-if="form.category==='wildlife'" class="wl-legal-text" style="margin-bottom:10rpx;display:block">⚠️ 野生动物上报后将由保护机构处理，请勿私自捕捉或移动</text>
      <div class="modal-actions"><button class="btn btn-g" @click="showReport=false">取消</button><button class="btn btn-p" @click="sub">提交</button></div></div></div>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
const U='http://localhost:3001/api',s=useUserStore()
const tab=ref<'wildlife'|'pet'|'rescue'>('wildlife'),ar=ref<any[]>([]),tasks=ref<any[]>([])
const showReport=ref(false),form=ref({category:'pet',species:'',description:'',location:'',photos:[] as string[]})
const dr=computed(()=>ar.value.filter(r=>r.category===tab.value))
async function lr(){try{ar.value=(await fetch(`${U}/wildlife/reports`).then(r=>r.json())).data||[]}catch(e){}}
async function lt(){try{tasks.value=(await fetch(`${U}/wildlife/rescue`).then(r=>r.json())).data||[]}catch(e){}}
function tp(){uni.chooseImage({count:1,sizeType:['compressed'],success:async(res)=>{const f=res.tempFiles[0],fs=uni.getFileSystemManager(),b64=fs.readFileSync(f.path!,'base64'),m=f.path!.endsWith('.png')?'image/png':'image/jpeg';try{const r=await fetch(`${U}/upload`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:`data:${m};base64,${b64}`})}).then(r=>r.json());if(r.code===0)form.value.photos.push(r.data.url)}catch(e){uni.showToast({title:'上传失败',icon:'none'})}}})}
function rp(i:number){form.value.photos.splice(i,1)}
function pv(url:string){uni.previewImage({urls:[url]})}
async function sub(){const f=form.value;await fetch(`${U}/wildlife/report`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,photos:f.photos.join(','),userId:s.profile.id,userName:s.profile.name,lat:22.517,lng:113.947})});showReport.value=false;form.value={category:'pet',species:'',description:'',location:'',photos:[]};lr()}
async function cr(r:any){await fetch(`${U}/wildlife/rescue`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:`${r.species}救助`,species:r.species,description:r.description,address:r.location,lat:r.lat,lng:r.lng,leaderId:s.profile.id,leaderName:s.profile.name,reportId:r.id})});lr();lt()}
async function nc(){uni.showModal({title:'通知保护机构',content:'请拨打当地林业部门电话。\n\n深圳市野生动植物保护管理处：0755-xxxxxxx',showCancel:false,confirmText:'知道了'})}
function sc(s:string){return{pending:'#F59E0B',active:'#34D277',completed:'#8E8E8E'}[s]||'#6B7280'}
function sl(s:string){return{pending:'待审批',active:'进行中',completed:'已完成'}[s]||s}
onMounted(lr)
</script>

<style lang="scss" scoped>
.page-wl{padding-bottom:80rpx}.wl-header{padding:60rpx 40rpx 10rpx;background:linear-gradient(180deg,#E8F5E9,transparent)}.wl-title{font-family:var(--serif);font-size:44rpx;font-weight:900}
.wl-legal{margin:16rpx 40rpx;padding:20rpx;background:#FFF8E0;border:1px solid #FCD34D;border-radius:14rpx}.wl-legal-title{font-size:22rpx;font-weight:700;color:#92400E;display:block}.wl-legal-text{font-size:20rpx;color:#92400E;line-height:1.6;margin-top:6rpx;display:block}
.wl-tabs{display:flex;gap:12rpx;padding:20rpx 40rpx}.wl-tab{padding:14rpx 28rpx;border-radius:32rpx;font-size:24rpx;border:1px solid var(--line);color:var(--ink-mute)}.wl-tab.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.wl-list{padding:0 40rpx;display:flex;flex-direction:column;gap:16rpx}.wl-card{background:#fff;border:1px solid var(--line);border-radius:20rpx;padding:24rpx}
.wl-card-top{display:flex;justify-content:space-between;align-items:center}.wl-species{font-size:28rpx;font-weight:700}.wl-status{font-size:20rpx;font-family:var(--mono)}.wl-desc{font-size:22rpx;color:var(--ink-mute);margin-top:8rpx;display:block}
.wl-photos{display:flex;gap:8rpx;margin-top:10rpx;flex-wrap:wrap}.wl-photo{width:120rpx;height:120rpx;border-radius:12rpx;background:#E5E5E0}
.wl-meta{display:flex;gap:16rpx;margin-top:12rpx;padding-top:12rpx;border-top:1px solid var(--line);font-size:18rpx;color:var(--ink-mute);flex-wrap:wrap}
.wl-btn{padding:12rpx 24rpx;border-radius:20rpx;font-size:22rpx;font-weight:600;background:#D1FAE5;color:#065F46;display:inline-block;margin-top:10rpx}
.wl-btn-legal{padding:12rpx 24rpx;border-radius:20rpx;font-size:22rpx;font-weight:600;background:#FEF3C7;color:#92400E;display:inline-block;margin-top:10rpx}
.wl-fab{position:fixed;bottom:28rpx;right:28rpx;width:52px;height:52px;border-radius:50%;background:#10B981;color:#fff;font-size:24rpx;display:flex;align-items:center;justify-content:center;box-shadow:0 4rpx 16rpx rgba(16,185,129,0.4)}.wl-empty{padding:80rpx;text-align:center;color:var(--ink-mute);font-size:22rpx}
.wl-upload-row{display:flex;gap:8rpx;flex-wrap:wrap;margin-bottom:14rpx}.wl-upload-pv{width:80rpx;height:80rpx;border-radius:10rpx;background:#E5E5E0}.wl-upload-btn{width:80rpx;height:80rpx;border-radius:10rpx;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center;font-size:28rpx;background:#FAFAF7}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:100}
.modal{background:#fff;border-radius:16rpx;padding:28rpx;width:90%;max-width:400rpx;max-height:85vh;overflow-y:auto;box-shadow:0 8rpx 40rpx rgba(0,0,0,0.15)}.modal h3{font-size:17px;margin-bottom:16rpx}.modal label{display:block;font-size:12px;color:#8E8E8E;margin-bottom:6rpx}
.modal input,.modal select,.modal textarea{width:100%;padding:10rpx 12rpx;border:1px solid #E5E5E0;border-radius:8rpx;font-size:13px;margin-bottom:14rpx;font-family:inherit}.modal textarea{resize:vertical;min-height:50rpx}.modal-actions{display:flex;gap:10rpx;justify-content:flex-end}
.btn{padding:10rpx 20rpx;border-radius:8rpx;font-size:13px;cursor:pointer;border:none}.btn-p{background:#10B981;color:#fff}.btn-g{background:transparent;color:#8E8E8E}
</style>
