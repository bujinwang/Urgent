import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { SCOPE_FILES, hasCjk } from '@/__tests__/i18n-scope'

/**
 * F2 P1a —— `pages/cert/index.vue`（「我的」页）文案本地化 + **语言切换入口** 的独立守卫。
 *
 * 与 `rescue-i18n.test.ts` / `guide-aed-i18n.test.ts` 同构，覆盖静态扫描咬不住的三类：
 *   ① **运行时 reactivity**（切语言 ⇒ 页面立即改语言，尤其 `tierLabel` 的「语言冻结」回归）
 *   ② **en-US 渲染快照**（页面文本不含中文 —— 覆盖运行时才拼出来的字符串）
 *   ③ **内容完整性**（渲染值 === locale 值）
 * 并额外守护 P1a 特有契约：
 *   ④ **语言切换入口**的端到端行为（点选项 ⇒ locale / 持久化 / tabBar 同步 / 高亮）
 *   ⑤ 入口**登录 + 游客两分支都可达**（游客必须能切语言）
 *   ⑥ 动态拼 key `mine.tier.*` 的显式枚举 + `SCOPE_FILES` 已纳入 cert 页
 *
 * ⚠️ 语言名（`mine.lang.zh` = 「简体中文」）按设计「各语言下都写自己的名字」⇒
 * **en 模式下刻意保留中文**；故 en「无中文」快照会先把这一个刻意的自名剔除再判。
 * 这条边界即设计 §13.1「英文界面无中文「KPI 的**适用边界**」的一个实例（语言自名不算漏抽）。
 */

/** 用户资料夹具 —— 每个用例改 `current` 决定「登录（有基础资料）/ 游客（id 为空）」两分支。 */
const profileFixture = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}))

vi.mock('@/api/user', () => ({
  fetchProfile: vi.fn(() => Promise.resolve(profileFixture.current)),
  fetchStats: vi.fn(() => Promise.resolve({
    certifiedRescuers: 0, networkedAeds: 0, monthlyRescues: 0, onlineVolunteers: 0, aedsWithin1km: 0,
  })),
  awardPointsApi: vi.fn(() => Promise.resolve({ points: 0, tier: 'bronze', reason: '' })),
}))

/** AED store 自刷新会拉列表；返回空列表即可（cert 页只读 `aeds` 过滤打卡记录）。 */
vi.mock('@/api/aed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/aed')>()
  return { ...actual, fetchAedList: vi.fn(() => Promise.resolve([])) }
})

/** 机构角色：空 ⇒ `isOrgManager===false`（入口网格固定 7 项，org 项不渲染）。 */
vi.mock('@/api/org', () => ({
  fetchUserOrgRoles: vi.fn(() => Promise.resolve([])),
}))

import { i18n, setLocale, getLocale } from '@/i18n'
import { messages, LOCALE_STORAGE_KEY } from '@/locales'

const LOCALES = ['zh-CN', 'en-US'] as const

/** 具名插值还原（锚到 locale 模板，不在测试里硬抄文案）。 */
const interp = (tpl: string, params: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(params[k]))

const LOGGED_IN_PROFILE = {
  id: 'u1', name: 'Alex', avatar: 'A', tier: 'bronze', points: 1234,
  city: '', volunteerId: 'V-001', certifications: ['CPR Cert'], rescueCount: 3,
  volunteer_type: 'medical',
}
const GUEST_PROFILE = {
  id: '', name: 'Guest', avatar: '?', tier: 'bronze', points: 0,
  city: '', volunteerId: '', certifications: [] as string[], rescueCount: 0,
  volunteer_type: 'medical',
}

async function mountCert() {
  const page = await import('@/pages/cert/index.vue')
  const wrapper = mount(page.default)
  await flushPromises() // 让 user store 的 refresh() 落地并注入资料（决定登录 / 游客分支）
  await nextTick()
  return wrapper
}

/**
 * en「无中文」快照的判据：把**唯一刻意保留的语言自名**（`mine.lang.zh` = 「简体中文」）移除后，
 * 页面其余文本不得再有任何中文字符。
 */
function expectNoCjkExceptLangName(wrapper: ReturnType<typeof mount>): void {
  const text = wrapper.text()
  const selfName = messages['en-US'].mine.lang.zh
  expect(text, '语言切换器应保留语言自名').toContain(selfName)
  expect(hasCjk(text.replace(selfName, '')), `en 页除语言自名外不得有中文：${text}`).toBe(false)
}

