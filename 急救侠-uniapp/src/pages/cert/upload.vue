<template>
  <view class="pg">
    <view class="hd"><text class="t">登记已有认证</text><text class="s">上传你在其他机构获得的急救证书</text></view>
    <view class="form">
      <view class="row"><text class="lb">认证类型 *</text><input class="in" :value="type" @input="type=$event.target.value" placeholder="CPR / AED、AHA BLS、红十字急救员" /></view>
      <view class="row"><text class="lb">颁发机构 *</text><input class="in" :value="issuer" @input="issuer=$event.target.value" placeholder="美国心脏协会、中国红十字总会" /></view>
      <view class="row"><text class="lb">证书编号</text><input class="in" :value="certNumber" @input="certNumber=$event.target.value" placeholder="选填" /></view>
      <view class="row"><text class="lb">签发日期</text><input class="in" type="date" :value="issueDate" @input="issueDate=$event.target.value" /></view>
      <view class="row"><text class="lb">到期日期</text><input class="in" type="date" :value="expiryDate" @input="expiryDate=$event.target.value" /></view>
      <view class="btn" @click="submit">提交认证</view>
    </view>
    <view v-if="list.length" class="sec"><text class="st">我的记录</text>
      <view v-for="c in list" :key="c.id" class="li"><view class="ld">{{c.status==='verified'?'✅':c.status==='pending'?'⏳':'❌'}} {{c.type}}</view><view class="ls">{{c.issuer}} · {{c.issueDate}} – {{c.expiryDate}}</view></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref,onMounted } from 'vue';import { useUserStore } from '@/stores/user';import { request } from '@/api/index'
const s=useUserStore()
const type=ref(''),issuer=ref(''),certNumber=ref(''),issueDate=ref(''),expiryDate=ref(''),list=ref<any[]>([])
onMounted(async()=>{try{list.value=await request({url:`/rescue/certifications?userId=${s.profile.id}`})}catch{}})
async function submit(){
  if(!type.value||!issuer.value){uni.showToast({title:'请填写类型和机构',icon:'none'});return}
  await request({url:'/rescue/certification',method:'POST',data:{userId:s.profile.id,type:type.value,issuer:issuer.value,certNumber:certNumber.value,issueDate:issueDate.value,expiryDate:expiryDate.value}})
  uni.showToast({title:'已提交，等待平台验证',icon:'success'});type.value=issuer.value=certNumber.value=issueDate.value=expiryDate.value=''
  try{list.value=await request({url:`/rescue/certifications?userId=${s.profile.id}`})}catch{}
}
</script>
<style scoped>
.pg{padding-bottom:60rpx}.hd{padding:40rpx 32rpx 24rpx;background:var(--rescue-red)}.t{font-size:40rpx;font-weight:900;color:#fff;display:block}.s{font-size:24rpx;color:rgba(255,255,255,.7);margin-top:8rpx;display:block}
.form{padding:28rpx 32rpx}.row{margin-bottom:20rpx}.lb{font-size:22rpx;color:var(--ink-mute);display:block;margin-bottom:8rpx}.in{width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:14px;box-sizing:border-box}
.btn{background:var(--rescue-red);color:#fff;text-align:center;padding:24rpx;border-radius:48rpx;font-size:30rpx;font-weight:700;margin-top:16rpx}
.sec{margin:0 32rpx 40rpx}.st{font-size:28rpx;font-weight:700;display:block;margin-bottom:20rpx}.li{padding:20rpx;background:#fff;border:1px solid #E5E5E0;border-radius:12rpx;margin-bottom:10rpx}.ld{font-size:24rpx;font-weight:600}.ls{font-size:20rpx;color:var(--ink-mute);margin-top:4rpx}
</style>
