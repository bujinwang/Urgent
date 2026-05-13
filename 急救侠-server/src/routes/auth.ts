import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'
import { signToken, exchangeWechatCode, authMiddleware } from '../middleware/auth'

export const authRouter = Router()

/** 微信登录 */
authRouter.post('/wechat-login', async (req, res) => {
  try {
    const { code } = req.body
    if (!code) return res.json(error('缺少 code 参数'))

    const { openid, session_key } = await exchangeWechatCode(code)

    // Find or create user by openid
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(openid) as any
    if (!user) {
      const newUser = {
        id: openid,
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
        newUser.id, newUser.name, newUser.avatar, newUser.tier,
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
authRouter.post('/register', (req, res) => {
  try {
    const { phone, password, name } = req.body
    if (!phone || !password) return res.json(error('手机号和密码不能为空'))
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get('u_' + phone) as any
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
      certs, rescueCount, 'PU' + phone.slice(-6), isLeader ? 1 : 0, affiliation || '', volunteerType, 0, 0, password
    )
    const token = 'token_' + phone + '_' + Date.now()
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any
    res.json(success({ token, user: { id: user.id, name: user.name, avatar: user.avatar, tier: user.tier, points: user.points, city: user.city, volunteerId: user.volunteer_id, certifications: JSON.parse(user.certifications||'[]'), rescueCount: user.rescue_count, volunteer_type: user.volunteer_type, affiliation: user.affiliation, isLeader: user.is_leader === 1 } }, '注册成功'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/** 手机号登录 */
authRouter.post('/login', (req, res) => {
  try {
    const { phone, password } = req.body
    if (!phone || !password) return res.json(error('手机号和密码不能为空'))
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('u_' + phone) as any
    if (!user) return res.json(error('用户不存在，请先注册'))
    if (user.password && user.password !== password) return res.json(error('密码错误'))
    const token = 'token_' + phone + '_' + Date.now()
    res.json(success({ token, user: { id: user.id, name: user.name, avatar: user.avatar, tier: user.tier, points: user.points, city: user.city, volunteerId: user.volunteer_id, certifications: JSON.parse(user.certifications||'[]'), rescueCount: user.rescue_count, volunteer_type: user.volunteer_type } }, '登录成功'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/** 修改密码 */
authRouter.post('/change-password', (req, res) => {
  try {
    const { phone, oldPassword, newPassword } = req.body
    if (!phone || !oldPassword || !newPassword) return res.json(error('参数不完整'))
    if (newPassword.length < 2) return res.json(error('新密码太短'))
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('u_' + phone) as any
    if (!user) return res.json(error('用户不存在'))
    if (user.password && user.password !== oldPassword) return res.json(error('旧密码错误'))
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, 'u_' + phone)
    res.json(success(null, '密码已修改'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/** 重置密码（通过手机号） */
authRouter.post('/reset-password', (req, res) => {
  try {
    const { phone, newPassword } = req.body
    if (!phone || !newPassword) return res.json(error('参数不完整'))
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get('u_' + phone) as any
    if (!user) return res.json(error('该手机号未注册'))
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, 'u_' + phone)
    res.json(success(null, '密码已重置'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/** 获取当前用户信息 */
authRouter.get('/me', authMiddleware, (_req, res) => {
  try {
    const auth = (_req as any).auth
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(auth.openid) as any
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
