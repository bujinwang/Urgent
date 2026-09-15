import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { SCOPE_FILES, hasCjk } from '@/__tests__/i18n-scope'

/**
 * F2 P0-4a —— `pages/guide/index.vue` 与 `pages/aed/index.vue` 文案本地化的**独立守卫**。
 *
 * 与 `rescue-i18n.test.ts` 同构（见该文件头的「为什么必须有这个文件」）：
 * - `i18n.test.ts` 的静态扫描只证明「**用到的** key 都存在」，证明不了「页面上的中文都被抽走了」；
 * - 它**抓不到**动态拼 key（guide 用 `guide.guides.<type>.sN.<field>` 组装、aed 用 `aed.tier.*`）。
 *
 * 因此本文件补三类静态扫描咬不住的守卫：
 *   ① **运行时 reactivity 契约**（切语言 ⇒ 页面/语音立即改语言，不能"冻结"）
 *   ② **en-US 渲染快照**（`wrapper.text()` 不含中文 —— 覆盖"运行时才拼出来的字符串"）
 *   ③ **内容完整性**（渲染值 === locale 值，数量 === locale 条目数；**v-for 列表优先**）
 * 裸 CJK **源码**守卫在 `rescue-i18n.test.ts` 里按共享的 `SCOPE_FILES` 覆盖这三个页面，
 * 此处另附一条「清单边界」断言（P0-4b 待办）。
 *
 * ⚠️ **测试隔离**（P0-2/P0-3 同一类坑）：`i18n` 与 Pinia store 都是**模块级单例**。
 * - `i18n`：每个用例前后 `setLocale('zh-CN')` 复位；
 * - `aed` store：每个用例 `setActivePinia(createPinia())` 换新实例，且 `fetchAedList` 的 mock
 *   **每次返回全新克隆**（否则 `discoverAed()` 会原地改夹具对象，污染后续用例 —— 实测会让
 *   `discoveredCount` 由 1 漂到 2）。凡断言涉及 store 数据，期望值一律**从 store 现值推导**。
 *
 * 硬契约：不改任何代码，只在运行时 `setLocale('en-US')`，页面所有可见文案与语音整句都立即变英文。
 */

// ── 语音捕获（guide 页用；aed 页不发语音）─────────────────────────────────────
const captured = vi.hoisted(() => ({
  commands: [] as Array<{ text: string; lang?: string }>,
}))

vi.mock('@/utils/voice', () => ({
  DEFAULT_VOICE_LANG: 'zh-CN',
  VoiceManager: class {},
  voice: {
    speak: vi.fn(),
    count: vi.fn(),
    command: vi.fn((text: string, lang?: string) => { captured.commands.push({ text, lang }) }),
    guide: vi.fn(),
    comfort: vi.fn(),
    stop: vi.fn(),
    speakSequence: vi.fn(),
  },
}))

/**
 * AED 夹具工厂 —— **每次调用返回全新克隆**。
 *
 * ⚠️ 不可用共享常量数组：store 的 `discoverAed()` 会**原地**把 `aed.discovered` 改为 `true`，
 * 若跨用例复用同一批对象，后一个用例的 `discoveredCount` 会被前一个用例悄悄抬高（顺序依赖）。
 * 文案用 ASCII，避免与"英文页无中文"快照断言互相干扰。
 */
const aedFixtures = vi.hoisted(() => ({
  make: () => [
    { id: 'aed_001', name: 'Office Lobby AED', address: '1 Main St', distance: 120, lat: 22.5, lng: 113.9, status: 'available', photo: '/static/aed/aed_001.png', model: 'M1', serialNumber: 'S1', batteryExpiry: '', electrodeExpiry: '', lastMaintenance: '', lastCheck: '', indoor: true, floor: 'Floor 1', openHours: '24h', findingInstructions: '', checkIns: [], discovered: false, verified: false },
    { id: 'aed_002', name: 'Park Gate AED', address: '2 Park Rd', distance: 260, lat: 22.5, lng: 113.9, status: 'maintenance', photo: '/static/aed/aed_002.png', model: 'M2', serialNumber: 'S2', batteryExpiry: '', electrodeExpiry: '', lastMaintenance: '', lastCheck: '', indoor: false, floor: '', openHours: '06:00-22:00', findingInstructions: '', checkIns: [], discovered: true, verified: false },
    { id: 'aed_003', name: 'Mall AED', address: '3 Mall Ave', distance: 340, lat: 22.5, lng: 113.9, status: 'available', photo: '/static/aed/aed_003.png', model: 'M3', serialNumber: 'S3', batteryExpiry: '', electrodeExpiry: '', lastMaintenance: '', lastCheck: '', indoor: true, floor: 'B1', openHours: '10:00-22:00', findingInstructions: '', checkIns: [], discovered: false, verified: false },
  ],
}))

