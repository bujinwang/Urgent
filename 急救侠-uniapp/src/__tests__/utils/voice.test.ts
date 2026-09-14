import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock speechSynthesis
const mockSpeechSynthesis = {
  paused: false,
  speaking: false,
  pending: false,
  getVoices: vi.fn(() => [
    { name: 'Tingting', lang: 'zh-CN', default: true, localService: true, voiceURI: 'Tingting' }
  ]),
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  onvoiceschanged: null as any,
}

Object.defineProperty(window, 'speechSynthesis', { value: mockSpeechSynthesis, writable: true })

import { voice, VoiceManager } from '@/utils/voice'

describe('VoiceManager', () => {
  beforeEach(() => {
    mockSpeechSynthesis.getVoices.mockReturnValue([
      { name: 'Tingting', lang: 'zh-CN', default: true, localService: true, voiceURI: 'Tingting' }
    ])
    mockSpeechSynthesis.speak.mockClear()
    mockSpeechSynthesis.cancel.mockClear()
  })

  it('speak calls speechSynthesis', () => {
    voice.speak('测试语音')
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled()
  })

  it('stop calls cancel', () => {
    voice.stop()
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled()
  })

  it('command delegates to speak', () => {
    voice.command('紧急任务')
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled()
  })

  it('guide delegates to speak', () => {
    voice.guide('请按压')
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled()
  })

  it('comfort delegates to speak', () => {
    voice.comfort('放松')
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled()
  })

  it('count speaks number', () => {
    voice.count('1001')
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled()
  })

  it('speakSequence handles phrases', () => {
    voice.speakSequence(['第一句', '第二句'])
    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(2)
  })

  it('speakSequence handles empty array', () => {
    let called = false
    voice.speakSequence([], () => { called = true })
    expect(called).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// F2 语音本地化（设计 §4.1）—— lang 显式参数 + 按语言选音色 + 标点规整 + 缓存隔离
//
// 核心契约：语言是**每次调用的显式参数**，默认 'zh-CN'。
// 默认值的唯一作用 = 让范围外页面（home / mission/*，它们不传 lang 且仍是中文文案）行为逐字不变。
// 为此本组测试**全部用 `new VoiceManager()` 独立实例**，避免单例缓存跨用例串味。
// ---------------------------------------------------------------------------

/** 造一个语音对象（happy-dom 无真实 `SpeechSynthesisVoice` 构造器）。 */
function fakeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, default: false, localService: true, voiceURI: name } as unknown as SpeechSynthesisVoice
}

/** 取最近一次 `speak` 的 utterance。 */
function lastUtterance(): SpeechSynthesisUtterance {
  const calls = mockSpeechSynthesis.speak.mock.calls
  return calls[calls.length - 1][0] as SpeechSynthesisUtterance
}

describe('F2 语音本地化：lang 显式参数', () => {
  const ZH = fakeVoice('Tingting', 'zh-CN')
  const EN = fakeVoice('Samantha', 'en-US')
  // 顺序刻意「中文在前」：若实现里用单一缓存/匹配器，会暴露串语言问题。
  const MIXED = [ZH, fakeVoice('Microsoft Xiaoxiao', 'zh-CN'), EN]

  beforeEach(() => {
    mockSpeechSynthesis.getVoices.mockReturnValue(MIXED)
    mockSpeechSynthesis.speak.mockClear()
    mockSpeechSynthesis.cancel.mockClear()
  })

  it('★ 不传 lang ⇒ u.lang === "zh-CN"（守护范围外页面行为不变）', () => {
    const m = new VoiceManager()
    m.speak('测试语音')
    expect(lastUtterance().lang).toBe('zh-CN')
  })

  it('★ 不传 lang 时选到的也必须是中文音色（不是恰好第一个）', () => {
    const m = new VoiceManager()
    m.speak('测试语音')
    expect((lastUtterance().voice as SpeechSynthesisVoice).lang).toBe('zh-CN')
  })

  it('传 lang: "en-US" ⇒ u.lang === "en-US"', () => {
    const m = new VoiceManager()
    m.speak('test', { lang: 'en-US' })
    expect(lastUtterance().lang).toBe('en-US')
  })

  it('★ pickVoice 按语言选：en-US 下不得选到中文音色', () => {
    const m = new VoiceManager()
    m.speak('test', { lang: 'en-US' })
    const chosen = lastUtterance().voice as SpeechSynthesisVoice
    expect(chosen.lang).toBe('en-US')
    expect(chosen.name).toBe('Samantha')
  })

  it('zh-CN 保持改造前的匹配器顺序（Tingting / 婷婷优先）', () => {
    const m = new VoiceManager()
    m.speak('测试语音')
    expect((lastUtterance().voice as SpeechSynthesisVoice).name).toBe('Tingting')
  })

  it('★ en-US 无可用英文音色 ⇒ 兜底首个（不崩、不抛）', () => {
    mockSpeechSynthesis.getVoices.mockReturnValue([ZH])
    const m = new VoiceManager()
    expect(() => m.speak('test', { lang: 'en-US' })).not.toThrow()
    expect((lastUtterance().voice as SpeechSynthesisVoice).name).toBe('Tingting')
  })

  it('★ 音色缓存按语言隔离（隐藏雷）：先 zh 再 en 拿到不同音色，且各自缓存命中', () => {
    const m = new VoiceManager()
    m.speak('中文', { lang: 'zh-CN' })
    const zhVoice = lastUtterance().voice
    m.speak('english', { lang: 'en-US' })
    const enVoice = lastUtterance().voice

    expect((zhVoice as SpeechSynthesisVoice).lang).toBe('zh-CN')
    expect((enVoice as SpeechSynthesisVoice).lang).toBe('en-US')
    expect(zhVoice).not.toBe(enVoice)

    // 切回 zh ⇒ 必须复用同一个中文音色**对象**（证明按语言缓存命中，而非每次重选）
    m.speak('中文2', { lang: 'zh-CN' })
    expect(lastUtterance().voice).toBe(zhVoice)
  })

  it('★ 缓存隔离是双向的：先 en 再 zh 也不串', () => {
    const m = new VoiceManager()
    m.speak('english', { lang: 'en-US' })
    const enVoice = lastUtterance().voice
    m.speak('中文', { lang: 'zh-CN' })
    const zhVoice = lastUtterance().voice
    expect((enVoice as SpeechSynthesisVoice).lang).toBe('en-US')
    expect((zhVoice as SpeechSynthesisVoice).lang).toBe('zh-CN')
    expect(enVoice).not.toBe(zhVoice)
  })

  it('★ 标点：zh 把 "!" 规整为 "，"；en 保留 "!"', () => {
    const m = new VoiceManager()
    m.speak('立即开始!', { lang: 'zh-CN' })
    expect(lastUtterance().text).toBe('立即开始，')
    m.speak('Start now!', { lang: 'en-US' })
    expect(lastUtterance().text).toBe('Start now!')
  })

  it('AED / CPR 规整在两种语言下都保留（读字母两种语言都对）', () => {
    const m = new VoiceManager()
    m.speak('A E D ready', { lang: 'en-US' })
    expect(lastUtterance().text).toBe('AED ready')
    m.speak('C P R 开始', { lang: 'zh-CN' })
    expect(lastUtterance().text).toBe('CPR 开始')
  })

  it('★ count 同样按语言：不传 ⇒ zh-CN；传 en ⇒ en-US', () => {
    const m = new VoiceManager()
    m.count('一零零一')
    expect(lastUtterance().lang).toBe('zh-CN')
    m.count('one zero zero one', 'en-US')
    expect(lastUtterance().lang).toBe('en-US')
  })

  it('★ command / guide / comfort 透传 lang（不传 ⇒ zh-CN）', () => {
    const m = new VoiceManager()
    m.command('x', 'en-US'); expect(lastUtterance().lang).toBe('en-US')
    m.guide('x', 'en-US'); expect(lastUtterance().lang).toBe('en-US')
    m.comfort('x', 'en-US'); expect(lastUtterance().lang).toBe('en-US')
    m.command('x'); expect(lastUtterance().lang).toBe('zh-CN')
  })

  it('★ speakSequence 把 lang 透传到每一次 speak', () => {
    const m = new VoiceManager()
    m.speakSequence(['one', { text: 'two', rate: 1.5 }], undefined, 'en-US')
    const langs = mockSpeechSynthesis.speak.mock.calls.map(c => (c[0] as SpeechSynthesisUtterance).lang)
    expect(langs).toEqual(['en-US', 'en-US'])
  })

  it('★ speakSequence 不传 lang ⇒ 全部 zh-CN（范围外调用方不变）', () => {
    const m = new VoiceManager()
    m.speakSequence(['第一句', '第二句'])
    const langs = mockSpeechSynthesis.speak.mock.calls.map(c => (c[0] as SpeechSynthesisUtterance).lang)
    expect(langs).toEqual(['zh-CN', 'zh-CN'])
  })
})
