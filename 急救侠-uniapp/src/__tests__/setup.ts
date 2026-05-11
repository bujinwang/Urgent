import { vi } from 'vitest'

// Mock SpeechSynthesisUtterance (not in happy-dom)
class MockSpeechSynthesisUtterance {
  text: string = ''
  voice: any = null
  lang: string = 'zh-CN'
  rate: number = 1
  pitch: number = 1
  volume: number = 1
  onend: (() => void) | null = null
  constructor(text?: string) { if (text) this.text = text }
}
;(global as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance

// Mock uni-app global
const uniMock = {
  getStorageSync: vi.fn((key: string) => {
    const store: Record<string, string> = {
      jwt_token: 'mock-token-123',
      user_profile: JSON.stringify({ id: 'user_001', name: '陆远' }),
    }
    return store[key] || ''
  }),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
  showModal: vi.fn(),
  navigateTo: vi.fn(),
  switchTab: vi.fn(),
  navigateBack: vi.fn(),
  request: vi.fn(),
  getLocation: vi.fn((opts: any) => {
    if (opts?.success) {
      opts.success({ latitude: 22.517, longitude: 113.947, accuracy: 10 })
    }
  }),
  chooseLocation: vi.fn((opts: any) => {
    if (opts?.success) {
      opts.success({ latitude: 22.517, longitude: 113.947, name: 'test', address: 'test addr' })
    }
  }),
  makePhoneCall: vi.fn(),
  vibrateShort: vi.fn(),
}

;(global as any).uni = uniMock
;(global as any).getCurrentPages = vi.fn(() => [{ options: {} }])

// Mock @dcloudio/uni-app
vi.mock('@dcloudio/uni-app', () => ({
  onLaunch: vi.fn(),
  onShow: vi.fn(),
  onHide: vi.fn(),
  onUnmounted: vi.fn(),
}))

// Mock API index
vi.mock('@/api/index', () => ({
  request: vi.fn(() => Promise.resolve(null)),
  default: vi.fn(() => Promise.resolve(null)),
}))
