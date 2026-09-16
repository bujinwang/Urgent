import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import { i18n } from '@/i18n'

/**
 * F2 P0-3 测试基建（设计 §10.1）。
 *
 * vue-i18n v9 下，页面模板里的 `$t(...)` 与 `<script setup>` 的 `useI18n()`
 * **都要求 i18n 已通过 `app.use(i18n)` 安装**，否则 `useI18n()` 直接抛
 * `Need to install with 'app.use' function`。`main.ts` 里是 `app.use(i18n)`，
 * 但 `@vue/test-utils` 的 `mount()` 默认**不会**带上它 ⇒ 所有页面测试会当场崩。
 *
 * 这里把 `i18n` 注册到 VTU 的**全局配置**上，等价于给每个测试 app 装一次插件。
 * `i18n.ts` 已开 `globalInjection: true`，因此模板里的 `$t(...)` 可直接使用。
 */
config.global.plugins = [i18n]

/**
 * ⚠️ 必读：为什么要在测试里把 `i18n.dispose` 置为空操作。
 *
 * vue-i18n v9 的 `install()` 会**改写 `app.unmount`**（见 vue-i18n 源码
 * `dist/vue-i18n.mjs` 的 `install()`）：
 * ```js
 * const unmountApp = app.unmount
 * app.unmount = () => { globalReleaseHandler?.(); i18n.dispose(); unmountApp() }
 * ```
 * 而 `dispose()` 会 `globalScope.stop()` —— 而**整个 composer 就是在
 * `globalScope.run(() => createComposer(...))` 里创建的**（同文件 `createGlobal()`）。
 *
 * 于是：VTU 的 `config.global.plugins` 让**每个用例**的 mount 都 `app.use(i18n)`，
 * 而第一个用例 `wrapper.unmount()` 就会 `i18n.dispose()`，把**共享单例**的
 * `globalScope` 停掉 ⇒ `composer.locale`（一个 computed）从此冻结在旧值，
 * 后续用例里 `setLocale()` 不再响应式生效（实测：`voiceLang` 永远停在首次语言）。
 *
 * 测试里 mount/unmount 了大量 app 却共用一个 i18n 单例，"卸载其一就销毁全局" 是错误的语义；
 * 生产环境只 `app.use(i18n)` 一次、App 从不卸载，**不受此影响**。故此处仅把测试期的
 * `dispose` 降级为空操作（`injectGlobalFields` 的 release 仍照常清理该 app 自身的 `$t`）。
 */
;(i18n as unknown as { dispose?: () => void }).dispose = () => {}

// Mock SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  text: string = ''
  voice: any = null
  lang: string = 'zh-CN'
  rate: number = 1
  pitch: number = 1
  volume: number = 1
  onend: (() => void) | null = null
  constructor(text?: string) { if (text) this.text = text }
}
;(global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance

// Mock uni-app global with proper lifecycle hook execution
const lifecycleHooks: Record<string, Array<() => void>> = {}

const uniMock = {
  getStorageSync: vi.fn((key: string) => {
    const store: Record<string, string> = {
      jwt_token: 'mock-token-123',
    }
    return store[key] || ''
  }),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
  showLoading: vi.fn(),
  hideLoading: vi.fn(),
  showModal: vi.fn(),
  navigateTo: vi.fn(),
  redirectTo: vi.fn(),
  switchTab: vi.fn(),
  // F2 P1a：`setLocale()` 会在末尾同步原生 tabBar（`applyTabBarLocale`）⇒ 必须提供该宿主方法，
  // 否则 `typeof uni.setTabBarItem !== 'function'` 会让同步被静默跳过、相关断言无从覆盖。
  // F2 P1b：`useLocalizedNavTitle()` 会调它同步原生导航栏标题 ⇒ 必须提供该宿主方法，
  // 否则 `typeof uni.setNavigationBarTitle !== 'function'` 会让同步被静默跳过、相关断言无从覆盖。
  setNavigationBarTitle: vi.fn(),
  setTabBarItem: vi.fn(),
  navigateBack: vi.fn(),
  request: vi.fn(),
  getLocation: vi.fn((opts: any) => {
    if (opts?.success) {
      opts.success({ latitude: 22.517, longitude: 113.947, accuracy: 10 })
    }
  }),
  chooseLocation: vi.fn((opts: any) => {
    if (opts?.success) {
      opts.success({ latitude: 22.517, longitude: 113.947, name: 'test', address: 'test addr' })
    }
  }),
  makePhoneCall: vi.fn(),
  vibrateShort: vi.fn(),
  uploadFile: vi.fn((opts: { success?: (r: { data: string }) => void }) => {
    opts?.success?.({ data: JSON.stringify({ code: 0, data: { uploadId: 'upload_test', url: '/uploads/media/test.jpg', message: 'ok' } }) })
    return { onProgressUpdate: vi.fn() }
  }),
}

;(global as any).uni = uniMock
;(global as any).getCurrentPages = vi.fn(() => [{ options: {}, route: 'pages/home/index' }])

// Mock @dcloudio/uni-app — lifecycle hooks must actually run callbacks
vi.mock('@dcloudio/uni-app', () => ({
  onLaunch: vi.fn((cb: () => void) => { cb() }),
  onShow: vi.fn((cb: () => void) => { cb() }),
  onHide: vi.fn((cb: () => void) => { cb() }),
  onMounted: vi.fn(),
  onUnmounted: vi.fn((cb: () => void) => {
    // Store for cleanup
  }),
  onLoad: vi.fn(),
  onReady: vi.fn(),
  onReachBottom: vi.fn(),
}))

// Mock API index
vi.mock('@/api/index', () => ({
  BASE_URL: '/api',
  request: vi.fn(() => Promise.resolve(null)),
  requestFull: vi.fn(() => Promise.resolve({ code: 0, message: 'ok' })),
  default: vi.fn(() => Promise.resolve(null)),
}))
