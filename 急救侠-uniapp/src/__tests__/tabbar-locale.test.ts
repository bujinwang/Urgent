import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { applyTabBarLocale, TABBAR_ITEMS } from '@/utils/tabbar-locale'
import { setLocale } from '@/i18n'
import { messages, LOCALE_STORAGE_KEY } from '@/locales'
import { stripComments } from '@/__tests__/i18n-scope'

/**
 * F2 P1a —— tabBar 文案本地化的**独立守卫**。
 *
 * tabBar 文案写在静态的 `pages.json` 里，**不在 Vue 响应式树内** ⇒ 切语言不会自动更新，
 * 必须靠 `src/utils/tabbar-locale.ts` 显式调 `uni.setTabBarItem`。本文件守护：
 *   ① `TABBAR_ITEMS` 与 `pages.json` 的 `tabBar.list` **不漂移**（顺序 / pagePath / 顺序号 / zh 文案逐字一致）；
 *   ② `applyTabBarLocale` 把注入的 `t` 用在**每一个** tab 上（而不是漏掉某个）；
 *   ③ 宿主健壮性：`setTabBarItem` 缺失 / 单条抛错都**不得**冒泡成崩溃；
 *   ④ 与 `setLocale` 的**集成**：切语言后 4 个 tab 立即改语言；
 *   ⑤ 「无循环依赖」契约：本模块**不得** import i18n（否则与 `i18n.ts` 循环）。
 */

/** `pages.json` 的 tabBar 段（**唯一事实源**，用它交叉断言 `TABBAR_ITEMS`）。 */
const pagesJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'src/pages.json'), 'utf8'),
) as { tabBar: { list: Array<{ pagePath: string; text: string }> } }

type SetTabBarItemOpts = { index: number; text: string }