describe('P1a：我的页（cert）文案本地化 + 语言切换入口', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    setLocale('zh-CN')
    profileFixture.current = { ...LOGGED_IN_PROFILE }
  })

  afterEach(() => {
    vi.useRealTimers()
    setLocale('zh-CN')
    wrapper?.unmount()
    wrapper = null
  })

  // -------------------------------------------------------------------------
  // 1) ★ reactivity：切语言后页面立即改语言（重点：tierLabel「语言冻结」回归）
  // -------------------------------------------------------------------------
  describe('reactivity：切语言后页面立即改语言（防"语言冻结"）', () => {
    it('★ tierLabel（原为模块内字面量映射 ⇒ 语言冻结）：zh → en → zh 都立即生效', async () => {
      profileFixture.current = { ...LOGGED_IN_PROFILE, tier: 'gold' }
      wrapper = await mountCert()

      const gold = (loc: typeof LOCALES[number]) => messages[loc].mine.tier.gold
      const certTier = (loc: typeof LOCALES[number]) =>
        interp(messages[loc].mine.certTier, { tier: gold(loc) })

      expect(wrapper.find('.cert-tier').text()).toBe(certTier('zh-CN'))
      expect(wrapper.findAll('.cert-meta-value')[1].text()).toBe(gold('zh-CN'))

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.cert-tier').text()).toBe(certTier('en-US'))
      expect(wrapper.findAll('.cert-meta-value')[1].text()).toBe(gold('en-US'))

      setLocale('zh-CN'); await nextTick()
      expect(wrapper.find('.cert-tier').text()).toBe(certTier('zh-CN'))
      expect(wrapper.findAll('.cert-meta-value')[1].text()).toBe(gold('zh-CN'))
    })

    it('★ 静态入口网格标题：zh → en 立即生效', async () => {
      wrapper = await mountCert()
      const labels = () => wrapper!.findAll('.cert-action-label').map((n) => n.text())
      // F4 T04：入口网格新增 2 项（「我的服务时长」/「我的服务证明」）⇒ 共 9 项（org 项不渲染）。
      const expected = (loc: (typeof LOCALES)[number]) => [
        ...Object.values(messages[loc].mine.actions).slice(0, 7),
        messages[loc].hours.title,
        messages[loc].serviceCert.title,
      ]
      expect(labels()).toEqual(expected('zh-CN'))

      setLocale('en-US'); await nextTick()
      expect(labels()).toEqual(expected('en-US'))
    })
  })

  // -------------------------------------------------------------------------
  // 2) ★ 内容完整性：渲染值 === locale 值（锚到 locale，不硬抄）
  // -------------------------------------------------------------------------
  describe('★ 内容完整性：渲染值 === locale 值', () => {
    for (const loc of LOCALES) {
      it(`★ [${loc}] 统计三格 + 顶部 9 个入口标题 === locale 值`, async () => {
        setLocale(loc)
        wrapper = await mountCert()
        const m = messages[loc].mine

        expect(wrapper.findAll('.profile-stat-label').map((n) => n.text()))
          .toEqual([m.statRescues, m.statPoints, m.statCerts])
        expect(wrapper.findAll('.cert-action-label').map((n) => n.text()))
          .toEqual([
            ...Object.values(m.actions).slice(0, 7),
            messages[loc].hours.title,
            messages[loc].serviceCert.title,
          ])
      })

      it(`★ [${loc}] 游客分支：CTA 标题 / 说明 / 按钮 === locale 值`, async () => {
        profileFixture.current = { ...GUEST_PROFILE }
        setLocale(loc)
        wrapper = await mountCert()
        const m = messages[loc].mine

        expect(wrapper.find('.cert-guest-cta').exists()).toBe(true)
        expect(wrapper.find('.cert-guest-title').text()).toBe(m.guestTitle)
        expect(wrapper.find('.cert-guest-desc').text()).toBe(m.guestDesc)
        expect(wrapper.find('.cert-guest-btn').text()).toBe(m.guestBtn)
      })
    }
  })

  // -------------------------------------------------------------------------
  // 3) ★ en-US 渲染快照：页面文本（除刻意保留的语言自名）不含中文
  // -------------------------------------------------------------------------
  describe('★ en-US 渲染快照：页面文本不含中文（排除刻意保留的语言自名）', () => {
    it('★ 登录分支（有认证）', async () => {
      setLocale('en-US')
      wrapper = await mountCert()
      expect(wrapper.find('.cert-card').exists()).toBe(true)
      expectNoCjkExceptLangName(wrapper)
    })

    it('★ 登录分支（无认证 ⇒ 新人卡）', async () => {
      profileFixture.current = { ...LOGGED_IN_PROFILE, certifications: [] }
      setLocale('en-US')
      wrapper = await mountCert()
      expect(wrapper.find('.cert-tier').text()).toBe(messages['en-US'].mine.newcomer)
      expectNoCjkExceptLangName(wrapper)
    })

    it('★ 游客分支', async () => {
      profileFixture.current = { ...GUEST_PROFILE }
      setLocale('en-US')
      wrapper = await mountCert()
      expect(wrapper.find('.cert-guest-cta').exists()).toBe(true)
      expectNoCjkExceptLangName(wrapper)
    })
  })

  // -------------------------------------------------------------------------
  // 4) ★ 语言切换入口（放「我的」页 ⇒ 不进 SOS 主流程）
  // -------------------------------------------------------------------------
  describe('★ 语言切换入口', () => {
    it('★ 点英文：getLocale=en-US + 写 app_locale + setTabBarItem ×4 收到英文 tab 文案 + 选中项高亮', async () => {
      wrapper = await mountCert()
      expect(wrapper.find('.cert-lang-option.active').text()).toBe(messages['zh-CN'].mine.lang.zh)

      vi.mocked(uni.setStorageSync).mockClear()
      vi.mocked(uni.setTabBarItem).mockClear()

      await wrapper.findAll('.cert-lang-option')[1].trigger('click') // English
      await nextTick()

      expect(getLocale()).toBe('en-US')
      expect(uni.setStorageSync).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'en-US')

      const calls = vi.mocked(uni.setTabBarItem).mock.calls.map((c) => c[0] as { index: number; text: string })
      expect(calls.length, '应同步 4 个 tab').toBe(4)
      expect(calls.map((c) => c.index)).toEqual([0, 1, 2, 3])
      expect(calls.map((c) => c.text)).toEqual(['Home', 'AED', 'Learn', 'Mine'])

      expect(wrapper.find('.cert-lang-option.active').text()).toBe(messages['en-US'].mine.lang.en)
    })

    it('★ 双向：en → zh 也能切回（防"只能切一次"）', async () => {
      setLocale('en-US')
      wrapper = await mountCert()
      expect(wrapper.find('.cert-lang-option.active').text()).toBe(messages['en-US'].mine.lang.en)

      vi.mocked(uni.setStorageSync).mockClear()
      await wrapper.findAll('.cert-lang-option')[0].trigger('click') // 简体中文
      await nextTick()

      expect(getLocale()).toBe('zh-CN')
      expect(uni.setStorageSync).toHaveBeenCalledWith(LOCALE_STORAGE_KEY, 'zh-CN')
      expect(wrapper.find('.cert-lang-option.active').text()).toBe(messages['zh-CN'].mine.lang.zh)
    })

    it('★ 游客分支也渲染切换器（游客必须能切语言）', async () => {
      profileFixture.current = { ...GUEST_PROFILE }
      wrapper = await mountCert()
      expect(wrapper.find('.cert-guest-cta').exists()).toBe(true)
      expect(wrapper.find('.cert-lang').exists()).toBe(true)
      expect(wrapper.findAll('.cert-lang-option').length).toBe(2)
    })

    it('★ 点当前已选中的语言 = 无操作（不重复写存储）', async () => {
      wrapper = await mountCert() // zh
      vi.mocked(uni.setStorageSync).mockClear()
      await wrapper.findAll('.cert-lang-option')[0].trigger('click') // zh（已选中）
      await nextTick()
      expect(uni.setStorageSync).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // 5) ★ 动态拼 key 显式枚举（静态扫描器抓不到 `t('mine.tier.'+tier)`）
  // -------------------------------------------------------------------------
  it('★ 动态拼 key 显式枚举：mine.tier.{gold,silver,bronze,diamond} 两侧可解析且非裸 key', async () => {
    const keys = ['mine.tier.gold', 'mine.tier.silver', 'mine.tier.bronze', 'mine.tier.diamond']
    for (const loc of LOCALES) {
      setLocale(loc)
      await nextTick()
      for (const k of keys) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = String((i18n.global as any).t(k))
        expect(v, `${loc}:${k} 为空`).not.toBe('')
        expect(v, `${loc}:${k} 是裸 key`).not.toBe(k)
      }
    }
  })

  // -------------------------------------------------------------------------
  // 6) ★ 裸 CJK 源码守卫范围：cert 页已纳入 SCOPE_FILES
  //    （守卫本体在 rescue-i18n.test.ts 按同一份 SCOPE_FILES 逐文件扫描）
  // -------------------------------------------------------------------------
  it('★ cert 页已纳入裸 CJK 源码扫描清单（否则它的"中文抽漏"不会被任何守卫发现）', () => {
    expect([...SCOPE_FILES]).toContain('src/pages/cert/index.vue')
  })
})
