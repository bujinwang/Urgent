/**
 * 原生导航栏标题本地化 —— 让「已本地化页面」的导航栏标题随语言切换（F2 P1b）。
 *
 * 设计依据：`deliverables/software-company/i18n-emergency-flow-design.md`
 * §6（P1 分期）与 §15.6（P1b 待办）。
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 为什么需要这个模块：
 * `pages.json` 的 `style.navigationBarTitleText` 是**静态声明**，它**不在 Vue 的响应式树内** ——
 * `i18n.global.locale` 改变**不会**让原生导航栏自动更新。必须显式调 `uni.setNavigationBarTitle`。
 * （与 `utils/tabbar-locale.ts` 同族问题：tabBar 也是同一个毛病。）
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ 适用范围（刻意收窄，不要扩大）：
 * 只为「**文案已本地化**的页面」同步标题。尚未本地化的页面整页都是中文，
 * 单独把标题换成英文只会得到「英文标题 + 中文正文」的畸形状态，比现状更糟。
 * 因此 `pages.json` 里其余几十个中文标题**按已知边界保留**（设计 §15.6）。
 *
 * 另外：`rescue` / `guide` / `aed/detail` 三页是 `navigationStyle: 'custom'`（自绘导航栏），
 * **没有原生标题栏** ⇒ 无需同步（它们页内的标题文案本身就是 `t()` 渲染的）。
 *
 * ⚠️ 本模块可以 `import { i18n }`（与 `tabbar-locale.ts` 不同）：`i18n.ts` **不会**反向 import
 * 本模块，因此**不存在**循环依赖。`tabbar-locale` 之所以禁止 import，是因为 `setLocale()` 会调它。
 */
import { onMounted, watchEffect } from 'vue'
import { i18n } from '@/i18n'

/** 组合式 i18n 实例的最小脸谱（`legacy:false` ⇒ `t` 直接返回 `string`）。 */
const i18nGlobal = i18n.global as unknown as { t: (key: string) => string }

/**
 * 把导航栏标题写成 `title`。宿主不支持 / 调用抛错时**静默返回**。
 *
 * ⚠️ 为什么必须 `typeof` 守卫：`uni.setNavigationBarTitle` 在纯单测 mock、部分宿主、
 * 或非页面上下文中可能不存在（前例：`uni.getLocale` 在 `__tests__/setup.ts` 的 mock 里没有实现，
 * 直接调用会在测试中抛 `undefined is not a function`，见 `src/i18n.ts` 的 `readSystemLocale` 注释）。
 */
export function applyNavTitle(title: string): void {
  if (typeof uni === 'undefined' || typeof uni.setNavigationBarTitle !== 'function') return
  try {
    uni.setNavigationBarTitle({ title })
  } catch {
    // 标题没跟上是可以接受的降级；抛出去让页面崩掉则不行。
  }
}

/**
 * 在页面 setup 里调用，把该页的原生导航栏标题接到当前语言。
 *
 * @param titleKey `locales/*.ts` 里的 `nav.*` 键。
 *
 * ★ **为什么必须这里才响应式**：`watchEffect` 内部读了 `i18nGlobal.t(...)`，
 * 而 `t()` 会读 `locale` ⇒ 建立依赖 ⇒ **切换语言时重跑**。
 * 若在 setup 顶层先取值再设置（`const title = t(key); setTitle(title)`），
 * 就会退化成「只在 setup 期求值一次」的**语言冻结**（设计 §3.5 / §11.1、§15.2）。
 *
 * `onMounted` 里再补一次：部分宿主要求标题在页面挂载后才允许改写。
 */
export function useLocalizedNavTitle(titleKey: string): void {
  watchEffect(() => {
    applyNavTitle(i18nGlobal.t(titleKey))
  })
  onMounted(() => {
    applyNavTitle(i18nGlobal.t(titleKey))
  })
}
