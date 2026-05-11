import { describe, it, expect, vi } from 'vitest'

// Mock Web Audio API
const mockAudioContext = {
  state: 'running',
  currentTime: 0,
  destination: {},
  createOscillator: vi.fn(() => ({
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    type: '',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  })),
  resume: vi.fn(() => Promise.resolve()),
}

Object.defineProperty(window, 'AudioContext', { value: vi.fn(() => mockAudioContext), writable: true })

import { initAudio, playClick, playAlertSound } from '@/utils/audio'

describe('Audio Utils', () => {
  it('initAudio creates audio context', () => {
    expect(() => initAudio()).not.toThrow()
  })

  it('playClick does not throw', () => {
    expect(() => playClick()).not.toThrow()
  })

  it('playAlertSound does not throw', () => {
    expect(() => playAlertSound()).not.toThrow()
  })
})
