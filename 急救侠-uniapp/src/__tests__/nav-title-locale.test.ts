import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { applyNavTitle, useLocalizedNavTitle } from '@/utils/nav-title-locale'
import { setLocale } from '@/i18n'
import { messages } from '@/locales'

/**
 * F2 P1b —— **原生导航栏标题**随语言切换的独立守卫。
 *
 * `pages.json` 的 `style.navigationBarTitleText` 是静态声明、**不在 Vue 响应式树内**
 * ⇒ 切语言不会自动更新，必须靠 `src/utils/nav-title-locale.ts` 显式调
 * `uni.setNavigationBarTitle`（与 tabBar 是同一族毛病）。
 *
 * 本文件守护：
 *   ① `nav.*` 文案与 `pages.json` 的 `navigationBarTitleText` **逐字**（否则切回中文会"变样"）；
 *   ② 范围刻意收窄 —— **只**收录「文案已本地化」的页面；
 *      `rescue`/`guide`/`aed-detail` 是 `navigationStyle:'custom'`（自绘标题栏）⇒ 不得收录；
 *   ③ **调用点**：三个页面真的调了 `useLocalizedNavTitle('<key>')`
 *      （本项目教训：删掉页面里那一行调用，模块级测试再全也照样全绿）；
 *   ④ 宿主健壮性：方法缺失 / 调用抛错都**不得**冒泡成崩溃；
 *   ⑤ **非冻结**：切语言后标题必须重新设置为新语言（而不是停在 setup 期取到的值）。
 */

/** `pages.json`（唯一事实源）。 */
const pagesJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'src/pages.json'), 'utf8'),
) as {
  pages: Array<{
    path: string
    style?: { navigationBarTitleText?: string; navigationStyle?: string }
  }>
}

/** 已本地化且**有原生标题栏**的页面 —— 这三者是 P1b 的完整范围。 */
const NAV_PAGES = [
  { pagePath: 'pages/aed/index', titleKey: 'nav.aedIndex', file: 'src/pages/aed/index.vue' },
  { pagePath: 'pages/drill/index', titleKey: 'nav.drill', file: 'src/pages/drill/index.vue' },
  { pagePath: 'pages/cert/index', titleKey: 'nav.mine', file: 'src/pages/cert/index.vue' },
] as const

/** `pages.json` 里某个 pagePath 的 `style`（找不到 ⇒ undefined）。 */
function styleOf(pagePath: string) {
  return pagesJson.pages.find((p) => p.path === pagePath)?.style
}

