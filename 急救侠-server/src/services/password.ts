/**
 * 口令哈希工具（安全收敛 A）
 *
 * 使用 Node 内置 `crypto.scrypt`（零新增依赖），`timingSafeEqual` 常量时间比较。
 * 哈希格式带**版本前缀**：`s1$<saltHex>$<hashHex>`
 * —— 版本前缀使「哈希」与「存量明文口令」**无歧义可区分**（见 `isHashed`）。
 */

import crypto from 'crypto'

/** 版本前缀（后续更换算法时可递增为 `s2$`…）。 */
export const HASH_PREFIX = 's1$'
const KEY_LEN = 64
const SALT_BYTES = 16

/** 生成带版本前缀的 scrypt 哈希。 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex')
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString('hex')
  return `${HASH_PREFIX}${salt}$${hash}`
}

/** 是否为本模块生成的版本化哈希（用于区分存量明文口令）。 */
export function isHashed(stored: string): boolean {
  return typeof stored === 'string' && stored.startsWith(HASH_PREFIX)
}

/** 常量时间比较两个 hex 串。 */
function safeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex')
  const b = Buffer.from(bHex, 'hex')
  if (a.length === 0 || a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * 校验口令。支持两种**已哈希**存储格式：
 * - `s1$<salt>$<hash>`：本模块生成；
 * - `<salt>:<hash>`：历史 `govAuth` 的 scrypt 格式（保持行为等价）。
 *
 * 非哈希输入（含存量明文）一律返回 `false` —— 是否按明文比较由调用方决定。
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false

  if (isHashed(stored)) {
    const parts = stored.split('$')
    if (parts.length !== 3) return false
    const salt = parts[1]
    const hash = parts[2]
    if (!salt || !hash) return false
    const candidate = crypto.scryptSync(password, salt, KEY_LEN).toString('hex')
    return safeEqualHex(candidate, hash)
  }

  // 兼容历史 govAuth 的 `salt:hash` scrypt 格式
  const legacy = stored.split(':')
  if (legacy.length === 2 && legacy[0] && legacy[1]) {
    const candidate = crypto.scryptSync(password, legacy[0], KEY_LEN).toString('hex')
    return safeEqualHex(candidate, legacy[1])
  }

  return false
}
