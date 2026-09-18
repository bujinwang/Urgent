import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { applyNavTitle, useLocalizedNavTitle } from '@/utils/nav-title-locale'
import { setLocale } from '@/i18n'
import { messages } from '@/locales'
import { SCOPE_FILES, stripComments } from '@/__tests__/i18n-scope'

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
 *   ③ **调用点**：五个页面真的调了 `useLocalizedNavTitle('<key>')`
 *      （本项目教训：删掉页面里那一行调用，模块级测试再全也照样全绿）；
 *   ③' ★ **`pages.json` × 接入一致性**（自动跟随 `SCOPE_FILES`，非硬编码枚举）——
 *      凡「已本地化 + 标准原生标题栏」的页面都必须接线；防"新增页面忘记接标题"。
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

/** 已本地化且**有原生标题栏**的页面 —— 这是 P1b 的完整范围（5 页）。 */
const NAV_PAGES = [
  { pagePath: 'pages/aed/index', titleKey: 'nav.aedIndex', file: 'src/pages/aed/index.vue' },
  { pagePath: 'pages/drill/index', titleKey: 'nav.drill', file: 'src/pages/drill/index.vue' },
  { pagePath: 'pages/cert/index', titleKey: 'nav.mine', file: 'src/pages/cert/index.vue' },
  { pagePath: 'pages/volunteer/hours', titleKey: 'nav.hours', file: 'src/pages/volunteer/hours.vue' },
  { pagePath: 'pages/volunteer/certificates', titleKey: 'nav.serviceCert', file: 'src/pages/volunteer/certificates.vue' },
] as const

/** `src/xxx/yyy.vue` → `xxx/yyy`（与 `pages.json` 的 `path` 同形）。 */
function pagePathOf(rel: string): string {
  return rel.replace(/^src\//, '').replace(/\.vue$/, '')
}

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
  it('★ 五个页面都调用了 useLocalizedNavTitle(对应 key)', () => {
    for (const p of NAV_PAGES) {
      const src = fs.readFileSync(path.resolve(process.cwd(), p.file), 'utf8')
      expect(src, `${p.file} 应调用 useLocalizedNavTitle('${p.titleKey}')`)
        .toContain(`useLocalizedNavTitle('${p.titleKey}')`)
    }
  })

  // -------------------------------------------------------------------------
  // 2.5) ★ 【新层】`pages.json` × 接入情况的**一致性守卫**（此前完全空白的一层）
  //
  // 判据：凡「在 `SCOPE_FILES`（已本地化集合）中」且「在 `pages.json` 里声明了**原生标题栏**
  //       （有 `navigationBarTitleText` 且**非** `navigationStyle: 'custom'`）」的页面，
  //       其源码**必须**出现 `useLocalizedNavTitle(`。
  //
  // 为什么需要它：上面第 ③ 条是**硬编码枚举**（NAV_PAGES）—— 新加一个已本地化页面时，
  // 忘了接线**也能全绿**（枚举里根本没有它）。本层判据**自动跟随 SCOPE_FILES** ⇒
  // 「新增已本地化页面但忘记接标题」会被抓，而不是靠人记得改枚举。
  // 本次缺陷（两新页未接标题）正是被这一层咬住。
  // -------------------------------------------------------------------------
  it('★ 【新层】pages.json × 接入一致性：已本地化 + 标准原生标题栏的页面必须接线（防日后漏接）', () => {
    const checked = SCOPE_FILES.filter((rel) => {
      const st = styleOf(pagePathOf(rel))
      return !!st?.navigationBarTitleText && st.navigationStyle !== 'custom'
    })

    // 守卫自检（防判据退化成恒真）：必须真的覆盖到若干页面，且含本次新增两页。
    expect(checked.length, '本守卫应至少覆盖 5 个页面；为 0 说明 pages.json 路径/判据失效').toBeGreaterThanOrEqual(5)
    expect(checked, '应覆盖本次新增两页').toEqual(expect.arrayContaining([
      'src/pages/volunteer/hours.vue', 'src/pages/volunteer/certificates.vue',
    ]))

    const missing: string[] = []
    for (const rel of checked) {
      // ⚠️ 先**剥离注释**再判定：否则「注释里提到 useLocalizedNavTitle(」会造成假阴性。
      const src = stripComments(fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8'))
      if (!src.includes('useLocalizedNavTitle(')) missing.push(rel)
    }
    expect(missing, `以下「已本地化 + 标准导航栏」页面未接 useLocalizedNavTitle：${missing.join(', ')}`).toEqual([])
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
