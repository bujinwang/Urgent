import { vi } from 'vitest'

// Mock SpeechSynthesisUtterance
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

// Mock uni-app global with proper lifecycle hook execution
const lifecycleHooks: Record<string, Array<() => void>> = {}

const uniMock = {
  getStorageSync: vi.fn((key: string) => {
    const store: Record<string, string> = {
      jwt_token: 'mock-token-123',
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
;(global as any).getCurrentPages = vi.fn(() => [{ options: {}, route: 'pages/home/index' }])

// Mock @dcloudio/uni-app — lifecycle hooks must actually run callbacks
vi.mock('@dcloudio/uni-app', () => ({
  onLaunch: vi.fn((cb: () => void) => { cb() }),
  onShow: vi.fn((cb: () => void) => { cb() }),
  onHide: vi.fn((cb: () => void) => { cb() }),
  onMounted: vi.fn(),
  onUnmounted: vi.fn((cb: () => void) => {
    // Store for cleanup
  }),
  onLoad: vi.fn(),
  onReady: vi.fn(),
}))

// Mock API index
vi.mock('@/api/index', () => ({
  request: vi.fn(() => Promise.resolve(null)),
  default: vi.fn(() => Promise.resolve(null)),
}))
