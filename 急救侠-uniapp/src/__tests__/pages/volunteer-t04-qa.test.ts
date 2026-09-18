/**
 * F4 T04 **独立对抗性验证**（QA · software-qa-engineer-3-3）。
 *
 * 与实现方文件（`pages/volunteer-callpoints.test.ts` / `pages/hours-i18n.test.ts`）**完全独立**：
 * 自带夹具与 mock，不复用其断言，只用来承载「删掉源码那几行 ⇒ 本文件必须精确变红」的突变。
 *
 * 覆盖攻击清单：
 * ① 4 个页面调用点（导出 CSV→downloadText / 生成证明→跳转 / 生成证明→createCertificate / 验真→verifyCertificate）
 * ② i18n 扩围是否真跑到新页（SCOPE_FILES 含两页 + 独立直扫）
 * ③ 游客态夹具是否**真的渲染了游客分支**（断言分支特征元素存在 + 登录态元素缺席）
 * ④ 分项区数据驱动（1 项 / 多项两种夹具）+ 空态明确文案
 * ⑤ 措辞：禁用词 + 「平台出具，非实名认证」声明
 * ⑥ 登录态 + 游客态两套夹具 × 两页
 * ⑦ 自补：pages.json 可路由 / cert 页游客态入口 / 语言切换即时生效
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import fs from 'node:fs'
import path from 'node:path'
import { setLocale } from '@/i18n'
import { messages } from '@/locales'
import { findNakedCjkLines, SCOPE_FILES, RE_CJK, stripComments } from '@/__tests__/i18n-scope'

// ---------------- mocks（独立夹具，不用实现方的） ----------------
const userFixture = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('@/api/user', () => ({
  fetchProfile: vi.fn(() => Promise.resolve(userFixture.current)),
  fetchStats: vi.fn(() => Promise.resolve({
    certifiedRescuers: 0, networkedAeds: 0, monthlyRescues: 0, onlineVolunteers: 0, aedsWithin1km: 0,
  })),
  awardPointsApi: vi.fn(() => Promise.resolve({ points: 0, tier: 'bronze', reason: '' })),
}))
vi.mock('@/api/serviceHours', () => ({
  getMyHours: vi.fn(() => Promise.resolve({ totalMinutes: 0, breakdown: [], items: [], page: 1, pageSize: 20, total: 0 })),
  createCertificate: vi.fn(() => Promise.resolve({ certNo: 'VS-NEW', periodFromMs: 0, periodToMs: 1, totalMinutes: 0, breakdown: [], issuedAtMs: 1, status: 'active' })),
  listMyCertificates: vi.fn(() => Promise.resolve([])),
  verifyCertificate: vi.fn(() => Promise.resolve({ certNo: 'VS-X', periodFromMs: 0, periodToMs: 1, totalMinutes: 0, status: 'active' })),
  revokeCertificate: vi.fn(() => Promise.resolve({ certNo: 'VS-X', status: 'revoked' })),
}))
vi.mock('@/utils/govExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/govExport')>()),
  downloadText: vi.fn(),
  printGovDashboard: vi.fn(),
}))
vi.mock('@/api/aed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/aed')>()
  return { ...actual, fetchAedList: vi.fn(() => Promise.resolve([])) }
})
vi.mock('@/api/org', () => ({ fetchUserOrgRoles: vi.fn(() => Promise.resolve([])) }))

import { getMyHours, listMyCertificates, createCertificate, verifyCertificate } from '@/api/serviceHours'
import { downloadText } from '@/utils/govExport'
import { useUserStore } from '@/stores/user'
import type { UserProfile } from '@/api/user'

// ---------------- 夹具 ----------------
const LOGGED: UserProfile = {
  id: 'u_qa', name: 'QATester', avatar: 'Q', tier: 'bronze', points: 0,
  city: '', volunteerId: '', certifications: [] as string[], rescueCount: 0, volunteer_type: 'medical',
}
const GUEST: UserProfile = { ...LOGGED, id: '', name: '游客' }

const READ = (rel: string): string => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8')

async function mountPage(rel: 'hours' | 'certificates', loggedIn: boolean) {
  // ⚠️ 夹具时序（关键）：user store 首次创建会异步 refresh()，其 profile 初始为**游客**。
  // 页面 `onMounted` 在 refresh 落地前就跑，若此刻 profile.id 仍为空 ⇒ 登录分支的 loadHours
  // **不会被调用**（分项卡恒为空）。故必须先让 refresh 落地，再显式写 profile，最后 mount。
  const u = useUserStore()
  await flushPromises()
  u.profile = loggedIn ? { ...LOGGED } : { ...GUEST }

  const mod = rel === 'hours' ? await import('@/pages/volunteer/hours.vue') : await import('@/pages/volunteer/certificates.vue')
  const w = mount(mod.default)
  await flushPromises()
  return w
}

describe('F4 T04 独立验证 · 页面调用点（删掉那一行 ⇒ 必须精确变红）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  afterEach(() => setLocale('zh-CN'))

  it('★ hours「导出 CSV」⇒ downloadText 恰好一次', async () => {
    const w = await mountPage('hours', true)
    await w.find('.hours-btn-secondary').trigger('click')
    expect(vi.mocked(downloadText)).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('★ hours「生成证明」⇒ navigateTo 证明页', async () => {
    const w = await mountPage('hours', true)
    await w.find('.hours-btn-primary').trigger('click')
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/volunteer/certificates' })
    w.unmount()
  })

  it('★ certificates「生成证明」⇒ createCertificate 恰好一次（带区间）', async () => {
    const w = await mountPage('certificates', true)
    await w.find('.certs-range .certs-btn-primary').trigger('click')
    await flushPromises()
    expect(vi.mocked(createCertificate)).toHaveBeenCalledTimes(1)
    const [from, to] = vi.mocked(createCertificate).mock.calls[0]
    expect(typeof from).toBe('number')
    expect(typeof to).toBe('number')
    expect(to as number).toBeGreaterThan(from as number) // 结束日含当日 ⇒ 排它上界
    w.unmount()
  })

  it('★ certificates「验真」⇒ verifyCertificate 带输入编号', async () => {
    const w = await mountPage('certificates', true)
    await w.find('.certs-verify-input').setValue('VS-QA-777')
    await w.find('.certs-verify .certs-btn-primary').trigger('click')
    await flushPromises()
    expect(vi.mocked(verifyCertificate)).toHaveBeenCalledWith('VS-QA-777')
    w.unmount()
  })
})

describe('F4 T04 独立验证 · i18n 扩围是否真跑到新页', () => {
  it('★ SCOPE_FILES 含两新页（否则裸 CJK 扫描器根本不看它们）', () => {
    const list = [...SCOPE_FILES]
    expect(list).toContain('src/pages/volunteer/hours.vue')
    expect(list).toContain('src/pages/volunteer/certificates.vue')
  })

  it('★ 独立直扫：两新页剥离注释后零裸中文字面量', () => {
    expect(findNakedCjkLines('src/pages/volunteer/hours.vue')).toEqual([])
    expect(findNakedCjkLines('src/pages/volunteer/certificates.vue')).toEqual([])
  })
})

describe('F4 T04 独立验证 · 游客态夹具真的渲染了游客分支吗', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  afterEach(() => setLocale('zh-CN'))

  it('★ hours 游客态：游客分支元素**存在**、登录态元素**缺席**', async () => {
    const w = await mountPage('hours', false)
    expect(w.find('.hours-guest-btn').exists(), '游客引导按钮必须渲染').toBe(true)
    expect(w.find('.hours-total').exists(), '游客不得看到总时长区').toBe(false)
    expect(w.find('.hours-btn-primary').exists(), '游客不得看到生成证明按钮').toBe(false)
    w.unmount()
  })

  it('★ certificates 游客态：游客分支**存在**、登录态**缺席**', async () => {
    const w = await mountPage('certificates', false)
    expect(w.find('.certs-guest-btn').exists(), '游客引导按钮必须渲染').toBe(true)
    expect(w.find('.certs-card').exists(), '游客不得看到证明卡').toBe(false)
    expect(w.find('.certs-verify').exists(), '游客不得看到验真区（登录分支）').toBe(false)
    w.unmount()
  })

  it('★ 登录态：游客分支元素**缺席**（反方向，防止"两个分支都渲染"）', async () => {
    const w = await mountPage('hours', true)
    expect(w.find('.hours-guest-btn').exists()).toBe(false)
    expect(w.find('.hours-total').exists()).toBe(true)
    w.unmount()
  })
})

describe('F4 T04 独立验证 · 分项区数据驱动 + 空态', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  afterEach(() => setLocale('zh-CN'))

  const item = (id: string, type: string, min: number) => ({
    id, activityType: type, sourceType: 'system', sourceRef: id, startedAtMs: 1, endedAtMs: 2, durationMin: min, isDrill: false, orgId: '',
  })

  it('★ 1 个 breakdown 项 ⇒ 恰好 1 张分项卡（不写死固定列）', async () => {
    vi.mocked(getMyHours).mockResolvedValueOnce({
      totalMinutes: 30, breakdown: [{ activityType: 'rescue_task', minutes: 30, count: 1 }],
      items: [item('a', 'rescue_task', 30)], page: 1, pageSize: 20, total: 1,
    })
    const w = await mountPage('hours', true)
    expect(w.findAll('.hours-break-card').length).toBe(1)
    expect(w.findAll('.hours-item').length).toBe(1)
    w.unmount()
  })

  it('★ 3 个 breakdown 项 ⇒ 恰好 3 张（数量随数据变化，不写死）', async () => {
    vi.mocked(getMyHours).mockResolvedValueOnce({
      totalMinutes: 60,
      breakdown: [
        { activityType: 'rescue_task', minutes: 30, count: 1 },
        { activityType: 'drill', minutes: 20, count: 1 },
        { activityType: 'zzz_unknown', minutes: 10, count: 1 },
      ],
      items: [item('a', 'rescue_task', 30), item('b', 'drill', 20), item('c', 'zzz_unknown', 10)],
      page: 1, pageSize: 20, total: 3,
    })
    const w = await mountPage('hours', true)
    expect(w.findAll('.hours-break-card').length).toBe(3)
    expect(w.findAll('.hours-item').length).toBe(3)
    // 未收录类型回落原始值（不显示裸 key）
    expect(w.text()).toContain('zzz_unknown')
    w.unmount()
  })

  it('★ 空态：明确文案（不是空白、不是 0 兜底）', async () => {
    vi.mocked(getMyHours).mockResolvedValueOnce({ totalMinutes: 0, breakdown: [], items: [], page: 1, pageSize: 20, total: 0 })
    const w = await mountPage('hours', true)
    const empties = w.findAll('.hours-empty')
    expect(empties.length, '分项区与明细区各一个空态').toBe(2)
    for (const e of empties) {
      expect(e.text().trim()).toBe(messages['zh-CN'].hours.empty)
      expect(e.text().length).toBeGreaterThan(0)
    }
    w.unmount()
  })

  it('★ certificates 空态：明确文案', async () => {
    vi.mocked(listMyCertificates).mockResolvedValueOnce([])
    const w = await mountPage('certificates', true)
    expect(w.find('.certs-empty').text().trim()).toBe(messages['zh-CN'].serviceCert.empty)
    w.unmount()
  })
})

describe('F4 T04 独立验证 · 措辞（禁用词 + 声明）', () => {
  const PAGE_SRC = ['src/pages/volunteer/hours.vue', 'src/pages/volunteer/certificates.vue']
  const FORBIDDEN = ['国家标准', '国标', '官方', '符合国家']

  it('★ 两页（剥离注释）与两份 locale 的 **F4 文案子树**均不得出现禁用词', () => {
    // 页面源码：剥离注释后再扫（注释里可合法地引用"不得出现 xx"）
    for (const f of PAGE_SRC) {
      const src = stripComments(READ(f))
      for (const w of FORBIDDEN) {
        expect(src.includes(w), `${f} 不得含「${w}」`).toBe(false)
      }
    }
    // locale：只扫 F4 相关子树（hours / serviceCert）的实际字符串，不扫文件里的说明注释
    const f4Subtree = (loc: 'zh-CN' | 'en-US') => JSON.stringify({
      hours: messages[loc].hours,
      serviceCert: messages[loc].serviceCert,
    })
    for (const loc of ['zh-CN', 'en-US'] as const) {
      const blob = f4Subtree(loc)
      for (const w of FORBIDDEN) {
        expect(blob.includes(w), `${loc} F4 文案不得含「${w}」`).toBe(false)
      }
    }
  })

  it('★ 必须含「平台出具，非实名认证」类声明（zh + en）', () => {
    expect(messages['zh-CN'].serviceCert.disclaimer).toContain('平台出具')
    expect(messages['zh-CN'].serviceCert.disclaimer).toContain('非实名认证')
    expect(messages['zh-CN'].serviceCert.docTitle).toContain('平台出具')
    expect(messages['en-US'].serviceCert.docTitle.toLowerCase()).toContain('platform')
    expect(messages['en-US'].serviceCert.disclaimer.toLowerCase()).toContain('platform')
  })

  it('★ 声明在 certificates 页**真的渲染**出来（不是只写在 locale 里）', async () => {
    setActivePinia(createPinia())
    setLocale('zh-CN')
    const w = await mountPage('certificates', true)
    expect(w.find('.certs-disclaimer').text()).toBe(messages['zh-CN'].serviceCert.disclaimer)
    w.unmount()
  })
})

describe('F4 T04 独立验证 · 自补项', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })
  afterEach(() => setLocale('zh-CN'))

  it('★ pages.json 注册两个新页（可路由）', () => {
    const pages = JSON.parse(READ('src/pages.json')) as { pages: Array<{ path: string }> }
    const paths = pages.pages.map((p) => p.path)
    expect(paths).toContain('pages/volunteer/hours')
    expect(paths).toContain('pages/volunteer/certificates')
  })

  // -------------------------------------------------------------------------
  // KNOWN-BUG：两新页的**原生导航栏标题**未本地化（en 下仍显示中文）。
  // 缺陷：pages.json 的 `navigationBarTitleText` 是静态中文（"我的服务时长"/"我的服务证明"），
  //      且两页均**未**调 `useLocalizedNavTitle()`（无 `nav.hours`/`nav.serviceCert` 键）
  //      ⇒ 语言切到 en 后，页内 appbar 已英文，但原生标题栏仍是中文。
  // 为何四层守卫全盲：① 裸 CJK 源码扫描只扫 `.vue`（不含 `pages.json`）；
  //      ② 渲染快照（VTU）不渲染原生 chrome；③ `nav-title-locale.test.ts` 的调用点守卫只枚举 3 页。
  // 修复时必须：① 加 `nav.hours`/`nav.serviceCert`（zh+en）；② 两页 setup 调
  //      `useLocalizedNavTitle('nav.hours')` / `('nav.serviceCert')`；
  //      ③ **把本用例反转为**「切 en 后 `uni.setNavigationBarTitle` 收到对应英文标题」。
  // -------------------------------------------------------------------------
  it('KNOWN-BUG: 两新页未同步原生导航栏标题（en 下原生标题栏仍为中文）', () => {
    for (const f of ['src/pages/volunteer/hours.vue', 'src/pages/volunteer/certificates.vue']) {
      expect(READ(f), `${f} 当前未调 useLocalizedNavTitle（修复后本断言须反转）`).not.toContain('useLocalizedNavTitle')
    }
    // 无 nav.hours / nav.serviceCert 键（既有 nav 域仅 aedIndex/drill/mine）
    expect('hours' in messages['zh-CN'].nav).toBe(false)
    expect('serviceCert' in messages['zh-CN'].nav).toBe(false)
  })

  it('★ cert「我的」页游客态：两入口链接渲染，点击可达', async () => {
    const u = useUserStore()
    await flushPromises()
    u.profile = { ...GUEST }
    const mod = await import('@/pages/cert/index.vue')
    const w = mount(mod.default)
    await flushPromises()
    await nextTick()

    const links = w.findAll('.cert-guest-link').map((n) => n.text())
    expect(links.some((t) => t.includes(messages['zh-CN'].hours.title))).toBe(true)
    expect(links.some((t) => t.includes(messages['zh-CN'].serviceCert.title))).toBe(true)

    const hoursLink = w.findAll('.cert-guest-link').find((n) => n.text().includes(messages['zh-CN'].hours.title))!
    await hoursLink.trigger('click')
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/volunteer/hours' })
    w.unmount()
  })

  it('★ 语言切换即时生效（hours 页分项标签随 locale 变，未语言冻结）', async () => {
    vi.mocked(getMyHours).mockResolvedValueOnce({
      totalMinutes: 30, breakdown: [{ activityType: 'rescue_task', minutes: 30, count: 1 }],
      items: [], page: 1, pageSize: 20, total: 0,
    })
    const w = await mountPage('hours', true)
    expect(w.find('.hours-break-name').text()).toBe(messages['zh-CN'].hours.activity.rescue_task)
    setLocale('en-US')
    await nextTick()
    expect(w.find('.hours-break-name').text()).toBe(messages['en-US'].hours.activity.rescue_task)
    // 标题也应即时切换
    expect(w.find('.hours-title').text()).toBe(messages['en-US'].hours.title)
    w.unmount()
  })

  it('★ en 渲染（登录态）两页无中文；游客态两页也无中文', async () => {
    setLocale('en-US')
    let w = await mountPage('hours', true)
    expect(w.text(), 'hours(en,登录)').not.toMatch(RE_CJK)
    w.unmount()
    w = await mountPage('certificates', true)
    expect(w.text(), 'certificates(en,登录)').not.toMatch(RE_CJK)
    w.unmount()
    w = await mountPage('hours', false)
    expect(w.find('.hours-guest-btn').exists()).toBe(true)
    expect(w.text(), 'hours(en,游客)').not.toMatch(RE_CJK)
    w.unmount()
    w = await mountPage('certificates', false)
    expect(w.find('.certs-guest-btn').exists()).toBe(true)
    expect(w.text(), 'certificates(en,游客)').not.toMatch(RE_CJK)
    w.unmount()
  })
})
