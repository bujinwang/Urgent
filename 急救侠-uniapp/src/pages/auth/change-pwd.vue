<template>
  <view class="pg">
    <view class="hd"><text class="t">修改密码</text></view>
    <view class="form">
      <input class="in" :value="oldPwd" @input="oldPwd=$event.detail?.value??$event.target?.value??''" placeholder="旧密码" type="password" />
      <input class="in" :value="newPwd" @input="newPwd=$event.detail?.value??$event.target?.value??''" placeholder="新密码" type="password" />
      <input class="in" :value="newPwd2" @input="newPwd2=$event.detail?.value??$event.target?.value??''" placeholder="确认新密码" type="password" />
      <view class="btn" @click="submit">保存</view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue';import { requestFull } from '@/api/index'
import { useUserStore } from '@/stores/user'
const oldPwd=ref(''),newPwd=ref(''),newPwd2=ref('')
const userStore = useUserStore()
async function submit(){
  if(!oldPwd.value||!newPwd.value){uni.showToast({title:'请填写所有字段',icon:'none'});return}
  if(newPwd.value!==newPwd2.value){uni.showToast({title:'两次新密码不一致',icon:'none'});return}
  // 身份由后端从令牌（authMiddleware）解析；phone 仅作一致性校验，不再从 token 字符串截取
  let uid = userStore.profile.id || ''
  if(!uid.startsWith('u_')){
    // 首次进入 / store 尚未加载：主动拉取一次当前登录用户
    try{ await userStore.refresh() }catch{ /* 下面统一提示 */ }
    uid = userStore.profile.id || ''
  }
  const phone = uid.startsWith('u_') ? uid.slice(2) : ''
  if(!phone){uni.showToast({title:'无法识别当前账号，请重新登录',icon:'none'});return}
  const res = await requestFull({
    url:'/auth/change-password',method:'POST',
    data:{phone,oldPassword:oldPwd.value,newPassword:newPwd.value},
  })
  if(res.code!==0){uni.showToast({title:res.message||'修改失败',icon:'none'});return}
  uni.showToast({title:'密码已修改',icon:'success'});setTimeout(()=>uni.navigateBack(),600)
}
</script>
<style scoped>
.pg{padding-bottom:60rpx}.hd{padding:40rpx 32rpx 24rpx;background:var(--rescue-red)}.t{font-size:40rpx;font-weight:900;color:#fff}
.form{padding:28rpx 32rpx}.in{width:100%;height:44px;border:1px solid #ddd;border-radius:8px;padding:0 12px;font-size:14px;box-sizing:border-box;margin-bottom:12px}
.btn{background:var(--rescue-red);color:#fff;text-align:center;padding:24rpx;border-radius:48rpx;font-size:30rpx;font-weight:700;margin-top:16rpx}
</style>
