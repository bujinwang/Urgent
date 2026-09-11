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
// 政府访问令牌独立密钥（未配置则回落业务密钥）；与业务 token 通过 `gov:true` 声明隔离
export const GOV_JWT_SECRET = process.env.GOV_JWT_SECRET || JWT_SECRET
export const GOV_TOKEN_TTL = process.env.GOV_TOKEN_TTL || '12h'
