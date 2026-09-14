import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

/**
 * F2 P0-2 —— 急救主链路「语音本地化」的**调用点**守护（设计 §4 / §5）。
 *
 * 为什么单独从界面走流程测（而不是只测 `voice.ts` 单测）：
 * - 本仓库血泪教训（playbook §3）：模块级单测覆盖不了「页面是否真的把 lang 传下去了」。
 * - 本文件 mock `@/utils/voice` 以**捕获页面实际发出的每次合成请求**（文本 + lang），
 *   真实驱动 `.sos-button → .confirm-check → .confirm-btn → 步骤推进 → 按压循环`。
 *
 * 覆盖 PRD §5 的 KPI「语音语言一致」：
 *   en-US 下 `wordForCpr` 输出**不含中文字符**；zh-CN 下与改造前**逐字一致**。
 */

// 捕获页面发出的合成请求（跨 hoist 共享）。
const captured = vi.hoisted(() => ({
  speaks: [] as Array<{ text: string; lang?: string }>,
  counts: [] as Array<{ text: string; lang?: string }>,
}))

vi.mock('@/utils/voice', () => ({
  DEFAULT_VOICE_LANG: 'zh-CN',
  VoiceManager: class {},
  voice: {
    speak: vi.fn((text: string, opts?: { lang?: string }) => { captured.speaks.push({ text, lang: opts?.lang }) }),
    count: vi.fn((text: string, lang?: string) => { captured.counts.push({ text, lang }) }),
    command: vi.fn(),
    guide: vi.fn(),
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
import { setLocale } from '@/i18n'

const hasChinese = (s: string) => /[\u4e00-\u9fa5]/.test(s)

/** 打开确认弹层、勾选、启动 CPR 到第 1 步。 */
async function startCpr(wrapper: ReturnType<typeof mount>) {
  await wrapper.find('.sos-button').trigger('click')      // showConfirm()
  await wrapper.find('.confirm-check').trigger('click')   // confirmed = true
  await wrapper.find('.confirm-btn').trigger('click')     // startCpr() → stage='cpr', cprStep=1
  await nextTick()
}

/** 推进到第 3 步（判断呼吸），并让 watch 的 `setTimeout(50)` 落地（触发 startBreathCount）。 */
async function reachStep3(wrapper: ReturnType<typeof mount>) {
  await startCpr(wrapper)
  await wrapper.find('.step-btn-primary').trigger('click')          // 1 → 2（"已喊人 · 立即开始"）
  await nextTick()
  ;(wrapper.findComponent(StepTimer).vm as unknown as { $emit: (e: string) => void }).$emit('done') // 2 → 3
  await nextTick()
  await vi.advanceTimersByTimeAsync(60)                             // watch 的 setTimeout(50) → startBreathCount()
  await nextTick()
}

/** 推进到第 4 步（胸外按压）并跑出按压循环的首拍。 */
async function reachStep4(wrapper: ReturnType<typeof mount>) {
  await reachStep3(wrapper)
  ;(wrapper.findComponent(StepTimer).vm as unknown as { $emit: (e: string) => void }).$emit('done') // 3 → 4
  await nextTick()
  await vi.advanceTimersByTimeAsync(60)                            // watch 的 setTimeout(50) → startPress()
  await nextTick()
}

/** 推进 `n` 个按压节拍（每拍 545ms）。 */
async function advancePresses(n: number) {
  await vi.advanceTimersByTimeAsync(545 * n)
  await nextTick()
}

describe('rescue 页：语音本地化调用点（默认 zh-CN）', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    captured.speaks.length = 0
    captured.counts.length = 0
    setLocale('zh-CN')
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    setLocale('zh-CN')
    wrapper?.unmount()
    wrapper = null
  })

  it('★ zh-CN：按压 1..10 念中文数字，>10 回落 String(n)，且每次都带 lang=zh-CN', async () => {
    const page = await import('@/pages/rescue/index.vue')
    wrapper = mount(page.default)
    await reachStep4(wrapper)
    await advancePresses(10) // 覆盖到第 11 拍（>10 的回落分支）

    const texts = captured.speaks.map(s => s.text)
    expect(texts).toEqual(['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '11'])
    expect(captured.speaks.every(s => s.lang === 'zh-CN')).toBe(true)
  })

  it('★ zh-CN：人工呼吸起手念"一零零一"（lang=zh-CN）', async () => {
    const page = await import('@/pages/rescue/index.vue')
    wrapper = mount(page.default)
    await reachStep3(wrapper)

    expect(captured.counts[0]).toEqual({ text: '一零零一', lang: 'zh-CN' })
  })

  it('★ en-US：按压词**不含任何中文字符**，且每次都带 lang=en-US', async () => {
    setLocale('en-US')
    const page = await import('@/pages/rescue/index.vue')
    wrapper = mount(page.default)
    await reachStep4(wrapper)
    await advancePresses(10)

    const texts = captured.speaks.map(s => s.text)
    expect(texts).toEqual(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', '11'])
    expect(texts.some(hasChinese)).toBe(false)
    expect(captured.speaks.every(s => s.lang === 'en-US')).toBe(true)
  })

  it('★ en-US：人工呼吸起手念"one zero zero one"，不含中文字符', async () => {
    setLocale('en-US')
    const page = await import('@/pages/rescue/index.vue')
    wrapper = mount(page.default)
    await reachStep3(wrapper)

    expect(captured.counts[0]).toEqual({ text: 'one zero zero one', lang: 'en-US' })
    expect(hasChinese(captured.counts[0].text)).toBe(false)
  })

  it('★ en-US：呼吸计数的数字分支也带 lang=en-US（"1002"，非硬编码 zh）', async () => {
    setLocale('en-US')
    const page = await import('@/pages/rescue/index.vue')
    wrapper = mount(page.default)
    await reachStep3(wrapper)
    await vi.advanceTimersByTimeAsync(1000) // 呼吸计时器第 1 跳 ⇒ count('1002')
    await nextTick()

    expect(captured.counts[1]).toEqual({ text: '1002', lang: 'en-US' })
  })

  it('★ 响应式：运行中切换语言 ⇒ 后续按压词立即改语言（防"顶层取值冻结语言"）', async () => {
    const page = await import('@/pages/rescue/index.vue')
    wrapper = mount(page.default)
    await reachStep4(wrapper)

    expect(captured.speaks[0].text).toBe('一') // 首拍仍是中文

    setLocale('en-US')
    await nextTick()
    await advancePresses(1) // 第二拍

    expect(captured.speaks[1].text).toBe('two')
    expect(captured.speaks[1].lang).toBe('en-US')
    expect(hasChinese(captured.speaks[1].text)).toBe(false)
  })
})