/** 让 AED store 的 `refresh()` 直接拿到**全新克隆**的夹具（避免跨用例对象污染）。 */
vi.mock('@/api/aed', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/aed')>()
  return { ...actual, fetchAedList: vi.fn(() => Promise.resolve(aedFixtures.make())) }
})

/** 用户资料：无需真实接口即可渲染（且 name 用 ASCII，便于整页快照断言）。 */
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
import { useAedStore } from '@/stores/aed'

const LOCALES = ['zh-CN', 'en-US'] as const
const GUIDE_TYPES = ['bleeding', 'heimlich', 'fracture', 'transport', 'psychological', 'seizure'] as const

/** 用 locale 模板 + 具名参数还原期望整句（锚到 locale 文件，不在测试里硬抄文案）。 */
const interp = (tpl: string, params: Record<string, string | number>): string =>
  tpl.replace(/\{(\w+)\}/g, (_m, k: string) => String(params[k]))

/**
 * 把 locale 里的**索引键对象**（`steps: { s1, s2, … }`）按数字后缀排序后取值为数组。
 * 顺序按 `s<n>` 的 n 排，不依赖对象键的书写顺序。
 */
function stepsOf(steps: Record<string, { title: string; detail: string }>): Array<{ title: string; detail: string }> {
  return Object.keys(steps)
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map(k => steps[k])
}

// ── 页面驱动工具 ───────────────────────────────────────────────────────────
async function mountGuide(type?: typeof GUIDE_TYPES[number]) {
  const page = await import('@/pages/guide/index.vue')
  const wrapper = mount(page.default)
  if (type) {
    ;(wrapper.vm as unknown as { type: string }).type = type
    await nextTick()
  }
  return wrapper
}

async function mountAed() {
  const page = await import('@/pages/aed/index.vue')
  const wrapper = mount(page.default)
  await flushPromises() // 让 store 的 refresh() 落地并注入夹具
  await nextTick()
  return wrapper
}

