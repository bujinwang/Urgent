import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'jiujiaxia-dev-secret'
const WECHAT_APPID = process.env.WECHAT_APPID || ''
const WECHAT_SECRET = process.env.WECHAT_SECRET || ''

export interface AuthPayload {
  openid: string
  userId?: string
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
      (req as any).auth = verifyToken(auth.slice(7))
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
  const data = await res.json()
  if (data.errcode) {
    throw new Error(`微信登录失败: ${data.errmsg} (${data.errcode})`)
  }
  return { openid: data.openid, session_key: data.session_key }
}
