import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { SCOPE_FILES, hasCjk } from '@/__tests__/i18n-scope'

/**
 * F2 P0-4b —— `pages/aed/detail.vue` + `pages/drill/index.vue` 文案本地化的**独立守卫**。
 *
 * 与 `rescue-i18n.test.ts` / `guide-aed-i18n.test.ts` 同构（见那两份文件头的「为什么必须有这个文件」）：
 * `i18n.test.ts` 的静态扫描只证明「**用到的** key 都存在」，证明不了「页面上的中文都被抽走了」，
 * 也抓不到动态拼 key / 运行时才拼出来的字符串。故本文件补四层静态扫描咬不住的守卫：
 *   ① **运行时 reactivity 契约**（切语言 ⇒ 页面立即改语言，不能"冻结"）
 *   ② **en-US 渲染快照**（`wrapper.text()` 不含中文）
 *   ③ **内容完整性**（渲染值 === `messages[locale]` 值；**v-for 列表数量优先**）
 *   ④ 裸 CJK **源码**守卫由共享 `SCOPE_FILES` 承担（在 `rescue-i18n.test.ts` 里逐文件扫描），
 *      本文件只附一条「清单边界」断言。
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠️ **已知边界（D6，见设计 §13 D6 / §13.1）—— 这些**不是**漏抽，请勿误判**：
 * 本测试**故意不**覆盖、也**不应**为下列内容造 key，因为它们是**后端 / 用户数据**：
 *   - `aed/detail.vue`：`aed.name` / `address` / `model` / `serialNumber` / `findingInstructions`
 *     / 打卡记录 `ci.userName` / `ci.comment` / `ci.findingTip` / `ci.date` / 责任人 `custodian.name|role|phone`；
 *   - `drill/index.vue`：演习 `d.title` / `d.description` / `d.location` / `d.organizerName`、
 *     训练记录 `r.notes` / `r.organizerName` / `r.date`。
 * 这类数据没有对应翻译，属 F2 范围外（彻底解法＝后端 i18n + 数据层多语言）。
 * 另有两条**写进后端的审计 payload**（取用 `notes` / 打卡 `comment`）**恒 zh-CN、刻意不本地化**，
 * 已外置到 `src/constants/audit-notes.ts`（D3）——它们同样**不**在本文件的断言范围。
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **测试隔离**（P0-2/P0-3/P0-4a 同一类坑）：`i18n` 与 Pinia store 都是**模块级单例**。
 * - `i18n`：每用例前后 `setLocale('zh-CN')` 复位；
 * - 每个 store：`setActivePinia(createPinia())` 换新实例；
 * - `aed` 夹具**工厂化**（每次返回全新克隆）：`discoverAed()` 会**原地**改夹具对象，复用会造成顺序依赖；
 * - `getCurrentPages` / `uni.showModal` / `uni.chooseImage` / `global.fetch`：逐用例显式设定，不依赖默认值。
 */

// ── 夹具（`vi.hoisted`：mock 工厂在模块求值前就要能引用）─────────────────────
const aedRawFixture = vi.hoisted(() => ({
  /** 后端原始设备（**刻意无 `custodian`**，以验证 D4 的前端兜底文案）。每次返回全新克隆。 */
  make: () => ({
    id: 'aed_001',
    name: 'Office Lobby AED',
    address: '1 Main St',
    lat: 22.5,
    lng: 113.9,
    distance: 120,
    status: 'available' as const,
    lastCheck: '2026-01-01',
    batteryLevel: 90,
    model: 'M1',
    serialNumber: 'S1',
    batteryExpiry: '2027-01-01',
    electrodeExpiry: '2026-06-01',
    lastMaintenance: '2025-12-01',
    indoor: true,
    floor: 'Floor 1',
    openHours: '24h',
    findingInstructions: 'Near the lobby desk',
    checkIns: [],
  }),
}))

/** 后端业务错误 message 恒中文（模拟 `请求过于频繁`）—— 用于 D1 兜底策略用例。 */
const backendError = vi.hoisted(() => ({ code: 4009, message: '请求过于频繁' }))

