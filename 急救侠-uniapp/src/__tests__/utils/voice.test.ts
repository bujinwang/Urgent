import { describe, it, expect, vi } from 'vitest'

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

import { voice } from '@/utils/voice'

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
