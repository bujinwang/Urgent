import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { JWT_SECRET, WECHAT_APPID, WECHAT_SECRET } from '../config'

export interface AuthPayload {
  openid: string
  userId?: string
}

/** 纵深防御：显式识别政府令牌声明（gov token 绝不被业务鉴权接受）。 */
function isGovPayload(payload: unknown): boolean {
  return typeof payload === 'object' && payload !== null && (payload as { gov?: unknown }).gov === true
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload
}

/** Express middleware — attach user to request */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ code: -1, message: '未登录' })
  }
  try {
    const payload = verifyToken(auth.slice(7))
    // 政府令牌（gov:true）不得进入业务鉴权链路
    if (isGovPayload(payload)) {
      return res.status(401).json({ code: -1, message: '令牌无效' })
    }
    ;(req as any).auth = payload
    next()
  } catch {
    return res.status(401).json({ code: -1, message: '登录已过期' })
  }
}

/** Optional auth — attach if token present, don't fail */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(auth.slice(7))
      if (!isGovPayload(payload)) {
        (req as any).auth = payload
      }
    } catch { /* ignore */ }
  }
  next()
}

/** Exchange WeChat code for session (mock when no appid) */
export async function exchangeWechatCode(code: string): Promise<{ openid: string; session_key: string }> {
  // Mock for development without real WeChat app
  if (!WECHAT_APPID || !WECHAT_SECRET) {
    console.log('[Auth] 开发模式：模拟微信登录, code:', code)
    return { openid: 'dev_' + code.slice(0, 8), session_key: 'dev_session_' + Date.now() }
  }

  const res = await fetch(
    `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}&js_code=${code}&grant_type=authorization_code`
  )
  const data: any = await res.json()
  if (data.errcode) {
    throw new Error(`微信登录失败: ${data.errmsg} (${data.errcode})`)
  }
  return { openid: data.openid, session_key: data.session_key }
}