/** 演习 / 训练记录夹具（文案用 ASCII，避免与"英文页无中文"快照断言互相干扰）。 */
const drillFixtures = vi.hoisted(() => ({
  events: () => [
    { id: 'd1', status: 'upcoming', title: 'CPR Drill A', scenario: 'cpr', description: 'Practice CPR', date: '2026-10-01', location: 'Shenzhen Bay Park', organizerName: 'Alex', organizerId: 'u1', currentParticipants: 3, maxParticipants: 15, pointsReward: 20 },
    { id: 'd2', status: 'upcoming', title: 'AED Drill B', scenario: 'aed', description: 'Practice AED', date: '2026-10-05', location: 'Central Park', organizerName: 'Bob', organizerId: 'u2', currentParticipants: 5, maxParticipants: 20, pointsReward: 15 },
    { id: 'd3', status: 'completed', title: 'Trauma Drill C', scenario: 'trauma', description: 'Finished', date: '2026-09-01', location: 'Clinic', organizerName: 'Cara', organizerId: 'u3', currentParticipants: 10, maxParticipants: 10, pointsReward: 30 },
  ],
  records: () => [
    { id: 'r1', scenario: 'choking', organizerName: 'Dan', date: '2026-08-01', notes: 'Good session' },
    { id: 'r2', scenario: 'mass', organizerName: 'Eve', date: '2026-07-01', notes: 'Mass casualty drill' },
  ],
}))

vi.mock('@/api/aed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/aed')>()
  return {
    ...actual,
    fetchAedList: vi.fn(() => Promise.resolve([])),
    fetchAedById: vi.fn(() => Promise.resolve(aedRawFixture.make())),
    createAedPickup: vi.fn(() => Promise.resolve({ id: 'pick_1' })),
  }
})

vi.mock('@/api/aed-custodian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/aed-custodian')>()
  return {
    ...actual,
    // 非 0 业务码 + 中文 message ⇒ 触发 D1 的"后端直出"分支
    notifyCustodian: vi.fn(() => Promise.resolve({ code: backendError.code, message: backendError.message, data: undefined })),
    revokeConsent: vi.fn(() => Promise.resolve({ alertId: 'a1', consentGranted: false, revokedAtMs: 0 })),
  }
})

vi.mock('@/api/user', () => ({
  fetchProfile: vi.fn(() => Promise.resolve({
    id: 'u1', name: 'Alex', avatar: 'A', tier: 'bronze', points: 1234,
    city: '', volunteerId: '', certifications: [], rescueCount: 3,
  })),
  fetchStats: vi.fn(() => Promise.resolve({
    certifiedRescuers: 0, networkedAeds: 0, monthlyRescues: 0, onlineVolunteers: 0, aedsWithin1km: 0,
  })),
  awardPointsApi: vi.fn(() => Promise.resolve({ points: 0, tier: 'bronze', reason: '' })),
}))

import { setLocale } from '@/i18n'
import { messages } from '@/locales'

const LOCALES = ['zh-CN', 'en-US'] as const

/** 用 locale 模板 + 具名参数还原期望整句（锚到 locale 文件，不在测试里硬抄文案）。 */
const interp = (tpl: string, params: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(params[k]))

type AnyMock = ReturnType<typeof vi.fn>
const mockOf = (fn: unknown): AnyMock => fn as unknown as AnyMock

/** 覆盖 `getCurrentPages`（详情页从 `page.options` 取 `id` / `action`）。 */
function setPageOptions(options: Record<string, string>): void {
  mockOf((globalThis as unknown as { getCurrentPages: unknown }).getCurrentPages).mockReturnValue([{ options }])
}

/** 让 `uni.showModal` 回调 `success({ confirm })`。 */
function mockModal(confirm: boolean): void {
  mockOf((uni as unknown as { showModal: unknown }).showModal).mockImplementation((opts: { success?: (r: { confirm: boolean; cancel: boolean }) => void }) => {
    opts?.success?.({ confirm, cancel: !confirm })
  })
}

/** 最近一次 `uni.showToast` 的 `title`（无调用返回 `''`）。 */
function lastToastTitle(): string {
  const calls = mockOf((uni as unknown as { showToast: unknown }).showToast).mock.calls
  const last = calls.at(-1)?.[0] as { title?: string } | undefined
  return last?.title ?? ''
}

