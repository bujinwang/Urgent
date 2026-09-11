import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, AuthRegisterInput, AuthLoginInput, AuthChangePasswordInput, AuthResetPasswordInput } from '../types'
import { signToken, exchangeWechatCode, authMiddleware } from '../middleware/auth'
import type { AuthPayload } from '../middleware/auth'
import { hashPassword, verifyPassword, isHashed } from '../services/password'
import { validate } from '../middleware/validate'
import type { UserRow, UserLoginProfileRow } from '../types/rows'

export const authRouter = Router()

/** 口令校验结果。 */
type PasswordCheck = 'ok' | 'no-password' | 'fail'

/**
 * 校验口令并**兼容存量明文**：命中明文时**透明升级**为哈希（安全收敛 A）。
 *
 * - `ok`          通过（若原为明文，库中口令已被替换为哈希）；
 * - `no-password` 账号**未设置口令**（微信/种子账号）——**不是**通过，
 *                 调用方必须显式决定如何处理（登录一律拒绝，见 F2）；
 * - `fail`        口令错误。
 */
function verifyAndUpgrade(userId: string, stored: string, plain: string): PasswordCheck {
  if (!stored) return 'no-password'
  if (isHashed(stored)) return verifyPassword(plain, stored) ? 'ok' : 'fail'
  // 存量明文：按明文比较，匹配则透明升级
  if (stored !== plain) return 'fail'
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(plain), userId)
  return 'ok'
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
    const check = verifyAndUpgrade(user.id, user.password || '', password)
    // F2：未设置口令的账号**不得**用任意口令登录（此前 `if (!stored) return true` 等同放行）
    if (check === 'no-password') return res.json(error('该账号未设置密码，请使用微信登录或联系管理员'))
    if (check !== 'ok') return res.json(error('密码错误'))
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

    const stored = user.password || ''
    if (stored) {
      // 已设置口令：必须校验旧口令
      if (verifyAndUpgrade(userId, stored, oldPassword) !== 'ok') return res.json(error('旧密码错误'))
    }
    // stored 为空 = 账号尚未设置口令（微信/种子账号）：调用方已持本人令牌，
    // 此处按「首次设置口令」处理，不要求旧口令（否则这类账号永远无法设置口令）。
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), userId)
    res.json(success(null, '密码已修改'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/**
 * 重置密码（安全收敛 F1）
 *
 * 此前**完全无鉴权**：知道手机号即可把任意账号的口令改掉（账号接管）。
 * 本项目暂无短信/邮箱验证码通道，因此按「最小可用且安全」口径收敛为：
 * - 必须**已登录**（`authMiddleware`）；
 * - 只能重置**本人**口令；队长（`is_leader = 1`）可重置队员口令。
 *
 * 「忘记密码且未登录」的场景需后续接入验证码通道后再开放匿名自助重置。
 */
authRouter.post('/reset-password', authMiddleware, validate(AuthResetPasswordInput), (req, res) => {
  try {
    const a = (req as { auth?: AuthPayload }).auth
    const callerId = a && (a.userId || a.openid)
    if (!callerId) return res.status(401).json(error('未登录'))

    const { phone, newPassword } = req.body
    if (!phone || !newPassword) return res.json(error('参数不完整'))

    const targetId = 'u_' + phone
    const target = get<{ id: string }>('SELECT id FROM users WHERE id = ?', targetId)
    if (!target) return res.json(error('该手机号未注册'))

    const caller = get<{ is_leader: number }>('SELECT is_leader FROM users WHERE id = ?', callerId)
    const isSelf = targetId === callerId
    const isLeader = caller?.is_leader === 1
    if (!isSelf && !isLeader) return res.status(403).json(error('无权重置他人密码'))

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPassword), targetId)
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