describe('applyTabBarLocale：原生 tabBar 文案同步', () => {
  beforeEach(() => {
    // 复位到 zh（并清掉 setLocale 自身产生的调用），保证每条用例从干净计数开始。
    setLocale('zh-CN')
    vi.mocked(uni.setTabBarItem).mockClear()
  })

  afterEach(() => {
    // 还原可能被个别用例改写的实现（默认返回 undefined），避免污染后续用例。
    vi.mocked(uni.setTabBarItem).mockReset()
    setLocale('zh-CN')
  })

  // -------------------------------------------------------------------------
  // 1) ★ 与 pages.json 的对齐（防"清单漂移"——文案串位最常见的方式）
  // -------------------------------------------------------------------------
  it('★ TABBAR_ITEMS 与 pages.json 的 tabBar.list 顺序 / pagePath / index 逐一对齐', () => {
    const list = pagesJson.tabBar.list
    expect(TABBAR_ITEMS.map((i) => i.pagePath)).toEqual(list.map((i) => i.pagePath))
    expect(TABBAR_ITEMS.map((i) => i.index)).toEqual(list.map((_, i) => i))
  })

  it('★ zh 文案与 pages.json 的 tabBar.list[].text 逐字一致（否则切回中文时 tab 会"变样"）', () => {
    const list = pagesJson.tabBar.list
    const zhTabbar = messages['zh-CN'].tabbar as Record<string, string>
    const fromLocale = TABBAR_ITEMS.map((i) => zhTabbar[i.textKey.replace('tabbar.', '')])
    expect(fromLocale).toEqual(list.map((i) => i.text))
  })

  // -------------------------------------------------------------------------
  // 2) ★ 注入式 t：每个 tab 都被同步，键 = tabbar.*
  // -------------------------------------------------------------------------
  it('★ 对每个 tab 调一次 setTabBarItem，text 来自注入的 t（本模块不 import i18n）', () => {
    const t = vi.fn((k: string) => `T:${k}`)
    applyTabBarLocale(t)

    expect(t.mock.calls.map((c) => c[0])).toEqual([
      'tabbar.home', 'tabbar.aed', 'tabbar.learn', 'tabbar.mine',
    ])
    expect(vi.mocked(uni.setTabBarItem).mock.calls.map((c) => c[0] as SetTabBarItemOpts)).toEqual([
      { index: 0, text: 'T:tabbar.home' },
      { index: 1, text: 'T:tabbar.aed' },
      { index: 2, text: 'T:tabbar.learn' },
      { index: 3, text: 'T:tabbar.mine' },
    ])
  })

  // -------------------------------------------------------------------------
  // 3) ★ 宿主健壮性：缺失 / 单条抛错都不得崩
  // -------------------------------------------------------------------------
  it('★ 宿主无 setTabBarItem ⇒ 静默返回、不抛（低版本宿主 / 非 tabBar 场景）', () => {
    const saved = (uni as unknown as { setTabBarItem?: unknown }).setTabBarItem
    ;(uni as unknown as { setTabBarItem?: unknown }).setTabBarItem = undefined
    try {
      expect(() => applyTabBarLocale((k) => k)).not.toThrow()
    } finally {
      ;(uni as unknown as { setTabBarItem?: unknown }).setTabBarItem = saved
    }
  })

  it('★ 单条 setTabBarItem 抛错 ⇒ 其余 3 条仍被同步（逐项 try/catch，不因一条失败而中断）', () => {
    const called: number[] = []
    vi.mocked(uni.setTabBarItem).mockImplementation(((opts: SetTabBarItemOpts) => {
      called.push(opts.index)
      if (opts.index === 1) throw new Error('tab boom')
    }) as never)

    expect(() => applyTabBarLocale((k) => k)).not.toThrow()
    expect(called).toEqual([0, 1, 2, 3])
  })

  // -------------------------------------------------------------------------
  // 4) ★ 与 setLocale 的集成：切语言 ⇒ 4 个 tab 立即改语言（并写存储）
  // -------------------------------------------------------------------------
  it('★ 集成：setLocale("en-US") ⇒ 4 个 tab 文案立即变英文，且写 app_locale', () => {
    setLocale('en-US')

    expect(vi.mocked(uni.setTabBarItem).mock.calls.map((c) => (c[0] as SetTabBarItemOpts).text))
      .toEqual(['Home', 'AED', 'Learn', 'Mine'])
    expect(uni.setStorageSync).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en-US')

    vi.mocked(uni.setTabBarItem).mockClear()
    setLocale('zh-CN')
    expect(vi.mocked(uni.setTabBarItem).mock.calls.map((c) => (c[0] as SetTabBarItemOpts).text))
      .toEqual(['首页', 'AED', '学习', '我的'])
  })

  it('★ tabbar.* 四键在两个 locale 下都非空、且不是裸 key', () => {
    for (const loc of ['zh-CN', 'en-US'] as const) {
      const tb = messages[loc].tabbar as Record<string, string>
      for (const item of TABBAR_ITEMS) {
        const key = item.textKey.replace('tabbar.', '')
        expect(tb[key], `${loc}:${item.textKey} 为空`).toBeTruthy()
        expect(tb[key], `${loc}:${item.textKey} 是裸 key`).not.toBe(item.textKey)
      }
    }
  })

  // -------------------------------------------------------------------------
  // 5) ★ 无循环依赖契约（源码级）
  // -------------------------------------------------------------------------
  it('★ 无循环依赖：tabbar-locale.ts 不得 import i18n（否则与 i18n.ts 循环 ⇒ 启动 TDZ 崩）', () => {
    // 剥离注释后再扫：文件头**注释里**为说明原因引用了 `import { i18n } from '@/i18n'`，
    // 它**不是**真实依赖，不能被误判（真实的循环依赖只看可执行的 import 语句）。
    const src = stripComments(
      fs.readFileSync(path.resolve(process.cwd(), 'src/utils/tabbar-locale.ts'), 'utf8'),
    )
    expect(/from\s+['"][^'"]*i18n['"]/.test(src), 'tabbar-locale.ts 禁止 import i18n').toBe(false)
  })
})
