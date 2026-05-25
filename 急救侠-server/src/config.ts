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
