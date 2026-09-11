import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, AuthRegisterInput, AuthLoginInput, AuthChangePasswordInput, AuthResetPasswordInput } from '../types'
import { signToken, exchangeWechatCode, authMiddleware } from '../middleware/auth'
import type { AuthPayload } from '../middleware/auth'
import { hashPassword, verifyPassword, isHashed } from '../services/password'
import { validate } from '../middleware/validate'
import type { UserRow, UserLoginProfileRow } from '../types/rows'

export const authRouter = Router()

/**
 * 校验口令并**兼容存量明文**：命中明文时**透明升级**为哈希（安全收敛 A）。
 *
 * @returns 是否通过认证；通过且原为明文时，库中口令已被替换为哈希。
 */
function verifyAndUpgrade(userId: string, stored: string, plain: string): boolean {
  if (!stored) return true // 历史无口令账号：保持既有「放行」行为，不改变语义
  if (isHashed(stored)) return verifyPassword(plain, stored)
  // 存量明文：按明文比较，匹配则透明升级
  if (stored !== plain) return false
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(plain), userId)
  return true
}

/** 微信登录 */
authRouter.post('/wechat-login', async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.json(error('缺少 code 参数'))

    const { openid, session_key } = await exchangeWechatCode(code)

    // Find or create user by openid
    let user: UserLoginProfileRow | undefined = get<UserLoginProfileRow>('SELECT * FROM users WHERE id = ?', openid)
    if (!user) {
      const newUser: UserLoginProfileRow = {
        name: '急救侠' + openid.slice(-4),
        avatar: '侠',
        tier: 'bronze',
        points: 0,
        city: '',
        volunteer_id: 'XX-' + openid.slice(0, 4).toUpperCase(),
        certifications: '[]',
        rescue_count: 0,
      }
      db.prepare(`INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        openid, newUser.name, newUser.avatar, newUser.tier,
        newUser.points, newUser.city, newUser.volunteer_id,
        newUser.certifications, newUser.rescue_count
      )
      user = newUser
    }

    const token = signToken({ openid, userId: openid })

    res.json(success({
      token,
      openid,
      session_key,
      user: {
        id: openid,
        name: user.name,
        avatar: user.avatar,
        tier: user.tier,
        points: user.points,
        city: user.city,
        volunteerId: user.volunteer_id,
        certifications: JSON.parse(user.certifications || '[]'),
        rescueCount: user.rescue_count,
      },
    }, '登录成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/** 手机号注册 */
authRouter.post('/register', validate(AuthRegisterInput), (req, res) => {
  try {
    const { phone, password, name } = req.body
    if (!phone || !password) return res.json(error('手机号和密码不能为空'))
    const existing = get<{ id: string }>('SELECT id FROM users WHERE id = ?', 'u_' + phone)
    if (existing) return res.json(error('该手机号已注册'))
    const id = 'u_' + phone
    const { interests, affiliation, isLeader } = req.body as { interests?: string, affiliation?: string, isLeader?: boolean }
    const volunteerType = interests || 'medical'
    const isBsm = affiliation === '蓝天救援队'
    const tier = isBsm ? 'silver' : 'bronze'
    const points = isBsm ? 500 : 0
    const rescueCount = isBsm ? 3 : 0
    const certs = isBsm ? '["CPR / AED","Basic Life Support","野外急救"]' : '[]'
    db.prepare('INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count, public_id, is_leader, affiliation, volunteer_type, is_organizer, is_public, password) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      id, name || '急救侠' + phone.slice(-4), (name || '侠').charAt(0), tier, points, '', 'PH-' + phone.slice(0,4),
      certs, rescueCount, 'PU' + phone.slice(-6), isLeader ? 1 : 0, affiliation || '', volunteerType, 0, 0, hashPassword(password)
    )
    // 签发真实 JWT（此前为明文 'token_<phone>_<ts>'，无法通过 authMiddleware）
    const token = signToken({ userId: id })
    const user = get<UserRow>('SELECT * FROM users WHERE id = ?', id)!
    res.json(success({ token, user: { id: user.id, name: user.name, avatar: user.avatar, tier: user.tier, points: user.points, city: user.city, volunteerId: user.volunteer_id, certifications: JSON.parse(user.certifications||'[]'), rescueCount: user.rescue_count, volunteer_type: user.volunteer_type, affiliation: user.affiliation, isLeader: user.is_leader === 1 } }, '注册成功'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/** 手机号登录 */
authRouter.post('/login', validate(AuthLoginInput), (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) return res.json(error('手机号和密码不能为空'))
    const user = get<UserRow>('SELECT * FROM users WHERE id = ?', 'u_' + phone)
    if (!user) return res.json(error('用户不存在，请先注册'))
    if (!verifyAndUpgrade(user.id, user.password || '', password)) return res.json(error('密码错误'))
    // 签发真实 JWT（payload 含 userId），使 authMiddleware / callerOf 等下游可用
    const token = signToken({ userId: user.id })
    res.json(success({ token, user: { id: user.id, name: user.name, avatar: user.avatar, tier: user.tier, points: user.points, city: user.city, volunteerId: user.volunteer_id, certifications: JSON.parse(user.certifications||'[]'), rescueCount: user.rescue_count, volunteer_type: user.volunteer_type } }, '登录成功'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/**
 * 修改密码（需登录）
 * 身份**只取自令牌**（`req.auth.userId`）；`phone` 仅作一致性校验，不再作为身份来源
 * （此前直接信任客户端 `phone` → 可改任意用户密码）。
 */
authRouter.post('/change-password', authMiddleware, validate(AuthChangePasswordInput), (req, res) => {
  try {
    const a = (req as { auth?: AuthPayload }).auth
    const userId = a && (a.userId || a.openid)
    if (!userId) return res.status(401).json(error('未登录'))

    const { phone, oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) return res.json(error('参数不完整'))
    if (newPassword.length < 2) return res.json(error('新密码太短'))
    // phone 传入时须与令牌身份一致；不一致即拒绝（不再信任客户端 phone）
    if (phone && 'u_' + phone !== userId) {
      return res.status(403).json(error('无权修改他人密码'))
    }

    const user = get<UserRow>('SELECT * FROM users WHERE id = ?', userId)
    if (!user) return res.json(error('用户不存在'))
    if (!verifyAndUpgrade(userId, user.password || '', oldPassword)) return res.json(error('旧密码错误'))
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), userId)
    res.json(success(null, '密码已修改'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/** 重置密码（通过手机号） */
authRouter.post('/reset-password', validate(AuthResetPasswordInput), (req, res) => {
  try {
    const { phone, newPassword } = req.body
    if (!phone || !newPassword) return res.json(error('参数不完整'))
    const user = get<{ id: string }>('SELECT id FROM users WHERE id = ?', 'u_' + phone)
    if (!user) return res.json(error('该手机号未注册'))
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), 'u_' + phone)
    res.json(success(null, '密码已重置'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/** 获取当前用户信息 */
authRouter.get('/me', authMiddleware, (req, res) => {
  try {
    const a = (req as { auth?: AuthPayload }).auth
    const userId = a && (a.userId || a.openid)
    if (!userId) return res.status(401).json(error('未登录'))
    const user = get<UserRow>('SELECT * FROM users WHERE id = ?', userId)
    if (!user) return res.json(error('用户不存在'))
    res.json(success({
      id: user.id, name: user.name, avatar: user.avatar,
      tier: user.tier, points: user.points, city: user.city,
      volunteerId: user.volunteer_id,
      certifications: JSON.parse(user.certifications || '[]'),
      rescueCount: user.rescue_count,
    }))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
