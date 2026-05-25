<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { usePushStore } from '@/stores/push'

const PUSH_PROMPTED_KEY = 'push_prompted'

onLaunch(() => {
  console.log('[急救侠] App Launch')

  const auth = useAuthStore()

  // #ifdef MP-WEIXIN
  auth.login().then(() => {
    console.log('[急救侠] 微信自动登录成功')
    // 首次启动时自动弹窗引导订阅推送
    if (!uni.getStorageSync(PUSH_PROMPTED_KEY)) {
      uni.setStorageSync(PUSH_PROMPTED_KEY, '1')
      setTimeout(() => {
        const push = usePushStore()
        push.subscribeAll().catch((e: any) => {
          console.warn('[急救侠] 订阅引导跳过:', e.message || e)
        })
      }, 2000)
    }
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