describe('P1b：原生导航栏标题本地化', () => {
  beforeEach(() => {
    setLocale('zh-CN')
    vi.mocked(uni.setNavigationBarTitle).mockClear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.mocked(uni.setNavigationBarTitle).mockReset()
    setLocale('zh-CN')
  })

  // -------------------------------------------------------------------------
  // 1) ★ 与 pages.json 的对齐 + 范围刻意收窄
  // -------------------------------------------------------------------------
  it('★ zh 文案与 pages.json 的 navigationBarTitleText 逐字一致（否则切回中文时标题会"变样"）', () => {
    const zhNav = messages['zh-CN'].nav as Record<string, string>
    for (const p of NAV_PAGES) {
      const key = p.titleKey.replace('nav.', '')
      expect(zhNav[key], `${p.pagePath} 的标题`).toBe(styleOf(p.pagePath)?.navigationBarTitleText)
    }
  })

  it('★ nav 组的键集 === NAV_PAGES（既不多也不少；新增"已本地化的标准导航栏页"时须同步本表）', () => {
    const zhNav = messages['zh-CN'].nav as Record<string, string>
    const enNav = messages['en-US'].nav as Record<string, string>
    const expected = NAV_PAGES.map((p) => p.titleKey.replace('nav.', '')).sort()
    expect(Object.keys(zhNav).sort(), 'zh-CN.nav 键集').toEqual(expected)
    expect(Object.keys(enNav).sort(), 'en-US.nav 键集').toEqual(expected)
  })

  it('★ rescue / guide / aed-detail 是 custom 导航栏（自绘标题栏）⇒ 刻意不进 nav 组', () => {
    for (const p of ['pages/rescue/index', 'pages/guide/index', 'pages/aed/detail']) {
      expect(styleOf(p)?.navigationStyle, `${p} 应为自绘导航栏`).toBe('custom')
    }
    // 反向：它们的 pagePath 不应出现在 NAV_PAGES 里
    expect(NAV_PAGES.map((p) => p.pagePath)).not.toContain('pages/rescue/index')
    expect(NAV_PAGES.map((p) => p.pagePath)).not.toContain('pages/aed/detail')
  })

  it('★ en 侧三条非空，且与 zh 不同（防止"照抄中文"被误判为已翻译）', () => {
    const zhNav = messages['zh-CN'].nav as Record<string, string>
    const enNav = messages['en-US'].nav as Record<string, string>
    for (const k of Object.keys(zhNav)) {
      expect(enNav[k], `en-US.nav.${k}`).toBeTruthy()
      expect(enNav[k], `en-US.nav.${k} 不应等于 zh`).not.toBe(zhNav[k])
    }
  })

  // -------------------------------------------------------------------------
  // 2) ★ 调用点守卫：页面里那一行真的在吗？
  //    （本项目教训：模块级测试再全，删掉页面里那一行调用仍会全绿）
  // -------------------------------------------------------------------------
  it('★ 三个页面都调用了 useLocalizedNavTitle(对应 key)', () => {
    for (const p of NAV_PAGES) {
      const src = fs.readFileSync(path.resolve(process.cwd(), p.file), 'utf8')
      expect(src, `${p.file} 应调用 useLocalizedNavTitle('${p.titleKey}')`)
        .toContain(`useLocalizedNavTitle('${p.titleKey}')`)
    }
  })

  // -------------------------------------------------------------------------
  // 3) 宿主健壮性：缺方法 / 抛错都不得崩
  // -------------------------------------------------------------------------
  it('★ 宿主没有 setNavigationBarTitle ⇒ 静默返回，不抛错', () => {
    vi.stubGlobal('uni', {})
    expect(() => applyNavTitle('急救演习')).not.toThrow()
  })

  it('★ setNavigationBarTitle 抛错 ⇒ 不冒泡（"标题没跟上"可接受，"页面崩了"不行）', () => {
    vi.mocked(uni.setNavigationBarTitle).mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(() => applyNavTitle('急救演习')).not.toThrow()
  })

  it('★ applyNavTitle 把标题原样写进去', () => {
    applyNavTitle('Nearby AED')
    expect(vi.mocked(uni.setNavigationBarTitle).mock.calls.at(-1)?.[0]).toEqual({ title: 'Nearby AED' })
  })

  // -------------------------------------------------------------------------
  // 4) ★ 非冻结：切语言后标题必须重新设置（不是停在 setup 期的值）
  // -------------------------------------------------------------------------
  it('★ useLocalizedNavTitle：setup 时写 zh；切到 en 后自动重写为英文（语言不冻结）', async () => {
    const Probe = defineComponent({
      setup() {
        useLocalizedNavTitle('nav.drill')
        return () => h('div')
      },
    })

    const wrapper = mount(Probe)
    await wrapper.vm.$nextTick()
    const zhCalls = vi.mocked(uni.setNavigationBarTitle).mock.calls.map((c) => c[0]?.title)
    expect(zhCalls.every((t) => t === messages['zh-CN'].nav.drill), `首轮应全是 zh：${zhCalls}`).toBe(true)
    expect(zhCalls.length, '至少要写过一次').toBeGreaterThan(0)

    vi.mocked(uni.setNavigationBarTitle).mockClear()
    setLocale('en-US')
    await wrapper.vm.$nextTick()

    const enCalls = vi.mocked(uni.setNavigationBarTitle).mock.calls.map((c) => c[0]?.title)
    expect(enCalls.length, '切语言后必须重写标题（否则就是语言冻结）').toBeGreaterThan(0)
    expect(enCalls.every((t) => t === messages['en-US'].nav.drill), `轮二应全是 en：${enCalls}`).toBe(true)
    expect(enCalls.at(-1)).toBe('Emergency drills')

    wrapper.unmount()
  })
})
