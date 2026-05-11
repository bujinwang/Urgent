import { Router } from 'express'
import db from '../db'
import { success, error, UserProfile, Stats } from '../types'

export const userRouter = Router()

userRouter.get('/profile', (_req, res) => {
  try {
    const row = db.prepare('SELECT * FROM users LIMIT 1').get() as any
    if (!row) return res.json(error('用户不存在'))
    const user: UserProfile = {
      id: row.id, name: row.name, avatar: row.avatar,
      tier: row.tier, points: row.points, city: row.city,
      volunteerId: row.volunteer_id,
      certifications: JSON.parse(row.certifications),
      rescueCount: row.rescue_count,
    }
    res.json(success(user))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

userRouter.get('/stats', (_req, res) => {
  try {
    const row = db.prepare('SELECT * FROM stats WHERE id = 1').get() as any
    if (!row) return res.json(error('统计数据不存在'))
    const stats: Stats = {
      certifiedRescuers: row.certified_rescuers,
      networkedAeds: row.networked_aeds,
      monthlyRescues: row.monthly_rescues,
      onlineVolunteers: row.online_volunteers,
      aedsWithin1km: row.aeds_within_1km,
    }
    res.json(success(stats))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

userRouter.post('/points', (req, res) => {
  try {
    const { amount, reason } = req.body
    const row = db.prepare('SELECT * FROM users LIMIT 1').get() as any
    if (!row) return res.json(error('用户不存在'))
    const newPoints = row.points + (amount || 0)
    let newTier = row.tier
    if (newPoints >= 5000) newTier = 'diamond'
    else if (newPoints >= 2500) newTier = 'gold'
    else if (newPoints >= 1000) newTier = 'silver'
    db.prepare('UPDATE users SET points = ?, tier = ? WHERE id = ?').run(newPoints, newTier, row.id)
    res.json(success({ points: newPoints, tier: newTier, reason }, '积分更新成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
