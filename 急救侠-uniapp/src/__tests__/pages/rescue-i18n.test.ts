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
      expect(wrapper.find('.rescue-title').text()).toBe('紧急救护')
      expect(wrapper.find('.decision-main').text()).toBe('患者倒地无反应？')

      setLocale('en-US')
      await nextTick()

      expect(wrapper.find('.rescue-title').text()).toBe('Emergency Rescue')
      expect(wrapper.find('.decision-main').text()).toBe('Someone collapsed and unresponsive?')
    })

    it('★ 双向：zh → en → zh 都能生效（防止"只能切一次"）', async () => {
      wrapper = await mountRescue()
      expect(wrapper.find('.decision-main').text()).toBe('患者倒地无反应？')

      setLocale('en-US'); await nextTick()
      expect(wrapper.find('.decision-main').text()).toBe('Someone collapsed and unresponsive?')

      setLocale('zh-CN'); await nextTick()
      expect(wrapper.find('.decision-main').text()).toBe('患者倒地无反应？')
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
      wrapper = await mountRescue()

      // ① 非演习 step1
      await startCpr(wrapper)
      expect(captured.commands[0], 'step1 非演习').toEqual({ text: '系统已调度。现场清空，准备按压。', lang: 'zh-CN' })

      // ② step2
      await wrapper.find('.step-btn-primary').trigger('click'); await settle()
      expect(captured.guides[0], 'step2').toEqual({ text: '拍打患者两侧肩膀，在耳边大声呼喊。观察是否有反应。', lang: 'zh-CN' })

      // ③ step5
      done(wrapper); await settle()  // 2 → 3
      done(wrapper); await settle()  // 3 → 4
      await vi.advanceTimersByTimeAsync(545 * 30); await settle()
      expect(captured.guides[1], 'step5').toEqual({ text: '仰头抬下巴，让气道打开。检查口腔，清除可见异物。捏住鼻子，嘴包嘴密封，吹一口气。', lang: 'zh-CN' })

      // ④ loop
      done(wrapper); await nextTick()
      done(wrapper); await settle()
      expect(captured.commands[1], 'loop').toEqual({ text: '继续三十次按压，加两次人工呼吸。不要停下。', lang: 'zh-CN' })

      // 卸掉上一个实例，避免其定时器污染后续捕获
      wrapper.unmount(); wrapper = null

      // ⑤⑥ AED phase0 / phase1
      const w2 = await mountRescue()
      await reachAed(w2, 0)
      expect(captured.speaks.at(-1), 'aed phase0').toEqual({ text: '所有人离开患者。AED 正在分析心率。', lang: 'zh-CN' })
      ;(w2.vm as unknown as { aedPhase: number }).aedPhase = 1; await settle()
      expect(captured.speaks.at(-1), 'aed phase1').toEqual({ text: '离开。按下电击键。', lang: 'zh-CN' })
      w2.unmount()

      // ⑦ 演习 step1
      useDrillMode()
      const w4 = await mountRescue()
      await startCpr(w4)
      expect(captured.commands.at(-1), 'step1 演习').toEqual({ text: '演习模式。系统已模拟调度。现场清空，准备按压。', lang: 'zh-CN' })
      w4.unmount()
    })

    it('★ en-US：7 条整句逐条为英文且 lang=en-US（不含中文字符）', async () => {
      setLocale('en-US')
      wrapper = await mountRescue()

      await startCpr(wrapper)
      expect(captured.commands[0], 'step1 非演习').toEqual({ text: 'Help is on the way. Clear the area, get ready to compress.', lang: 'en-US' })

      await wrapper.find('.step-btn-primary').trigger('click'); await settle()
      expect(captured.guides[0], 'step2').toEqual({ text: 'Tap both shoulders and shout loudly into their ear. Watch for any response.', lang: 'en-US' })

      done(wrapper); await settle()
      done(wrapper); await settle()
      await vi.advanceTimersByTimeAsync(545 * 30); await settle()
      expect(captured.guides[1], 'step5').toEqual({
        text: 'Tilt the head back and lift the chin to open the airway. Check the mouth and clear any visible obstruction. Pinch the nose, seal your mouth over theirs, and give one breath.',
        lang: 'en-US',
      })

      done(wrapper); await nextTick()
      done(wrapper); await settle()
      expect(captured.commands[1], 'loop').toEqual({ text: 'Keep going — thirty compressions, then two rescue breaths. Do not stop.', lang: 'en-US' })

      // 卸掉上一个实例，避免其定时器污染后续捕获
      wrapper.unmount(); wrapper = null

      const w2 = await mountRescue()
      await reachAed(w2, 0)
      expect(captured.speaks.at(-1), 'aed phase0').toEqual({ text: 'Everyone stand clear. The AED is analyzing the heart rhythm.', lang: 'en-US' })
      ;(w2.vm as unknown as { aedPhase: number }).aedPhase = 1; await settle()
      expect(captured.speaks.at(-1), 'aed phase1').toEqual({ text: 'Stand clear. Press the shock button.', lang: 'en-US' })
      w2.unmount()

      useDrillMode()
      const w4 = await mountRescue()
      await startCpr(w4)
      expect(captured.commands.at(-1), 'step1 演习').toEqual({ text: 'Drill mode. Dispatch simulated. Clear the area, get ready to compress.', lang: 'en-US' })
      w4.unmount()

      // 7 条整句都不得含中文字符
      const all = [...captured.commands, ...captured.guides, ...captured.speaks].map((x) => x.text)
      expect(all.filter(hasCjk)).toEqual([])
    })
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

/** 剥离 HTML / 块 / 行注释。行注释仅在 `//` 前是空白或行首时剥离，避免误伤字符串里的 `//`。 */
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
