import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import fs from 'node:fs'
import path from 'node:path'

/**
 * F2 P0-3 —— 核心 SOS 页（`pages/rescue/index.vue`）文案本地化的**独立守卫**。
 *
 * 为什么必须有这个文件（而不是只靠 `i18n.test.ts` 的静态扫描）：
 * - 静态扫描只证明「**用到的** key 都存在」；它**证明不了「页面上的中文都被抽走了」**。
 * - `i18n.test.ts` 的扫描器**抓不到动态拼 key**（`t(\`rescue.cpr.pressLabel.${state}\`)`）。
 * - 因此本文件补三类静态扫描咬不住的守卫：
 *   ① **运行时 reactivity 契约**（切语言 ⇒ 页面/语音立即改语言，不能"冻结"）
 *   ② **en-US 渲染快照**（`wrapper.text()` 不含中文 —— 覆盖"运行时才拼出来的字符串"）
 *   ③ **裸 CJK 源码守卫**（剥离注释后扫本文件，抽漏即红）
 *
 * 硬契约（设计 §10 / 任务书）：**不改任何代码，只在运行时 `setLocale('en-US')`，
 * 页面上所有可见文案与所有语音整句都必须立刻变成英文。**
 */

const captured = vi.hoisted(() => ({
  speaks: [] as Array<{ text: string; lang?: string }>,
  counts: [] as Array<{ text: string; lang?: string }>,
  commands: [] as Array<{ text: string; lang?: string }>,
  guides: [] as Array<{ text: string; lang?: string }>,
}))

// 捕获页面实际发出的每次合成请求（文本 + lang）。
vi.mock('@/utils/voice', () => ({
  DEFAULT_VOICE_LANG: 'zh-CN',
  VoiceManager: class {},
  voice: {
    speak: vi.fn((text: string, opts?: { lang?: string }) => { captured.speaks.push({ text, lang: opts?.lang }) }),
    count: vi.fn((text: string, lang?: string) => { captured.counts.push({ text, lang }) }),
    command: vi.fn((text: string, lang?: string) => { captured.commands.push({ text, lang }) }),
    guide: vi.fn((text: string, lang?: string) => { captured.guides.push({ text, lang }) }),
    comfort: vi.fn(),
    stop: vi.fn(),
    speakSequence: vi.fn(),
  },
}))

vi.mock('@/api/sos', () => ({
  reportSosEvent: vi.fn(() => Promise.resolve()),
  newSosEventId: vi.fn(() => 'sos_test_id'),
}))

import StepTimer from '@/components/StepTimer/index.vue'
import { i18n, setLocale } from '@/i18n'
import { messages } from '@/locales'

/** 中文字符（CJK 统一表意文字）。 */
const RE_CJK = /[\u4e00-\u9fa5]/
const hasCjk = (s: string) => RE_CJK.test(s)

// ---------------------------------------------------------------------------
// 页面驱动工具（真实走 UI：`.sos-button → .confirm-check → .confirm-btn → 步骤推进`）
// ---------------------------------------------------------------------------

async function mountRescue() {
  const page = await import('@/pages/rescue/index.vue')
  return mount(page.default)
}

/** 让 watch 里的 `setTimeout(50)` 落地（触发该步的语音/副作用）。 */
async function settle(ms = 60) {
  await nextTick()
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}

/** 打开确认弹层 → 勾选免责 → 启动 CPR 到第 1 步（并落地 step1 的语音）。 */
async function startCpr(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.sos-button').trigger('click')      // showConfirm()
  await wrapper.find('.confirm-check').trigger('click')   // confirmed = true
  await wrapper.find('.confirm-btn').trigger('click')     // startCpr() → stage='cpr', cprStep=1
  await settle()
}

/** 触发当前步骤 StepTimer 的 `done`。 */
function done(wrapper: ReturnType<typeof mount>) {
  ;(wrapper.findComponent(StepTimer).vm as unknown as { $emit: (e: string) => void }).$emit('done')
}

/** 推进到第 4 步（胸外按压）并跑出按压循环首拍。 */
async function reachStep4(wrapper: ReturnType<typeof mount>) {
  await startCpr(wrapper)                                                 // → step 1
  await wrapper.find('.step-btn-primary').trigger('click'); await settle() // 1 → 2
  done(wrapper); await settle()                                            // 2 → 3
  done(wrapper); await settle()                                            // 3 → 4（startPress）
}

