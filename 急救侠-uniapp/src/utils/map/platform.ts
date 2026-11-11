/**
 * F1 地图 · 平台判据的**唯一事实源**（显式模块，可被 `vi.doMock` 驱动）。
 *
 * ── 为什么单独成模块、且绝不复用 `src/utils/platform.ts` ─────────────────────
 * `src/utils/platform.ts` 的 `isWechatMP` 实现是「用条件编译指令包住一个 return true，
 *   紧随其后再放一个 return false」的自执行函数。vitest / happy-dom 没有 uni 预处理 ⇒
 *   该指令只是**死注释** ⇒ `return true` 先执行。实测（typescript.transpileModule + vm
 *   跑该文件）：`isWechatMP = true`、`isH5 = true`、`getPlatform() = 'h5'`。
 * 若拿它给 `index.vue` 的 `showRealMap` 分流，测试宿主会恒判「小程序」⇒ `showRealMap=true`
 * ⇒ 草图 `v-else` 不渲染 ⇒ `guide-aed-i18n.test.ts:232` 的 `.aed-map-pokestop` 探针必红；
 * 更隐蔽的是「在自己的新用例里 mock 掉它 ⇒ 自测全绿、生产 H5 行为与测试分叉」。
 * 因此本模块不 import `platform.ts`，也不写任何条件编译指令做逻辑分支。
 *
 * ⚠️ 注释里刻意**不写出**条件编译指令的字面量（形如井号 ifdef / 尖括号注释指令）：
 * uni-app 预处理器的 js/html 指令正则是**非行首锚定**的，注释里出现字面量指令可能被当成
 * 真实指令，造成条件块不配对、生产构建被截断。
 *
 * ── 判据优先级（全程 try/catch，任何宿主异常一律兜底 false = H5 语义）──────────
 * ① uni-app **构建期常量** `process.env.UNI_PLATFORM`：mp-weixin 构建由 Vite define 替换为
 *    `'mp-weixin'`；H5 构建为 `'h5'`；vitest 下为 `undefined` ⇒ 不命中，继续往下走。
 *    这是「在 vitest 下可安全求值为 false 的常量」，也是跨端最确定的判据。
 * ② 运行时权威判据 `uni.getSystemInfoSync().uniPlatform`（新版小程序即便补了 DOM 垫片也正确）。
 * ③ 老运行时回落：`wx.getSystemInfoSync` 存在且无 DOM。
 *
 * H5 / vitest(happy-dom) 语义：① undefined、② 测试 `uni` mock 无 `getSystemInfoSync`、
 * ③ 无 `wx` 且有 `document` ⇒ 恒为 false ⇒ 保持 **H5 语义**可测，绝不误开原生 map 分支。
 */

/**
 * 读取 uni-app 构建期平台常量。
 * 浏览器 / 小程序运行时若未注入 `process`（且 define 未替换）则返回 undefined，
 * 由后续运行时判据接管，绝不因 `process is not defined` 抛错。
 */
function readBuildPlatform(): string | undefined {
  try {
    return typeof process !== 'undefined' ? process.env.UNI_PLATFORM : undefined
  } catch {
    return undefined
  }
}

/**
 * 当前宿主是否为**微信小程序**（uni-app 原生 `<map>` 免 Key、免 SDK 路径）。
 *
 * @returns `true` 仅当构建期常量或运行时判据明确指向 mp-weixin；其余一律 `false`（H5 语义）。
 */
export function isMpWeixin(): boolean {
  try {
    const buildPlatform = readBuildPlatform()
    if (buildPlatform === 'mp-weixin') return true
    if (typeof buildPlatform === 'string' && buildPlatform.length > 0) return false

    const scope = globalThis as unknown as {
      uni?: { getSystemInfoSync?: () => { uniPlatform?: string } | undefined }
      wx?: { getSystemInfoSync?: unknown }
      window?: unknown
      document?: unknown
    }
    if (typeof scope.uni?.getSystemInfoSync === 'function') {
      const info = scope.uni.getSystemInfoSync()
      if (typeof info?.uniPlatform === 'string') {
        return info.uniPlatform === 'mp-weixin'
      }
    }
    const hasWx = typeof scope.wx !== 'undefined'
      && typeof scope.wx.getSystemInfoSync === 'function'
    const noDom = typeof scope.window === 'undefined'
      || typeof scope.document === 'undefined'
    return hasWx && noDom
  } catch {
    return false
  }
}
