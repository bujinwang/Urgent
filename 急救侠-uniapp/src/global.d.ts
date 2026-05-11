// Global type declarations for uni-app cross-platform globals

// WeChat Mini Program
declare const wx: WechatMiniprogram.Wx
declare namespace WechatMiniprogram {
  interface Wx {
    login: (opts: any) => void
    getLocation: (opts: any) => void
    chooseLocation: (opts: any) => void
    requestSubscribeMessage: (opts: any) => void
    createInnerAudioContext: () => InnerAudioContext
    setStorageSync: (key: string, value: any) => void
    getStorageSync: (key: string) => any
    removeStorageSync: (key: string) => void
    showToast: (opts: any) => void
    showModal: (opts: any) => void
    vibrateShort: (opts: any) => void
    navigateTo: (opts: any) => void
  }
  interface InnerAudioContext {
    src: string
    obeyMuteSwitch: boolean
    play: () => void
    stop: () => void
    destroy: () => void
    onError: (cb: (err: any) => void) => void
  }
}

// App Plus (for uni-app native)
declare const plus: any

// Ensure tsx files can import Vue SFCs
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