/** 推进到第 5 步（人工呼吸）：按压满 30 次。 */
async function reachStep5(wrapper: ReturnType<typeof mount>) {
  await reachStep4(wrapper)
  await vi.advanceTimersByTimeAsync(545 * 30) // pressCount 到 30 ⇒ cprStep='5'
  await settle()
}

/** 推进到 `loop`（循环）。 */
async function reachLoop(wrapper: ReturnType<typeof mount>) {
  await reachStep5(wrapper)
  done(wrapper); await nextTick()  // 人工呼吸 1 → 2
  done(wrapper); await settle()    // 2 → loop
}

/** 直接驱动到 AED 阶段（UI 无入口，需经 vm 设置 `cprStep`）。 */
async function reachAed(wrapper: ReturnType<typeof mount>, phase: 0 | 1) {
  ;(wrapper.vm as unknown as { stage: string }).stage = 'cpr'
  await nextTick()
  ;(wrapper.vm as unknown as { cprStep: string }).cprStep = 'aed'
  await settle()
  if (phase === 1) {
    ;(wrapper.vm as unknown as { aedPhase: number }).aedPhase = 1
    await settle()
  }
}

/** 演习模式（`mode=drill`）：必须在 `mount` 之前排队（`getCurrentPages` 只放一次）。 */
function useDrillMode() {
  vi.mocked(getCurrentPages).mockReturnValueOnce([
    { options: { mode: 'drill' }, route: 'pages/rescue/index' },
  ] as unknown as ReturnType<typeof getCurrentPages>)
}