/** 最近一次 `uni.showModal` 的入参。 */
function lastModalArgs(): Record<string, unknown> {
  const calls = mockOf((uni as unknown as { showModal: unknown }).showModal).mock.calls
  return (calls.at(-1)?.[0] ?? {}) as Record<string, unknown>
}

/** 让 drill 页的两条 `fetch`（`/events`、`/training-records`）返回夹具（`events` 可覆盖）。 */
function mockFetch(events?: unknown[]): void {
  ;(globalThis as unknown as { fetch: unknown }).fetch = vi.fn((url: string) => {
    const u = String(url)
    if (u.includes('/training-records')) {
      return Promise.resolve({ json: () => Promise.resolve({ data: drillFixtures.records() }) })
    }
    if (u.includes('/events')) {
      return Promise.resolve({ json: () => Promise.resolve({ data: events ?? drillFixtures.events() }) })
    }
    return Promise.resolve({ json: () => Promise.resolve({ data: [] }) })
  })
}

// ── 页面驱动工具 ───────────────────────────────────────────────────────────
async function mountDetail() {
  const page = await import('@/pages/aed/detail.vue')
  const wrapper = mount(page.default)
  await flushPromises() // 让 onMounted 里的 loadAed() 落地
  await nextTick()
  return wrapper
}

async function mountDrill(events?: unknown[]) {
  mockFetch(events)
  const page = await import('@/pages/drill/index.vue')
  const wrapper = mount(page.default)
  await flushPromises() // 让 onMounted 的 load() 落地
  await nextTick()
  return wrapper
}

