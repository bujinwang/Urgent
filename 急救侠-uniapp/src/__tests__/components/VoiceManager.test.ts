import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

/**
 * 组件层是**纯转发壳**（lazy `import('@/utils/voice')` + 方法为 async）。
 * 这里 mock 下游 `@/utils/voice`，断言壳子把 `lang` **原样透传**到底层 ——
 * 组件自身的透传逻辑无法被 `utils/voice.ts` 的单测覆盖，故单列。
 */
vi.mock('@/utils/voice', () => ({
  DEFAULT_VOICE_LANG: 'zh-CN',
  VoiceManager: class {},
  voice: {
    speak: vi.fn(),
    command: vi.fn(),
    guide: vi.fn(),
    comfort: vi.fn(),
    count: vi.fn(),
    stop: vi.fn(),
    speakSequence: vi.fn(),
  },
}))

import VoiceManager from '@/components/VoiceManager/index.vue'
import { voice as voiceModule } from '@/utils/voice'

/** 下游 `voice.*`（mock）——用于断言透传参数。 */
const downstream = voiceModule as unknown as Record<string, ReturnType<typeof vi.fn>>

describe('VoiceManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mounts without errors', () => {
    const wrapper = mount(VoiceManager)
    expect(wrapper.exists()).toBe(true)
  })

  it('exposes speak method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).speak).toBe('function')
  })

  it('exposes stop method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).stop).toBe('function')
  })

  it('exposes command method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).command).toBe('function')
  })

  it('exposes guide method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).guide).toBe('function')
  })

  it('exposes comfort method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).comfort).toBe('function')
  })

  it('exposes count method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).count).toBe('function')
  })

  it('exposes speakSequence method', () => {
    const wrapper = mount(VoiceManager)
    expect(typeof (wrapper.vm as any).speakSequence).toBe('function')
  })

  it('renders empty UI', () => {
    const wrapper = mount(VoiceManager)
    expect(wrapper.html()).toContain('display: none')
  })

  // -------------------------------------------------------------------------
  // F2 P0-2：lang 透传（组件是 lazy import + async ⇒ 断言前须 flushPromises）
  // -------------------------------------------------------------------------

  it('★ command / count / speakSequence / speak / guide / comfort 把 lang 原样透传到下游', async () => {
    const wrapper = mount(VoiceManager)
    await flushPromises() // 等 setup 里的预加载 import 落地
    const vm = wrapper.vm as any

    await vm.command('x', 'en-US')
    await vm.count('1', 'en-US')
    await vm.speakSequence(['a', 'b'], undefined, 'en-US')
    await vm.speak('hi', { rate: 1.1, lang: 'en-US' })
    await vm.guide('g', 'en-US')
    await vm.comfort('c', 'en-US')
    await flushPromises()

    expect(downstream.command).toHaveBeenCalledWith('x', 'en-US')
    expect(downstream.count).toHaveBeenCalledWith('1', 'en-US')
    expect(downstream.speakSequence).toHaveBeenCalledWith(['a', 'b'], undefined, 'en-US')
    expect(downstream.speak).toHaveBeenCalledWith('hi', { rate: 1.1, lang: 'en-US' })
    expect(downstream.guide).toHaveBeenCalledWith('g', 'en-US')
    expect(downstream.comfort).toHaveBeenCalledWith('c', 'en-US')
  })

  it('★ 不传 lang ⇒ 下游收到的第 2 参为 undefined（⇒ voice 层回落 zh-CN，范围外行为不变）', async () => {
    const wrapper = mount(VoiceManager)
    await flushPromises()
    const vm = wrapper.vm as any

    await vm.command('x')
    await vm.count('1')
    await flushPromises()

    expect(downstream.command.mock.calls[0][1]).toBeUndefined()
    expect(downstream.count.mock.calls[0][1]).toBeUndefined()
  })
})
