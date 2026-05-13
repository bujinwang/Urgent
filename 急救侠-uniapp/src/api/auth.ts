/**
 * 认证 API — 微信登录 + JWT
 */

import { request } from './index'
import type { UserProfile } from './user'

export interface LoginResult {
  token: string
  openid: string
  session_key: string
  user: UserProfile
}

/** 微信登录 — 跨平台 */
export async function wechatLogin(): Promise<LoginResult> {
  // #ifdef MP-WEIXIN
  return new Promise<LoginResult>((resolve, reject) => {
    ;(wx as any).login({
      success: async (loginRes: any) => {
        try {
          const result = await request<LoginResult>({
            url: '/auth/wechat-login',
            method: 'POST',
            data: { code: loginRes.code },
          })
          resolve(result)
        } catch (e) { reject(e) }
      },
      fail: reject,
    })
  })
  // #endif

  // #ifdef H5
  return request<LoginResult>({
    url: '/auth/wechat-login',
    method: 'POST',
    data: { code: 'dev_code_' + Date.now() },
  })
  // #endif

  // #ifdef APP-PLUS
  return new Promise<LoginResult>((resolve, reject) => {
    ;(plus as any).oauth.getServices((services: any[]) => {
      const wechat = services.find((s: any) => s.id === 'weixin')
      if (!wechat) return reject(new Error('未安装微信'))
      wechat.authorize((e: any) => {
        if (e.code) {
          request<LoginResult>({
            url: '/auth/wechat-login',
            method: 'POST',
            data: { code: e.code },
          }).then(resolve).catch(reject)
        } else {
          reject(new Error('微信授权失败'))
        }
      }, { scope: 'snsapi_userinfo' })
    })
  })
  // #endif
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  return request({ url: '/auth/me' })
}

/** 手机号注册 */
export async function phoneRegister(phone: string, password: string, name?: string, interests?: string, affiliation?: string, isLeader?: boolean): Promise<LoginResult> {
  return request({ url: '/auth/register', method: 'POST', data: { phone, password, name, interests, affiliation, isLeader } })
}

/** 手机号登录 */
export async function phoneLogin(phone: string, password: string): Promise<LoginResult> {
  return request({ url: '/auth/login', method: 'POST', data: { phone, password } })
}
