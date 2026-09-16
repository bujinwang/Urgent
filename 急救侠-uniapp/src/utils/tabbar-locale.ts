/**
 * tabBar 文案本地化 —— 语言切换 / 启动时，把 4 个 tab 的文字同步为当前语言。
 *
 * 设计依据：`deliverables/software-company/i18n-emergency-flow-design.md`
 * §6 分期实施（**P1 = 语言切换入口**，放「设置/我的」页、**不得进 SOS 主流程**，PRD §8）
 * 与 §3.5 / §11.1（语言冻结：`t` 不可在 setup 顶层取值）。
 * tabBar 同步是切换入口的**必要配套** —— 它不在设计文档单列，故此处注明。
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 为什么需要这个模块：
 * `pages.json` 的 `tabBar.list[].text` 是**静态声明**，它**不在 Vue 的响应式树内** ——
 * `i18n.global.locale` 改变**不会**让原生 tabBar 自动更新。因此必须在「切换语言」与
 * 「App 启动」两个时点**显式**调用 `uni.setTabBarItem` 同步一次。
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ 硬约束 1（禁止 import i18n）：
 * `src/i18n.ts` 的 `setLocale()` **会调用本模块**。若本模块反向 `import { i18n } from '@/i18n'`，
 * 就形成 `i18n.ts ↔ tabbar-locale.ts` 的**循环依赖**：在 ESM / uni-app 的初始化顺序下，
 * 一方可能拿到**尚未初始化**的绑定（TDZ，`Cannot access 'X' before initialization`），
 * 表现为**启动即崩**且堆栈指向无辜的模块。
 * ⇒ 因此这里把翻译函数 `t` 作为**参数注入**，本模块对 i18n **零依赖**（唯一 import 的是类型）。
 *
 * ⚠️ 硬约束 2（宿主兼容）：
 * `uni.setTabBarItem` 在部分宿主（纯单测 mock / 低版本小程序 / H5 某些时序）**不存在**，
 * 或**调用抛错**（例如非 tabBar 页面 / 尚未 ready）。⇒ ① `typeof` 守卫；
 * ② **逐项 `try/catch`**：单个 tab 同步失败绝不允许影响其余 tab，更不允许冒泡成崩溃
 * （"语言切了但 app 崩了"比"某个 tab 文案没跟上"严重得多）。
 */

/**
 * tabBar 条目表 —— **顺序与 `pagePath` 必须与 `pages.json` 的 `tabBar.list` 逐字对应**。
 *
 * `index` 即 `tabBar.list` 中的下标（`uni.setTabBarItem({ index })` 依赖它）。
 * `textKey` 指向 `locales/*.ts` 的 `tabbar.*`（值须与 `pages.json` 的 zh 文案逐字一致）。
 *
 * ⚠️ 改动 `pages.json` 的 tabBar（增删 / 重排）时**必须同步本表**，否则文案会串位。
 * 这条对齐关系由 `src/__tests__/tabbar-locale.test.ts` 与 `pages.json` 交叉断言守护。
 */
export const TABBAR_ITEMS = [
  { index: 0, pagePath: 'pages/home/index', textKey: 'tabbar.home' },
  { index: 1, pagePath: 'pages/aed/index', textKey: 'tabbar.aed' },
  { index: 2, pagePath: 'pages/learn/index', textKey: 'tabbar.learn' },
  { index: 3, pagePath: 'pages/cert/index', textKey: 'tabbar.mine' },
] as const

/** 单个 tabBar 条目的形状。 */
export type TabBarItem = (typeof TABBAR_ITEMS)[number]

/**
 * 把 tabBar 4 个 tab 的文字同步为「当前语言」。
 *
 * @param t 翻译函数（**由调用方注入** —— 见文件头「硬约束 1」）。入参为 `tabbar.*` 键，
 *          返回该键在当前语言下的文案。
 *
 * 副作用：对每个 tab 调一次 `uni.setTabBarItem({ index, text })`。
 * 全程**安全**：宿主不支持则直接返回；单条失败静默跳过（见「硬约束 2」）。
 */
export function applyTabBarLocale(t: (key: string) => string): void {
  // 宿主未提供 setTabBarItem（纯单测 / 低版本宿主）⇒ 静默跳过，绝不抛错。
  if (typeof uni === 'undefined' || typeof uni.setTabBarItem !== 'function') return

  for (const item of TABBAR_ITEMS) {
    try {
      uni.setTabBarItem({ index: item.index, text: t(item.textKey) })
    } catch {
      // 单条失败不影响其它 tab（例如某项暂不可用 / 页面未 ready）。
    }
  }
}
