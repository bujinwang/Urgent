/**
 * 平台适配工具
 */

/** 是否为微信小程序环境 */
export const isWechatMP = (() => {
  // #ifdef MP-WEIXIN
  return true
  // #endif
  return false
})()

/** 是否为 H5 环境 */
export const isH5 = (() => {
  // #ifdef H5
  return true
  // #endif
  return false
})()

/** 是否为 App 原生环境 */
export const isAppPlus = (() => {
  // #ifdef APP-PLUS
  return true
  // #endif
  return false
})()

/** 获取平台名称 */
export function getPlatform(): 'h5' | 'mp-weixin' | 'app-plus' | 'unknown' {
  // #ifdef H5
  return 'h5'
  // #endif
  // #ifdef MP-WEIXIN
  return 'mp-weixin'
  // #endif
  // #ifdef APP-PLUS
  return 'app-plus'
  // #endif
  return 'unknown'
}
