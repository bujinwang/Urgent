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

// --- uni-app 跨端表单事件类型 -------------------------------------------------
// 微信小程序等平台把输入值放在 `event.detail.value`，
// H5 平台把输入值放在 `event.target.value`。
// 在环境的 DOM 事件类型上补充这两种形态，使 <input>/<textarea> 的
// @input / @change 内联处理函数在任意平台都能通过类型检查（无需逐页 as any）。
interface EventTarget {
  value?: string
}
interface Event {
  detail?: { value?: string }
}

// Ensure tsx files can import Vue SFCs
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
