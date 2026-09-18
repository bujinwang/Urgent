/**
 * F4 T04 · 「我的服务时长 / 我的服务证明」两页的 **i18n + 渲染** 守卫。
 *
 * 覆盖：
 * - ★ 裸 CJK 源码（剥离注释；与 `rescue-i18n.test.ts` 的 SCOPE_FILES 是同一份清单，此处再直断一次）
 * - ★ en 渲染快照（**登录态 + 游客态两套夹具** —— 不被渲染的分支对守卫不可见）
 * - ★ 内容完整性：分项/明细**数据驱动**（数量 === 后端条数，不写死分项数）+ 空态明确文案
 * - ★ 动态拼键 `hours.activity.*` 显式枚举（静态扫描器抓不到 `t(map[type])`）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { findNakedCjkLines, RE_CJK } from '@/__tests__/i18n-scope'
import { setLocale } from '@/i18n'
import { messages } from '@/locales'
import { useUserStore } from '@/stores/user'
import type { UserProfile } from '@/api/user'

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

import { getMyHours, listMyCertificates } from '@/api/serviceHours'
import type { ServiceHoursView } from '@/api/serviceHours'

const VIEW: ServiceHoursView = {
  totalMinutes: 45,
  breakdown: [{ activityType: 'rescue_task', minutes: 45, count: 1 }],
  items: [{ id: 'v1', activityType: 'rescue_task', sourceType: 'system', sourceRef: 't1', startedAtMs: 1_700_000_000_000, endedAtMs: 1_700_001_800_000, durationMin: 45, isDrill: false, orgId: '' }],
  page: 1, pageSize: 20, total: 1,
}

async function mountHours() { const p = await import('@/pages/volunteer/hours.vue'); return mount(p.default) }
async function mountCerts() { const p = await import('@/pages/volunteer/certificates.vue'); return mount(p.default) }

const PROFILE: UserProfile = {
  id: 'u_test', name: 'Tester', avatar: 'T', tier: 'bronze', points: 0,
  city: '', volunteerId: '', certifications: [], rescueCount: 0, volunteer_type: 'medical',
}
/**
 * 登录态夹具 —— ⚠️ 必须先 `flushPromises()`：`user` store 首次创建会发起**异步** `refresh()`，
 * 在测试 mock 下其 `fetchProfile()` 解析为 `null` ⇒ 会把 `profile` 置为 `null`。
 * 若在 refresh 落地**前**设置 profile，随后会被覆盖成 null（本页据此走游客分支）。
 */
async function login(name = 'Tester') {
  const u = useUserStore()
  await flushPromises()
  u.profile = { ...PROFILE, name }
}

/** 按点分路径取 locale 值。 */
function loc(tree: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((a, p) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[p] : undefined), tree)
}

