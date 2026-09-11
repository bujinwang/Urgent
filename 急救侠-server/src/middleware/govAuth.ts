/**
 * 政府看板鉴权 — 独立白名单 + 独立令牌声明（P2-8）
 *
 * 与业务 `authMiddleware`（openid/userId）**互不通用**：
 * - 业务 token 无 `gov:true` 声明 → `verifyGovToken` 抛错 → 401；
 * - 政府 token 也不进入业务鉴权链路。
 * 每次请求回查 `gov_viewers.active`，停用即时生效。
 */

import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { get } from '../db'
import { error } from '../types'
import { GOV_JWT_SECRET, GOV_TOKEN_TTL } from '../config'
import type { GovViewerRow } from '../types/rows'

export interface GovTokenPayload {
  gov: true
  govViewerId: string
  name: string
}

export interface GovContext {
  viewerId: string
  name: string
  orgName: string
  scopeAll: boolean
  districts: string[]
}

/** 解析 scope_districts JSON（对非法输入健壮）。 */
export function parseDistricts(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/** 签发政府访问令牌（含 `gov:true` 声明）。 */
export function signGovToken(payload: { govViewerId: string; name: string }): string {
  return jwt.sign({ gov: true, govViewerId: payload.govViewerId, name: payload.name }, GOV_JWT_SECRET, {
    expiresIn: GOV_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  })
}

/** 校验政府令牌；非政府令牌（无 gov:true）一律抛错。 */
export function verifyGovToken(token: string): GovTokenPayload {
  const decoded: unknown = jwt.verify(token, GOV_JWT_SECRET)
  if (typeof decoded !== 'object' || decoded === null) throw new Error('非政府访问令牌')
  const p = decoded as { gov?: unknown; govViewerId?: unknown; name?: unknown }
  if (p.gov !== true || typeof p.govViewerId !== 'string') throw new Error('非政府访问令牌')
  return { gov: true, govViewerId: p.govViewerId, name: typeof p.name === 'string' ? p.name : '' }
}

/** 密码哈希：复用统一口令工具（scrypt，`s1$salt$hash`；兼容历史 `salt:hash`）。 */
export { hashPassword, verifyPassword } from '../services/password'

/** 政府接口守卫：校验 `gov:true` 令牌 + 回查 active 白名单，注入 `req.gov`。 */
export function govMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json(error('未登录'))

  let payload: GovTokenPayload
  try {
    payload = verifyGovToken(auth.slice(7))
  } catch {
    return res.status(401).json(error('令牌无效或已过期'))
  }

  const viewer = get<GovViewerRow>('SELECT * FROM gov_viewers WHERE id = ? AND active = 1', payload.govViewerId)
  if (!viewer) return res.status(403).json(error('政府账号未授权或已停用'))

  const ctx: GovContext = {
    viewerId: viewer.id,
    name: viewer.name,
    orgName: viewer.org_name,
    scopeAll: viewer.scope_all === 1,
    districts: parseDistricts(viewer.scope_districts),
  }
  ;(req as { gov?: GovContext }).gov = ctx
  next()
}

/** 读取注入的政府上下文。 */
export function govContextOf(req: Request): GovContext | undefined {
  return (req as { gov?: GovContext }).gov
}