describe('P0-4a：guide + aed/index 文案本地化', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    // ⚠️ `i18n` 是模块级单例、`setLocale` 会写存储 ⇒ 必须逐用例复位，否则跨用例污染。
    setLocale('zh-CN')
    captured.commands.length = 0
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
    it('★ guide 页标题（索引键 + computed 组装）：zh → en 立即生效', async () => {
      wrapper = await mountGuide('bleeding')
      expect(wrapper.find('.guide-title').text()).toBe(messages['zh-CN'].guide.guides.bleeding.title)

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.guide-title').text()).toBe(messages['en-US'].guide.guides.bleeding.title)

      setLocale('zh-CN'); await nextTick()
      expect(wrapper.find('.guide-title').text()).toBe(messages['zh-CN'].guide.guides.bleeding.title)
    })

    it('★ aed 页横幅 + 等级 + 状态标签：zh → en 立即生效', async () => {
      wrapper = await mountAed()
      expect(wrapper.find('.aed-drill-text').text()).toBe(messages['zh-CN'].aed.drillBanner)
      expect(wrapper.find('.aed-explorer-tier').text())
        .toBe(`${messages['zh-CN'].aed.tier.bronze} ${messages['zh-CN'].aed.explorerTier}`)
      expect(wrapper.findAll('.aed-radar-status').map(n => n.text()))
        .toEqual([messages['zh-CN'].aed.status.available, messages['zh-CN'].aed.status.maintenance, messages['zh-CN'].aed.status.available])

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.aed-drill-text').text()).toBe(messages['en-US'].aed.drillBanner)
      expect(wrapper.find('.aed-explorer-tier').text())
        .toBe(`${messages['en-US'].aed.tier.bronze} ${messages['en-US'].aed.explorerTier}`)
      expect(wrapper.findAll('.aed-radar-status').map(n => n.text()))
        .toEqual([messages['en-US'].aed.status.available, messages['en-US'].aed.status.maintenance, messages['en-US'].aed.status.available])
    })
  })

  // -------------------------------------------------------------------------
  // 2) ★ 内容完整性：渲染值 === locale 值，数量 === locale 条目数
  //    （锚到 `messages[locale]`；先数量、再内容）
  // -------------------------------------------------------------------------
  describe('★ 内容完整性：渲染值 === locale 值，数量 === locale 条目数', () => {
    for (const loc of LOCALES) {
      for (const type of GUIDE_TYPES) {
        it(`★ [${loc}] guide/${type}：标题 + 全部步骤 title/detail + 注意事项清单 === locale 值`, async () => {
          setLocale(loc)
          wrapper = await mountGuide(type)
          const g = messages[loc].guide.guides[type]
          const stepList = stepsOf(g.steps as unknown as Record<string, { title: string; detail: string }>)

          expect(wrapper.find('.guide-title').text()).toBe(g.title)
          // 步骤总数以 locale 为准（删/加一个 sN ⇒ 键数变化 ⇒ 这里先红）
          expect(wrapper.find('.guide-step-indicator').text()).toBe(`1 / ${stepList.length}`)

          for (let i = 0; i < stepList.length; i++) {
            ;(wrapper.vm as unknown as { current: number }).current = i
            await nextTick()
            expect(wrapper.find('.card-title').text(), `step ${i} title`).toBe(stepList[i].title)
            expect(wrapper.find('.card-detail').text(), `step ${i} detail`).toBe(stepList[i].detail)
            // 图标来自组件侧元数据（非 i18n）：与 locale 键数错位会在此暴露为空
            expect(wrapper.find('.scene-emoji').text(), `step ${i} icon`).not.toBe('')
          }

          // 注意事项 = v-for 列表 ⇒ 数量先断言，再逐项内容
          await wrapper.find('.guide-warn-toggle').trigger('click')
          await nextTick()
          const items = wrapper.findAll('.guide-warning-item')
          expect(items.length, '注意事项数量').toBe(g.warnings.length)
          expect(items.map(n => n.text())).toEqual([...g.warnings])
        })
      }

      it(`★ [${loc}] aed：横幅/进度/雷达清单（v-for）=== locale 值，数量优先`, async () => {
        setLocale(loc)
        wrapper = await mountAed()
        const a = messages[loc].aed
        const store = useAedStore()
        const fixtures = aedFixtures.make()

        expect(wrapper.find('.aed-drill-text').text()).toBe(a.drillBanner)
        expect(wrapper.find('.aed-home-label').text()).toBe(a.home)
        expect(wrapper.find('.aed-section-title').text()).toBe(a.radarTitle)
        // 探索进度（整句插值，**从 store 现值推导**，不硬编码夹具数字）
        expect(wrapper.find('.aed-progress-text').text())
          .toBe(interp(a.progress, { discovered: store.discoveredCount, total: store.totalCount }))
        // 地图浮标（整句插值）：条数取自 store
        expect(wrapper.find('.aed-radar-label').text())
          .toBe(interp(a.nearby, { count: store.nearbyAeds.length }))

        // 附近雷达 = v-for 列表 ⇒ 数量先断言，再逐项名称/地址/状态
        const items = wrapper.findAll('.aed-radar-item')
        expect(items.length, '雷达项数量').toBe(fixtures.length)
        expect(wrapper.findAll('.aed-radar-name').map(n => n.text())).toEqual(fixtures.map(f => f.name))
        expect(wrapper.findAll('.aed-radar-addr').map(n => n.text())).toEqual(fixtures.map(f => f.address))
        expect(wrapper.findAll('.aed-radar-status').map(n => n.text()))
          .toEqual(fixtures.map(f => (f.status === 'available' ? a.status.available : a.status.maintenance)))

        // 地图图钉同样 v-for，数量一致
        expect(wrapper.findAll('.aed-map-pokestop').length, '地图图钉数量').toBe(fixtures.length)
      })

      it(`★ [${loc}] aed 快速预览：状态徽标/地点/两个按钮 === locale 值`, async () => {
        setLocale(loc)
        wrapper = await mountAed()
        const a = messages[loc].aed

        // 点第 2 项（Park Gate，户外 · maintenance）
        await wrapper.findAll('.aed-radar-item')[1].trigger('click')
        await nextTick()
        expect(wrapper.find('.aed-preview-name').text()).toBe('Park Gate AED')
        expect(wrapper.find('.aed-preview-addr').text()).toBe('2 Park Rd')
        expect(wrapper.find('.aed-preview-photo-badge').text()).toBe(a.status.maintenance)
        expect(wrapper.find('.aed-preview-meta').text()).toContain(a.outdoor)
        expect(wrapper.find('.aed-preview-btn.primary').text()).toContain(a.viewDetail)
        expect(wrapper.find('.aed-preview-btn.secondary').text()).toBe(a.checkIn)

        // 再点第 1 项（室内 ⇒ 显示楼层而非"户外"）
        await wrapper.findAll('.aed-radar-item')[0].trigger('click')
        await nextTick()
        expect(wrapper.find('.aed-preview-meta').text()).toContain('Floor 1')
        expect(wrapper.find('.aed-preview-meta').text()).not.toContain(a.outdoor)
      })
    }
  })

  // -------------------------------------------------------------------------
  // 3) ★ en-US 渲染快照：整页文本不含中文字符（覆盖运行时拼出来的字符串）
  // -------------------------------------------------------------------------
  describe('★ en-US 渲染快照：页面文本不含中文字符', () => {
    it('★ guide 页：初始步 + 展开注意事项 + 推进到末步', async () => {
      setLocale('en-US')
      wrapper = await mountGuide('heimlich') // 6 步（含"失去意识 → CPR"警示步）
      expect(hasCjk(wrapper.text()), '初始步').toBe(false)

      await wrapper.find('.guide-warn-toggle').trigger('click')
      await nextTick()
      expect(hasCjk(wrapper.text()), '展开注意事项').toBe(false)

      ;(wrapper.vm as unknown as { current: number }).current = 5
      await nextTick()
      expect(hasCjk(wrapper.text()), '警示步').toBe(false)
    })

    it('★ aed 页：列表 + 打开预览', async () => {
      setLocale('en-US')
      wrapper = await mountAed()
      expect(hasCjk(wrapper.text()), '列表').toBe(false)

      await wrapper.findAll('.aed-radar-item')[1].trigger('click')
      await nextTick()
      expect(hasCjk(wrapper.text()), '预览').toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // 4) ★ guide 语音：整句按语言取（**插值**，非代码拼接 title/detail）
  // -------------------------------------------------------------------------
  describe('★ guide 语音整句：插值 + 透传语言（禁止代码拼接）', () => {
    /** 点「下一步 →」推进到第 2 步，并让 200ms 动画 + 300ms 播报定时器落地。 */
    async function goNext() {
      await wrapper!.find('.nav-btn.next').trigger('click')
      await vi.advanceTimersByTimeAsync(700)
      await nextTick()
    }

    it('★ zh-CN：voice.command 收到 `guide.voice.step` 的 zh 插值整句，lang=zh-CN', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
      setLocale('zh-CN')
      wrapper = await mountGuide('bleeding')
      await goNext()

      const step = messages['zh-CN'].guide.guides.bleeding.steps.s2
      expect(captured.commands.at(-1)).toEqual({
        text: interp(messages['zh-CN'].guide.voice.step, { title: step.title, detail: step.detail }),
        lang: 'zh-CN',
      })
    })

    it('★ en-US：`guide.voice.step` 的 en 插值整句，lang=en-US，且不含中文', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
      setLocale('en-US')
      wrapper = await mountGuide('bleeding')
      await goNext()

      const step = messages['en-US'].guide.guides.bleeding.steps.s2
      const last = captured.commands.at(-1)
      expect(last).toEqual({
        text: interp(messages['en-US'].guide.voice.step, { title: step.title, detail: step.detail }),
        lang: 'en-US',
      })
      expect(hasCjk(last!.text), 'en 语音不得含中文').toBe(false)
    })

    it('★ 卸载清理：推进后**立即** unmount ⇒ 越过 300ms 也不得再播报', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
      wrapper = await mountGuide('bleeding')
      await wrapper.find('.nav-btn.next').trigger('click') // 调度 200ms 动画
      await vi.advanceTimersByTimeAsync(200)               // current → 1，watch 调度 300ms 播报
      await nextTick()

      wrapper.unmount(); wrapper = null
      const before = captured.commands.length

      await vi.advanceTimersByTimeAsync(1000)              // 越过 300ms
      expect(captured.commands.length, '卸载后新增播报').toBe(before)
    })
  })
})

// ---------------------------------------------------------------------------
// 5) ★ 裸 CJK 源码守卫范围清单：P0-4a 扩围 + P0-4b 边界
//    （守卫本体在 `rescue-i18n.test.ts`，按同一份 SCOPE_FILES 逐文件扫描）
// ---------------------------------------------------------------------------
describe('裸 CJK 源码守卫范围清单（共享 SCOPE_FILES）', () => {
  it('★ 覆盖 rescue + guide + aed；**刻意不含**待办的 detail/drill（P0-4b 待加）', () => {
    const list = [...SCOPE_FILES]
    expect(list).toContain('src/pages/rescue/index.vue')
    expect(list).toContain('src/pages/guide/index.vue')
    expect(list).toContain('src/pages/aed/index.vue')
    // P0-4b 待加：这两页文案仍为硬编码中文，现在纳入会让守卫对既存中文误报红
    expect(list).not.toContain('src/pages/aed/detail.vue')
    expect(list).not.toContain('src/pages/drill/index.vue')
  })
})
