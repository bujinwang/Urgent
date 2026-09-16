<script setup lang="ts">
import { onLaunch, onShow, onHide } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { usePushStore } from '@/stores/push'
import { i18n } from '@/i18n'
import { applyTabBarLocale } from '@/utils/tabbar-locale'

const PUSH_PROMPTED_KEY = 'push_prompted'

/**
 * 组合式 i18n 实例（`legacy:false` ⇒ `t` 返回 `string`；与 drill / rescue 页同款 cast）。
 */
const i18nGlobal = i18n.global as unknown as { t: (key: string) => string }

onLaunch(() => {
  console.log('[急救侠] App Launch')

  // 启动时把 tabBar 文案同步为「当前语言」（持久化 > 系统语言 > 中文，判定见 `resolveInitialLocale`）。
  // 为什么需要：`pages.json` 的 tabBar 默认恒为中文；若用户上次选了英文，启动后 tab 必须先变英文，
  // 且此路径**不经过** `setLocale()`（i18n 是直接以 `resolveInitialLocale()` 建实例的）⇒ 必须显式同步一次。
  // 放在 `onLaunch`（而非 `main.ts`）是为了等 tabBar 就绪，避免过早调用 `setTabBarItem` 失败。
  applyTabBarLocale((key) => i18nGlobal.t(key))

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