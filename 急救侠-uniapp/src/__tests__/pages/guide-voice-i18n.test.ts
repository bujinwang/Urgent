import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

/**
 * F2 P0-2（设计 §4，任务项 ④）—— `pages/guide` 语音**调用点**守护。
 *
 * 只做一件事：`voice.command(...)` 必须把**当前 locale** 作为 `lang` 传下去
 * （文案抽 key 属 P0-4，本次不动）。
 */

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

import GuidePage from '@/pages/guide/index.vue'
import { setLocale } from '@/i18n'

describe('guide 页：语音播报透传当前语言', () => {
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    setActivePinia(createPinia())
    captured.commands.length = 0
    setLocale('zh-CN')
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    setLocale('zh-CN')
    wrapper?.unmount()
    wrapper = null
  })

  /** 点「下一步 →」，推进动画/播报定时器，拿回被捕获的 command 调用。 */
  async function goNext() {
    wrapper = mount(GuidePage)
    await wrapper.find('.nav-btn.next').trigger('click')
    await vi.advanceTimersByTimeAsync(700) // nextStep 的 200ms + 播报的 300ms
    await nextTick()
  }

  it('★ zh-CN ⇒ 播报 lang=zh-CN', async () => {
    await goNext()
    expect(captured.commands.length).toBeGreaterThan(0)
    expect(captured.commands.every(c => c.lang === 'zh-CN')).toBe(true)
  })

  it('★ en-US ⇒ 播报 lang=en-US', async () => {
    setLocale('en-US')
    await goNext()
    expect(captured.commands.length).toBeGreaterThan(0)
    expect(captured.commands.every(c => c.lang === 'en-US')).toBe(true)
  })
})
