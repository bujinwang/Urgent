import crypto from 'crypto'

/**
 * 急救侠 共享配置
 *
 * 环境变量在模块加载时一次性捕获，所有模块通过此文件读取。
 */

export const JWT_SECRET = process.env.JWT_SECRET || 'jiujiaxia-dev-secret'
export const WECHAT_APPID = process.env.WECHAT_APPID || ''
export const WECHAT_SECRET = process.env.WECHAT_SECRET || ''
export const DB_PATH = process.env.DB_PATH || './data/jiujiaxia.db'
export const PORT = parseInt(process.env.PORT || '3001', 10)

// ---- 政府数据监管看板（P2-8）----
// 政府访问令牌**必须**使用独立密钥：绝不回落到业务 `JWT_SECRET`
// （否则 gov 令牌可通过业务 authMiddleware 验签 → 违反「互不通用」锁定决策）。
// 未显式配置时生成**进程级随机密钥**，保证与业务密钥不同（重启后 gov 令牌失效，生产请显式配置）。
export const GOV_JWT_SECRET = process.env.GOV_JWT_SECRET || crypto.randomBytes(32).toString('hex')
export const GOV_TOKEN_TTL = process.env.GOV_TOKEN_TTL || '12h'

if (!process.env.GOV_JWT_SECRET && process.env.NODE_ENV !== 'test') {
  console.warn('[config] GOV_JWT_SECRET 未配置，已生成进程级随机密钥（生产环境请显式配置，否则重启将使政府令牌失效）')
}
