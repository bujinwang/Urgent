<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

onLaunch(() => {
  console.log('[急救侠] App Launch')

  const auth = useAuthStore()

  // #ifdef MP-WEIXIN
  auth.login().then(() => {
    console.log('[急救侠] 微信自动登录成功')
  }).catch((e: any) => {
    console.warn('[急救侠] 自动登录失败（游客模式）：', e.message || e)
  })
  // #endif

  // #ifdef H5
  auth.checkLogin().then((ok: boolean) => {
    console.log(ok ? '[急救侠] 会话已恢复' : '[急救侠] 未登录')
  })
  // #endif
})

onShow(() => {
  console.log('[急救侠] App Show')
})

onHide(() => {
  console.log('[急救侠] App Hide')
})
</script>

<style lang="scss">
@use '@/styles/variables.scss';
@use '@/styles/animations.scss';
@use '@/styles/global.scss' as *;
</style>