describe('F4 T04 · 两新页 i18n / 渲染守卫', () => {
  let wrapper: ReturnType<typeof mount> | null = null
  beforeEach(() => { setActivePinia(createPinia()); setLocale('zh-CN'); vi.clearAllMocks() })
  afterEach(() => { wrapper?.unmount(); wrapper = null; setLocale('zh-CN') })

  it('★ 裸 CJK 源码：两新页剥离注释后不含中文字面量', () => {
    expect(findNakedCjkLines('src/pages/volunteer/hours.vue')).toEqual([])
    expect(findNakedCjkLines('src/pages/volunteer/certificates.vue')).toEqual([])
  })

  it('★ en 渲染快照（**登录态**）：两页文本不含中文字符', async () => {
    setLocale('en-US')
    await login()
    vi.mocked(getMyHours).mockResolvedValueOnce(VIEW)
    vi.mocked(listMyCertificates).mockResolvedValueOnce([
      { certNo: 'VS-1', periodFromMs: 0, periodToMs: 1, totalMinutes: 45, status: 'active', issuedAtMs: 1 },
    ])

    wrapper = await mountHours(); await flushPromises()
    expect(wrapper.text(), 'hours(登录)').not.toMatch(RE_CJK)
    wrapper.unmount()

    wrapper = await mountCerts(); await flushPromises()
    expect(wrapper.text(), 'certificates(登录)').not.toMatch(RE_CJK)
  })

  it('★ en 渲染快照（**游客态**）：两页渲染引导登录且文本不含中文', async () => {
    setLocale('en-US')
    // 不 login() ⇒ profile.id === '' ⇒ 游客分支（此前完全没被任何人渲染过）
    wrapper = await mountHours(); await flushPromises()
    expect(wrapper.find('.hours-guest-btn').text()).toBe(messages['en-US'].mine.guestBtn)
    expect(wrapper.text(), 'hours(游客)').not.toMatch(RE_CJK)
    wrapper.unmount()

    wrapper = await mountCerts(); await flushPromises()
    expect(wrapper.find('.certs-guest-btn').text()).toBe(messages['en-US'].mine.guestBtn)
    expect(wrapper.text(), 'certificates(游客)').not.toMatch(RE_CJK)
  })

  it('★ 内容完整性 / 数据驱动：分项卡与明细行数量 === 后端返回条数（不写死分项数）', async () => {
    await login()
    vi.mocked(getMyHours).mockResolvedValueOnce({
      totalMinutes: 45,
      breakdown: [
        { activityType: 'rescue_task', minutes: 30, count: 1 },
        { activityType: 'manual', minutes: 10, count: 1 },
        { activityType: 'brand_new_type', minutes: 5, count: 1 },
      ],
      items: [
        { id: 'a', activityType: 'rescue_task', sourceType: 'system', sourceRef: 'r', startedAtMs: 1, endedAtMs: 2, durationMin: 1, isDrill: false, orgId: '' },
        { id: 'b', activityType: 'manual', sourceType: 'manual', sourceRef: '', startedAtMs: 1, endedAtMs: 2, durationMin: 1, isDrill: false, orgId: '' },
        { id: 'c', activityType: 'brand_new_type', sourceType: 'manual', sourceRef: '', startedAtMs: 1, endedAtMs: 2, durationMin: 1, isDrill: false, orgId: '' },
      ],
      page: 1, pageSize: 20, total: 3,
    })
    wrapper = await mountHours(); await flushPromises()
    expect(wrapper.findAll('.hours-break-card').length).toBe(3)
    expect(wrapper.findAll('.hours-item').length).toBe(3)
    // 未收录类型回落原始值（不丢行、不显示裸 key）
    expect(wrapper.text()).toContain('brand_new_type')
  })

  it('★ 空态：明确文案（hours.empty），不是空白/0 兜底', async () => {
    await login()
    vi.mocked(getMyHours).mockResolvedValueOnce({ totalMinutes: 0, breakdown: [], items: [], page: 1, pageSize: 20, total: 0 })
    wrapper = await mountHours(); await flushPromises()
    const empty = wrapper.find('.hours-empty')
    expect(empty.exists()).toBe(true)
    expect(empty.text()).toBe(messages['zh-CN'].hours.empty)
  })

  it('★ 分项标签随语言切换（模块级键映射 + computed，不冻结语言）', async () => {
    await login()
    vi.mocked(getMyHours).mockResolvedValueOnce(VIEW)
    wrapper = await mountHours(); await flushPromises()
    const name = () => wrapper!.find('.hours-break-name').text()
    expect(name()).toBe(messages['zh-CN'].hours.activity.rescue_task)
    setLocale('en-US'); await flushPromises()
    expect(name()).toBe(messages['en-US'].hours.activity.rescue_task)
  })

  it('★ 动态键枚举：`hours.activity.*` 在两种语言下均可解析（非空、非裸键）', () => {
    const keys = [
      'hours.activity.rescue_task', 'hours.activity.drill', 'hours.activity.training',
      'hours.activity.aed_checkin', 'hours.activity.manual',
    ]
    for (const l of ['zh-CN', 'en-US'] as const) {
      for (const k of keys) {
        const v = loc(messages[l], k)
        expect(typeof v === 'string' && v !== '' && v !== k, `${l}:${k}`).toBe(true)
      }
    }
  })
})
