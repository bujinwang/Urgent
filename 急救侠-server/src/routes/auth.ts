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