describe('rescue 页：P0-3 文案本地化', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    // ⚠️ `i18n` 是**模块级单例**、且 `setLocale` 会写存储 ⇒ 必须逐用例复位，否则跨用例污染。
    setLocale('zh-CN')
    captured.speaks.length = 0
    captured.counts.length = 0
    captured.commands.length = 0
    captured.guides.length = 0
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    setLocale('zh-CN')
    wrapper?.unmount()
    wrapper = null
  })

  // -------------------------------------------------------------------------
  // 1) ★ reactivity 契约（本期的核心）
  // -------------------------------------------------------------------------
  describe('reactivity：切语言后页面立即改语言（防"冻结语言"）', () => {
    it('★ 模板静态文案：zh → en 立即生效', async () => {
      wrapper = await mountRescue()
      expect(wrapper.find('.rescue-title').text()).toBe(messages['zh-CN'].rescue.title)
      expect(wrapper.find('.decision-main').text()).toBe(messages['zh-CN'].rescue.decision.main)

      setLocale('en-US')
      await nextTick()

      expect(wrapper.find('.rescue-title').text()).toBe(messages['en-US'].rescue.title)
      expect(wrapper.find('.decision-main').text()).toBe(messages['en-US'].rescue.decision.main)
    })

    it('★ 双向：zh → en → zh 都能生效（防止"只能切一次"）', async () => {
      wrapper = await mountRescue()
      const main = () => wrapper!.find('.decision-main').text()
      expect(main()).toBe(messages['zh-CN'].rescue.decision.main)

      setLocale('en-US'); await nextTick()
      expect(main()).toBe(messages['en-US'].rescue.decision.main)

      setLocale('zh-CN'); await nextTick()
      expect(main()).toBe(messages['zh-CN'].rescue.decision.main)
    })

    it('★ dispose 承重：卸载一个实例后，新实例的 locale 仍可响应式切换（防 globalScope.stop 冻结 composer.locale）', async () => {
      // vue-i18n 的 install 会把 app.unmount 包一层调用 `i18n.dispose()` ⇒ `globalScope.stop()`
      // ⇒ 共享单例的 `composer.locale`（一个 computed）从此冻结。`setup.ts` 把 dispose 降级为空操作。
      // 这条用例**在单个用例内**复现「卸载后再挂载」，因此不依赖执行顺序。
      const a = await mountRescue()
      a.unmount() // 若无 dispose 空操作 ⇒ 此处 globalScope.stop()，冻结 composer.locale

      const b = await mountRescue()
      setLocale('zh-CN'); await nextTick()
      expect((b.vm as unknown as { voiceLang: string }).voiceLang).toBe('zh-CN')

      setLocale('en-US'); await nextTick()
      expect((b.vm as unknown as { voiceLang: string }).voiceLang).toBe('en-US')

      setLocale('zh-CN'); await nextTick()
      expect((b.vm as unknown as { voiceLang: string }).voiceLang).toBe('zh-CN')
      b.unmount()
    })

    it('★ 模块级常量 stepLabels：切语言后 5 个 pill 标签同步变英文', async () => {
      wrapper = await mountRescue()
      await startCpr(wrapper)
      const labels = () => wrapper!.findAll('.step-pill-label').map((n) => n.text())
      expect(labels()).toEqual(['呼救', '判断', '呼吸', '按压', '人工呼吸'])

      setLocale('en-US'); await nextTick()
      expect(labels()).toEqual(['Call', 'Check', 'Breathe', 'Compress', 'Ventilate'])
    })

    it('★ 模块级常量 emergencyGuides：切语言后"其他紧急情况"卡片变英文', async () => {
      wrapper = await mountRescue()
      const first = () => wrapper!.findAll('.decision-other-name')[0].text()
      expect(first()).toBe('异物窒息')

      setLocale('en-US'); await nextTick()
      expect(first()).toBe('Choking')
    })

    it('★ 模块级常量 ventSteps：切语言后人工呼吸清单变英文', async () => {
      wrapper = await mountRescue()
      await reachStep5(wrapper)
      const titles = () => wrapper!.findAll('.vent-text').map((n) => n.text())
      expect(titles()[0]).toContain('仰头抬下巴')

      setLocale('en-US'); await nextTick()
      expect(titles()[0]).toContain('Tilt head, lift chin')
    })

    it('★ computed stepTitle：切语言后顶栏标题变英文', async () => {
      wrapper = await mountRescue()
      await startCpr(wrapper)
      expect(wrapper.find('.rescue-title').text()).toBe('第 1 步 · 呼救')

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.rescue-title').text()).toBe('Step 1 · Call for help')
    })

    it('★ computed aedPhaseLabel：切语言后 AED 阶段标签变英文', async () => {
      wrapper = await mountRescue()
      await reachAed(wrapper, 0)
      expect(wrapper.find('.step-action-label').text()).toBe('AED 分析中 · 停止按压')

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.step-action-label').text()).toBe('AED analyzing · Stop compressions')
    })
  })

  // -------------------------------------------------------------------------
  // 2) ★ pressLabel / pressNumDisplay 的「状态-文本分离」
  // -------------------------------------------------------------------------
  describe('pressLabel 状态-文本分离（防 ref 初值把语言冻结）', () => {
    it('★ en-US：idle / hint / reset 三档都渲染英文', async () => {
      setLocale('en-US')
      wrapper = await mountRescue()
      // idle 档（未开始）
      expect((wrapper.vm as unknown as { pressLabel: string }).pressLabel).toBe('Tap the circle to reset')
      expect((wrapper.vm as unknown as { pressNumDisplay: string }).pressNumDisplay).toBe('Ready')

      await reachStep4(wrapper) // step===4 ⇒ pressLabelState='hint'
      expect(wrapper.find('.metronome-label').text()).toBe('Press along with the number')

      await wrapper.find('.metronome').trigger('click') // resetCount ⇒ pressLabelState='reset'
      await nextTick()
      expect(wrapper.find('.metronome-label').text()).toBe('Reset')
    })

    it('★ zh-CN：hint / reset 两档渲染中文（对照组，防"en 值被写成中文")', async () => {
      wrapper = await mountRescue()
      await reachStep4(wrapper)
      expect(wrapper.find('.metronome-label').text()).toBe('跟屏幕数字按压')

      await wrapper.find('.metronome').trigger('click')
      await nextTick()
      expect(wrapper.find('.metronome-label').text()).toBe('已重置')
    })
  })

  // -------------------------------------------------------------------------
  // 3) ★ en-US 渲染快照：页面文本不含任何中文字符
  //    （比源码扫描更强：能覆盖"运行时才拼出来的字符串"；两条都要）
  // -------------------------------------------------------------------------
  describe('en-US 渲染快照：页面文本不含中文字符', () => {
    it('★ 决策页', async () => {
      setLocale('en-US')
      wrapper = await mountRescue()
      expect(wrapper.text()).not.toMatch(RE_CJK)
    })

    it('★ 确认弹层（真实场景）', async () => {
      setLocale('en-US')
      wrapper = await mountRescue()
      await wrapper.find('.sos-button').trigger('click') // showConfirm ⇒ 弹层可见
      await nextTick()
      expect(wrapper.text()).not.toMatch(RE_CJK)
    })

    it('★ 演习模式：决策页 + 确认弹层 + 步骤1（含全部演习专属文案）', async () => {
      setLocale('en-US')
      useDrillMode()
      wrapper = await mountRescue()
      expect(wrapper.text(), '演习决策页').not.toMatch(RE_CJK)

      await wrapper.find('.sos-button').trigger('click'); await nextTick()
      expect(wrapper.text(), '演习确认弹层').not.toMatch(RE_CJK)

      await wrapper.find('.confirm-check').trigger('click')
      await wrapper.find('.confirm-btn').trigger('click')
      await settle()
      expect(wrapper.text(), '演习步骤1').not.toMatch(RE_CJK)
    })

    it('★ 进入按压步（step 4）后', async () => {
      setLocale('en-US')
      wrapper = await mountRescue()
      await reachStep4(wrapper)
      expect(wrapper.text()).not.toMatch(RE_CJK)
    })

    it('★ 人工呼吸步（step 5）与循环步（loop）后', async () => {
      setLocale('en-US')
      wrapper = await mountRescue()
      await reachStep5(wrapper)
      expect(wrapper.text(), 'step 5').not.toMatch(RE_CJK)

      done(wrapper); await nextTick()
      done(wrapper); await settle()
      expect(wrapper.text(), 'loop').not.toMatch(RE_CJK)
    })

    it('★ AED 阶段（phase 0 / 1 / 2）', async () => {
      setLocale('en-US')
      wrapper = await mountRescue()
      await reachAed(wrapper, 0)
      expect(wrapper.text(), 'aed phase0').not.toMatch(RE_CJK)

      ;(wrapper.vm as unknown as { aedPhase: number }).aedPhase = 1; await settle()
      expect(wrapper.text(), 'aed phase1').not.toMatch(RE_CJK)

      ;(wrapper.vm as unknown as { aedPhase: number }).aedPhase = 2; await settle()
      expect(wrapper.text(), 'aed phase2').not.toMatch(RE_CJK)
    })
  })

  // -------------------------------------------------------------------------
  // 4) ★ 语音整句按语言取（设计 §10.2 收口的 7 条）
  // -------------------------------------------------------------------------
  describe('语音整句按语言取（7 条）', () => {
    it('★ zh-CN：7 条整句逐条为中文且 lang=zh-CN', async () => {
      // 期望值锚到 locale 文件（不硬抄），改文案时测试自动跟随。
      const zhv = messages['zh-CN'].rescue.voice
      wrapper = await mountRescue()

      // ① 非演习 step1
      await startCpr(wrapper)
      expect(captured.commands[0], 'step1 非演习').toEqual({ text: zhv.step1, lang: 'zh-CN' })

      // ② step2
      await wrapper.find('.step-btn-primary').trigger('click'); await settle()
      expect(captured.guides[0], 'step2').toEqual({ text: zhv.step2, lang: 'zh-CN' })

      // ③ step5
      done(wrapper); await settle()  // 2 → 3
      done(wrapper); await settle()  // 3 → 4
      await vi.advanceTimersByTimeAsync(545 * 30); await settle()
      expect(captured.guides[1], 'step5').toEqual({ text: zhv.step5, lang: 'zh-CN' })

      // ④ loop
      done(wrapper); await nextTick()
      done(wrapper); await settle()
      expect(captured.commands[1], 'loop').toEqual({ text: zhv.loop, lang: 'zh-CN' })

      // 卸掉上一个实例，避免其定时器污染后续捕获
      wrapper.unmount(); wrapper = null

      // ⑤⑥ AED phase0 / phase1
      const w2 = await mountRescue()
      await reachAed(w2, 0)
      expect(captured.speaks.at(-1), 'aed phase0').toEqual({ text: zhv.aed0, lang: 'zh-CN' })
      ;(w2.vm as unknown as { aedPhase: number }).aedPhase = 1; await settle()
      expect(captured.speaks.at(-1), 'aed phase1').toEqual({ text: zhv.aed1, lang: 'zh-CN' })
      w2.unmount()

      // ⑦ 演习 step1
      useDrillMode()
      const w4 = await mountRescue()
      await startCpr(w4)
      expect(captured.commands.at(-1), 'step1 演习').toEqual({ text: zhv.step1Drill, lang: 'zh-CN' })
      w4.unmount()
    })

    it('★ en-US：7 条整句逐条为英文且 lang=en-US（不含中文字符）', async () => {
      const env = messages['en-US'].rescue.voice
      setLocale('en-US')
      wrapper = await mountRescue()

      await startCpr(wrapper)
      expect(captured.commands[0], 'step1 非演习').toEqual({ text: env.step1, lang: 'en-US' })

      await wrapper.find('.step-btn-primary').trigger('click'); await settle()
      expect(captured.guides[0], 'step2').toEqual({ text: env.step2, lang: 'en-US' })

      done(wrapper); await settle()
      done(wrapper); await settle()
      await vi.advanceTimersByTimeAsync(545 * 30); await settle()
      expect(captured.guides[1], 'step5').toEqual({ text: env.step5, lang: 'en-US' })

      done(wrapper); await nextTick()
      done(wrapper); await settle()
      expect(captured.commands[1], 'loop').toEqual({ text: env.loop, lang: 'en-US' })

      // 卸掉上一个实例，避免其定时器污染后续捕获
      wrapper.unmount(); wrapper = null

      const w2 = await mountRescue()
      await reachAed(w2, 0)
      expect(captured.speaks.at(-1), 'aed phase0').toEqual({ text: env.aed0, lang: 'en-US' })
      ;(w2.vm as unknown as { aedPhase: number }).aedPhase = 1; await settle()
      expect(captured.speaks.at(-1), 'aed phase1').toEqual({ text: env.aed1, lang: 'en-US' })
      w2.unmount()

      useDrillMode()
      const w4 = await mountRescue()
      await startCpr(w4)
      expect(captured.commands.at(-1), 'step1 演习').toEqual({ text: env.step1Drill, lang: 'en-US' })
      w4.unmount()

      // 7 条整句都不得含中文字符
      const all = [...captured.commands, ...captured.guides, ...captured.speaks].map((x) => x.text)
      expect(all.filter(hasCjk)).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // 4.4) ★ 卸载清理：不得残留「已调度但未清理」的延后回调
  //
  // 为什么单独测：`watch` 里"延后 50ms 播报"与 `resetCount` 里"1.5s 后恢复"都是 `setTimeout`，
  // 原先**没存句柄**，`stopAll()` 清不到 ⇒ 卸载后仍会触发。其内容改成 `t(...)`（i18n）后，
  // 卸载后触发会去碰 i18n 运行时：测试环境已拆除 ⇒ `ReferenceError: window is not defined`
  // （vitest 报 `Errors 1 error`，且可能掩盖真失败）；生产则是"已退出还在说话"。
  // -------------------------------------------------------------------------
  describe('★ 卸载清理：不得残留延后触发的语音回调', () => {
    it('★ 到 step1 后**立即** unmount ⇒ 越过 50ms 也不得再播报', async () => {
      wrapper = await mountRescue()
      await wrapper.find('.sos-button').trigger('click')     // showConfirm()
      await wrapper.find('.confirm-check').trigger('click')  // confirmed = true
      await wrapper.find('.confirm-btn').trigger('click')    // cprStep=1 ⇒ watch 调度 50ms 定时器
      await nextTick()                                       // watch 同步跑完：定时器已排队、尚未触发

      wrapper.unmount()                                      // 卸载 ⇒ onUnmounted → stopAll() 必须清掉它
      wrapper = null

      await vi.advanceTimersByTimeAsync(200)                 // 越过 50ms

      expect(captured.commands, 'voice.command').toEqual([])
      expect(captured.guides, 'voice.guide').toEqual([])
      expect(captured.speaks, 'voice.speak').toEqual([])
      expect(captured.counts, 'voice.count').toEqual([])
    })

    it('★ resetCount 的 1.5s 延后回调同样不得在卸载后重新起按压', async () => {
      wrapper = await mountRescue()
      await reachStep4(wrapper)                              // 进入按压步（watch 已调度并落地）
      await wrapper.find('.metronome').trigger('click')      // resetCount ⇒ 调度 1.5s 回调
      await nextTick()
      const speaksBefore = captured.speaks.length

      wrapper.unmount(); wrapper = null
      await vi.advanceTimersByTimeAsync(3000)                // 越过 1.5s

      // 卸载后不得再有新的合成请求（否则说明 1.5s 回调又 startPress 了）
      expect(captured.speaks.length, 'reset 回调后新增播报').toBe(speaksBefore)
    })
  })

  // -------------------------------------------------------------------------
  // 4.5) ★ 内容完整性守卫：渲染值 === locale 值，数量 === locale 条目数
  //
  // 为什么需要它：上面两条守卫（源码裸 CJK 扫描 / en 渲染快照）**都只证明「没有多余的中文」，
  // 证明不了「该有的还在」** —— 整段删掉一个 UI 区块、把列表项由 4 删成 3，CI 会**静默通过**
  // （QA 的 M1「删 transport 整项」、M2「ventSteps 4→3」突变实测 SURVIVED）。
  //
  // 设计要点：**期望值锚到 locale 文件（`messages[locale]`），不在测试里硬抄文案** ——
  // 否则每次正常改文案都要改测试，会训练人盲目更新断言（快照测试的经典失效模式）。
  // 这样同时拿到两条保证：删项 ⇒ 数量断言红；渲染漂移（computed 忘了跟 locale）⇒ 内容断言红。
  //
  // ⚠️ **刻意不覆盖的边界（不是漏写，勿"修"）**：
  // 「有人把某条 locale 值改成乱码」这类**纯文案损坏**，任何「渲染 == locale」的断言**原理上都抓不到**
  // （它比的是同一个源）。要抓它只能把期望中文**逐字硬抄进测试**，代价是每次正常改文案都会误报，
  // 反而鼓励盲目更新断言。⇒ **不写**；该风险由 diff review 覆盖（已记入设计文档，属已知边界）。
  // -------------------------------------------------------------------------
  describe('★ 内容完整性：渲染值 === locale 值，数量 === locale 条目数', () => {
    const LOCALES = ['zh-CN', 'en-US'] as const
    /** 折叠空白后再比，避免模板文本节点的空格差异造成假红。 */
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

    for (const loc of LOCALES) {
      it(`★ [${loc}] 决策页「其他紧急情况」：数量 === rescue.guides 条目数，且每张卡片 title/desc === locale 值`, async () => {
        setLocale(loc)
        wrapper = await mountRescue()
        const expected = Object.values(messages[loc].rescue.guides)

        // 先数量、再内容：删项时失败信息直指"少了一个"，而不是一堆文本 diff。
        const cards = wrapper.findAll('.decision-other-btn')
        expect(cards.length, '卡片数量').toBe(expected.length)

        expect(wrapper.findAll('.decision-other-name').map((n) => n.text())).toEqual(expected.map((g) => g.title))
        expect(wrapper.findAll('.decision-other-desc').map((n) => n.text())).toEqual(expected.map((g) => g.desc))
      })

      it(`★ [${loc}] step5 人工呼吸清单：数量 === ventSteps 条目数，且每项渲染 === locale 值`, async () => {
        setLocale(loc)
        wrapper = await mountRescue()
        await reachStep5(wrapper)
        const v = messages[loc].rescue.vent
        const expected = [v.s1, v.s2, v.s3, v.s4]

        const items = wrapper.findAll('.vent-item')
        expect(items.length, '清单项数量').toBe(expected.length)

        expect(wrapper.findAll('.vent-sub').map((n) => n.text())).toEqual(expected.map((s) => s.sub))
        expect(wrapper.findAll('.vent-text').map((n) => norm(n.text())))
          .toEqual(expected.map((s) => norm(`${s.title} ${s.sub}`)))
      })

      it(`★ [${loc}] stepLabels：5 个 pill 标签逐个 === rescue.steps.labels`, async () => {
        setLocale(loc)
        wrapper = await mountRescue()
        await startCpr(wrapper)
        const expected = messages[loc].rescue.steps.labels

        const pills = wrapper.findAll('.step-pill-label')
        expect(pills.length, 'pill 数量').toBe(expected.length)
        expect(pills.map((n) => n.text())).toEqual([...expected])
      })

      it(`★ [${loc}] stepTitle：7 个阶段顶栏标题逐个 === rescue.stepTitle.*`, async () => {
        setLocale(loc)
        const st = messages[loc].rescue.stepTitle
        wrapper = await mountRescue()
        const title = () => wrapper!.find('.rescue-title').text()

        await startCpr(wrapper)
        expect(title(), 's1').toBe(st.s1)
        await wrapper.find('.step-btn-primary').trigger('click'); await settle()
        expect(title(), 's2').toBe(st.s2)
        done(wrapper); await settle()
        expect(title(), 's3').toBe(st.s3)
        done(wrapper); await settle()
        expect(title(), 's4').toBe(st.s4)
        await vi.advanceTimersByTimeAsync(545 * 30); await settle()
        expect(title(), 's5').toBe(st.s5)
        done(wrapper); await nextTick(); done(wrapper); await settle()
        expect(title(), 'loop').toBe(st.loop)
        ;(wrapper.vm as unknown as { cprStep: string }).cprStep = 'aed'; await settle()
        expect(title(), 'aed').toBe(st.aed)
      })
    }
  })

  // -------------------------------------------------------------------------
  // 5) ★ 动态拼 key 的显式枚举（静态扫描器抓不到 `t(\`...${x}\`)`）
  // -------------------------------------------------------------------------
  it('★ 动态拼 key 显式枚举：pressLabel.{idle,hint,reset} + toast.reason.* 两侧都可解析', async () => {
    const keys = [
      'rescue.cpr.pressLabel.idle',
      'rescue.cpr.pressLabel.hint',
      'rescue.cpr.pressLabel.reset',
      'rescue.toast.reason.responded',
      'rescue.toast.reason.breathing',
    ]
    for (const loc of ['zh-CN', 'en-US'] as const) {
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
})

// ---------------------------------------------------------------------------
// 6) ★ 裸 CJK 源码守卫：剥离注释后，rescue/index.vue 不得残留中文字面量
//    （这是"中文都抽齐了"的唯一守卫；静态扫描只证明"抽走的都对"）
// ---------------------------------------------------------------------------

/**
 * 剥离 HTML / 块 / 行注释。行注释仅在 `//` 前是空白或行首时剥离，避免误伤字符串里的 `//`。
 *
 * ⚠️ **已知理论边界**（当前代码无此形态 ⇒ 非现网问题，如需改动此正则请留意）：
 * 若某个**字符串字面量内部**含「空格 + `//` + 中文」（如 `const x = 'a // 中文'`），
 * 该行会被误剥成空 ⇒ 可能造成**假阴性**（漏报一个真实的中文字面量）。如需彻底排除，
 * 得换成真正的词法扫描；当前收益不值这个复杂度，故保留此简单实现并在此标注。
 */
function stripComments(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n')
}

describe('源码守卫：rescue/index.vue 无裸中文字面量', () => {
  const REL = 'src/pages/rescue/index.vue'

  it('★ 扫描器自检：注释里的中文被忽略、字面量里的中文被抓住', () => {
    expect(hasCjk(stripComments("// 中文注释\n/* 块注释中文 */\n<!-- 模板中文 -->\nconst a = 'ok'"))).toBe(false)
    expect(hasCjk(stripComments("const a = '中文'"))).toBe(true)
  })

  it('★ 剥离注释后不含任何中文字面量（抽漏 = 红）', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), REL), 'utf8')
    const offenders = stripComments(src)
      .split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter((x) => hasCjk(x.line))
    expect(offenders.map((o) => `${o.n}: ${o.line}`), '发现未抽取的中文字面量').toEqual([])
  })
})