describe('P0-4b：aed/detail + drill 文案本地化', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    // ⚠️ `i18n` 是模块级单例、`setLocale` 会写存储 ⇒ 必须逐用例复位。
    setLocale('zh-CN')
    vi.clearAllMocks()
    setPageOptions({ id: 'aed_001' }) // 默认：详情页可正常加载，各用例按需覆盖
    ;(uni as unknown as { chooseImage: unknown }).chooseImage = vi.fn((opts: { success?: (r: { tempFilePaths: string[] }) => void }) => {
      opts?.success?.({ tempFilePaths: ['/tmp/photo.jpg'] })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    setLocale('zh-CN')
    wrapper?.unmount()
    wrapper = null
  })

  // -------------------------------------------------------------------------
  // 1) ★ reactivity 契约（每个文件至少一条：切语言后立即改语言）
  // -------------------------------------------------------------------------
  describe('reactivity：切语言后页面立即改语言（防"冻结语言"）', () => {
    it('★ detail 状态徽标（computed + t）：zh → en 立即生效', async () => {
      wrapper = await mountDetail()
      expect(wrapper.find('.detail-hero-badge').text()).toBe(messages['zh-CN'].aed.detail.status.discovered)

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.detail-hero-badge').text()).toBe(messages['en-US'].aed.detail.status.discovered)

      setLocale('zh-CN'); await nextTick()
      expect(wrapper.find('.detail-hero-badge').text()).toBe(messages['zh-CN'].aed.detail.status.discovered)
    })

    it('★ detail 未找到页标题：zh → en 立即生效', async () => {
      setPageOptions({})
      wrapper = await mountDetail()
      expect(wrapper.find('.not-found-title').text()).toBe(messages['zh-CN'].aed.detail.notFound.title)

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.not-found-title').text()).toBe(messages['en-US'].aed.detail.notFound.title)
    })

    it('★ drill 演习状态标签 + 页签（函数内 t / 模板 $t）：zh → en 立即生效', async () => {
      wrapper = await mountDrill()
      expect(wrapper.find('.drill-title').text()).toBe(messages['zh-CN'].drill.title)
      expect(wrapper.findAll('.drill-tab').map(n => n.text()))
        .toEqual([messages['zh-CN'].drill.tab.upcoming, messages['zh-CN'].drill.tab.completed, messages['zh-CN'].drill.tab.records])
      expect(wrapper.findAll('.drill-card-status')[0].text()).toBe(messages['zh-CN'].drill.status.upcoming)

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.drill-title').text()).toBe(messages['en-US'].drill.title)
      expect(wrapper.findAll('.drill-card-status')[0].text()).toBe(messages['en-US'].drill.status.upcoming)
    })
  })

  // -------------------------------------------------------------------------
  // 2) ★ 内容完整性：渲染值 === locale 值，数量 === locale 条目数
  // -------------------------------------------------------------------------
  describe('★ 内容完整性：渲染值 === locale 值，数量 === locale 条目数', () => {
    for (const loc of LOCALES) {
      it(`★ [${loc}] detail：按钮/设备字段名/责任人兜底/空打卡 === locale 值`, async () => {
        setLocale(loc)
        wrapper = await mountDetail()
        const d = messages[loc].aed.detail

        // 顶部状态徽标（discovered=true ⇒ 已发现档）
        expect(wrapper.find('.detail-hero-badge').text()).toBe(d.status.discovered)
        // 两个操作按钮
        expect(wrapper.find('.detail-action-nav').text()).toContain(d.nav)
        expect(wrapper.find('.detail-action-checkin').text()).toContain(d.checkin)

        // 卡片标题集合（顺序 = 模板渲染顺序）：如何找到 / 设备信息 / 设备责任人 / 空打卡
        expect(wrapper.findAll('.detail-card-title').map(n => n.text()))
          .toEqual([d.howToFind, d.deviceInfo, d.custodian.title, d.timeline.emptyTitle])

        // 设备信息字段名（数量优先：6 个）
        expect(wrapper.findAll('.detail-card-label').map(n => n.text()))
          .toEqual([d.label.model, d.label.serial, d.label.batteryExpiry, d.label.electrodeExpiry, d.label.lastMaintenance, d.label.lastCheck])

        // 责任人卡（无 custodian 快照 ⇒ 走前端兜底文案，D4）
        expect(wrapper.find('.detail-custodian-avatar').text()).toBe(d.custodian.avatarFallback)
        expect(wrapper.find('.detail-custodian-name').text()).toBe(d.custodian.nameFallback)
        expect(wrapper.find('.detail-custodian-role').text()).toBe(d.custodian.roleFallback)
        expect(wrapper.find('.detail-custodian-contact').text()).toContain(d.custodian.notify)

        // 空打卡
        expect(wrapper.find('.detail-empty-text').text()).toBe(d.empty.title)
        expect(wrapper.find('.detail-empty-sub').text()).toBe(d.empty.sub)
      })

      it(`★ [${loc}] drill：页签 + 演习卡（v-for）=== locale 值，数量优先`, async () => {
        setLocale(loc)
        wrapper = await mountDrill()
        const dr = messages[loc].drill
        const events = drillFixtures.events()
        const upcoming = events.filter(e => e.status === 'upcoming')

        expect(wrapper.find('.drill-title').text()).toBe(dr.title)
        expect(wrapper.findAll('.drill-tab').map(n => n.text()))
          .toEqual([dr.tab.upcoming, dr.tab.completed, dr.tab.records])

        // ⚠️ 本页 `v-for` 直接迭代 `drills`（**未**按 tab 过滤；`displayDrills` 只用于空态判断）
        // ⇒ 列表始终是全部演习。此处按**实际行为**断言，**不**改页面逻辑（既存行为，见任务书"不改"范围）。
        expect(wrapper.findAll('.drill-card').length, '演习卡数量').toBe(events.length)
        expect(wrapper.findAll('.drill-card-title').map(n => n.text())).toEqual(events.map(e => e.title))
        expect(wrapper.findAll('.drill-card-scenario').map(n => n.text()))
          .toEqual(events.map(e => dr.scenario[e.scenario as keyof typeof dr.scenario]))
        expect(wrapper.findAll('.drill-card-status').map(n => n.text()))
          .toEqual(events.map(e => (e.status === 'upcoming' ? dr.status.upcoming : dr.status.completed)))

        // 人数 / 积分 = 整句插值（锚 locale 模板 + 后端数值）
        const meta = wrapper.find('.drill-card-meta').text()
        expect(meta).toContain(interp(dr.participants, { current: events[0].currentParticipants, max: events[0].maxParticipants }))
        expect(meta).toContain(interp(dr.pointsReward, { points: events[0].pointsReward }))

        // 报名按钮只出现在 upcoming 卡；"完成演习"仅本人（organizerId===u1）的一张
        expect(wrapper.findAll('.drill-btn').filter(n => !n.classes().includes('complete')).map(n => n.text()))
          .toEqual(upcoming.map(() => dr.join))
        expect(wrapper.findAll('.drill-btn.complete').length, '完成演习按钮数量').toBe(1)
        expect(wrapper.find('.drill-btn.complete').text()).toBe(dr.complete)
      })

      it(`★ [${loc}] drill 空态：切到无数据的 tab ⇒ empty 文案 === locale 值`, async () => {
        setLocale(loc)
        const dr = messages[loc].drill
        const events = drillFixtures.events()

        // 只有 1 条 upcoming ⇒ 切到"已完成"后 displayDrills 为空
        wrapper = await mountDrill([events[0]])
        await wrapper.findAll('.drill-tab')[1].trigger('click')
        await nextTick()
        expect(wrapper.find('.drill-empty').text()).toBe(dr.empty.completed)

        // 只有 1 条 completed ⇒ "即将开始"（默认 tab）为空
        wrapper.unmount()
        wrapper = await mountDrill([events[2]])
        expect(wrapper.find('.drill-empty').text()).toBe(dr.empty.upcoming)
      })

      it(`★ [${loc}] drill 训练记录 + 发起弹窗 === locale 值`, async () => {
        setLocale(loc)
        wrapper = await mountDrill()
        const dr = messages[loc].drill
        const records = drillFixtures.records()

        // 切到「训练记录」⇒ 触发 loadRecords()
        await wrapper.findAll('.drill-tab')[2].trigger('click')
        await flushPromises()
        await nextTick()

        expect(wrapper.findAll('.drill-card').length, '训练记录数量').toBe(records.length)
        expect(wrapper.findAll('.drill-card-title').map(n => n.text()))
          .toEqual(records.map(r => dr.scenario[r.scenario as 'cpr' | 'aed' | 'trauma' | 'choking' | 'mass']))
        // 组织者行 = 整句插值
        expect(wrapper.findAll('.drill-card-scenario').map(n => n.text()))
          .toEqual(records.map(r => interp(dr.organizerLine, { name: r.organizerName })))
        expect(wrapper.findAll('.drill-card-status').map(n => n.text())).toEqual(records.map(() => dr.recordTrained))

        // 发起弹窗：标题 + 6 个字段名
        ;(wrapper.vm as unknown as { showCreate: boolean }).showCreate = true
        await nextTick()
        expect(wrapper.find('.modal h3').text()).toBe(dr.form.title)
        expect(wrapper.findAll('.modal label').map(n => n.text()))
          .toEqual([dr.form.label.title, dr.form.label.description, dr.form.label.scenario, dr.form.label.date, dr.form.label.location, dr.form.label.maxParticipants])
        // D5：默认地点为前端默认输入值（本地化）
        expect((wrapper.vm as unknown as { form: { location: string } }).form.location).toBe(dr.form.defaultLocation)
      })
    }
  })

  // -------------------------------------------------------------------------
  // 3) ★ en-US 渲染快照：整页文本不含中文字符
  // -------------------------------------------------------------------------
  describe('★ en-US 渲染快照：页面文本不含中文字符', () => {
    it('★ detail 页：正常内容 + 未找到页', async () => {
      setLocale('en-US')
      wrapper = await mountDetail()
      expect(hasCjk(wrapper.text()), '正常内容').toBe(false)
      wrapper.unmount()

      setPageOptions({})
      wrapper = await mountDetail()
      expect(hasCjk(wrapper.text()), '未找到页').toBe(false)
    })

    it('★ drill 页：演习列表 + 训练记录 + 发起弹窗', async () => {
      setLocale('en-US')
      wrapper = await mountDrill()
      expect(hasCjk(wrapper.text()), '演习列表').toBe(false)

      await wrapper.findAll('.drill-tab')[2].trigger('click')
      await flushPromises()
      await nextTick()
      expect(hasCjk(wrapper.text()), '训练记录').toBe(false)

      ;(wrapper.vm as unknown as { showCreate: boolean }).showCreate = true
      await nextTick()
      expect(hasCjk(wrapper.text()), '发起弹窗').toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 4) ★ 交互文案：uni.showToast / uni.showModal（含 D1 后端 message 兜底策略）
  // -------------------------------------------------------------------------
  describe('★ 交互文案：uni.showToast / uni.showModal', () => {
    it('★ PIPL 同意弹窗：title/content/confirmText/cancelText === locale 值', async () => {
      for (const loc of LOCALES) {
        setLocale(loc)
        wrapper = await mountDetail()
        mockModal(true)
        await (wrapper.vm as unknown as { notifyOwner: () => Promise<void> }).notifyOwner()
        await flushPromises()

        const args = lastModalArgs()
        expect(args.title, `${loc} title`).toBe(messages[loc].aed.detail.consent.title)
        expect(args.content, `${loc} content`).toBe(messages[loc].aed.detail.consent.content)
        expect(args.confirmText, `${loc} confirmText`).toBe(messages[loc].aed.detail.consent.confirm)
        expect(args.cancelText, `${loc} cancelText`).toBe(messages[loc].common.cancel)

        wrapper.unmount(); wrapper = null
      }
    })

    it('★ D1：zh 显示后端 message；en 显示本地化通用文案（不给后端中文留后门）', async () => {
      mockModal(true)

      // zh-CN：后端 message 直出（后端文案本就是中文，保留原文）
      setLocale('zh-CN')
      wrapper = await mountDetail()
      await (wrapper.vm as unknown as { notifyOwner: () => Promise<void> }).notifyOwner()
      await flushPromises()
      expect(lastToastTitle(), 'zh 应显示后端原文').toBe(backendError.message)

      // en-US：**绝不**把后端中文塞进英文界面 ⇒ 走本地化通用兜底
      mockOf((uni as unknown as { showToast: unknown }).showToast).mockClear()
      setLocale('en-US'); await nextTick()
      await (wrapper.vm as unknown as { notifyOwner: () => Promise<void> }).notifyOwner()
      await flushPromises()

      const title = lastToastTitle()
      expect(title, 'en 应显示本地化兜底').toBe(messages['en-US'].aed.detail.toast.notifyFailed)
      expect(hasCjk(title), 'en toast 不得含中文').toBe(false)
      expect(title, 'en 不得等于后端中文 message').not.toBe(backendError.message)
    })

    it('★ 取消同意 ⇒ 走本地化提示（zh/en）', async () => {
      for (const loc of LOCALES) {
        setLocale(loc)
        wrapper = await mountDetail()
        mockModal(false)
        mockOf((uni as unknown as { showToast: unknown }).showToast).mockClear()
        await (wrapper.vm as unknown as { notifyOwner: () => Promise<void> }).notifyOwner()
        expect(lastToastTitle()).toBe(messages[loc].aed.detail.toast.consentCancelled)
        wrapper.unmount(); wrapper = null
      }
    })
  })

  // -------------------------------------------------------------------------
  // 5) ★ 定时器泄漏回归（P0-3 §11.3 同类：进页自动打卡的 500ms 延后句柄）
  // -------------------------------------------------------------------------
  describe('★ 卸载清理：进页自动打卡的延后句柄', () => {
    it('★ action=checkin 后立即离开页面 ⇒ 越过 500ms 也不得再拉起相机', async () => {
      setPageOptions({ id: 'aed_001', action: 'checkin' })
      wrapper = await mountDetail() // 真实定时器：确认 500ms 句柄已被 onUnmounted 清掉

      const choose = mockOf((uni as unknown as { chooseImage: unknown }).chooseImage)
      choose.mockClear()

      wrapper.unmount(); wrapper = null
      await new Promise((resolve) => setTimeout(resolve, 600)) // 越过 500ms

      expect(choose, '卸载后仍拉起相机').not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // 6) ★ 裸 CJK 源码守卫范围清单：P0-4b 已扩围
  // -------------------------------------------------------------------------
  describe('裸 CJK 源码守卫范围清单（共享 SCOPE_FILES）', () => {
    it('★ 覆盖 rescue + guide + aed/index + aed/detail + drill（P0-4b 已扩围）', () => {
      const list = [...SCOPE_FILES]
      expect(list).toContain('src/pages/rescue/index.vue')
      expect(list).toContain('src/pages/guide/index.vue')
      expect(list).toContain('src/pages/aed/index.vue')
      expect(list).toContain('src/pages/aed/detail.vue')
      expect(list).toContain('src/pages/drill/index.vue')
    })
  })
})
