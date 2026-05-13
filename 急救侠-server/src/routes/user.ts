import { Router } from 'express'
import db from '../db'
import { success, error, UserProfile, Stats } from '../types'

export const userRouter = Router()

userRouter.get('/profile', (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    let userId = ''
    if (token.startsWith('token_')) userId = 'u_' + token.split('_')[1]
    const row = userId
      ? (db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any)
      : (db.prepare('SELECT * FROM users LIMIT 1').get() as any)
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

// GET /api/user/org-roles?userId=xxx — check if user is org admin/manager
userRouter.get('/org-roles', (req, res) => {
  try {
    const userId = (req.query.userId as string) || ''
    const rows = db.prepare(`
      SELECT om.org_id, om.role, o.name as org_name, o.type as org_type
      FROM organization_members om
      JOIN organizations o ON o.id = om.org_id
      WHERE om.user_id = ? AND om.role IN ('admin', 'manager')
    `).all(userId) as any[]
    const roles = rows.map(r => ({
      orgId: r.org_id, orgName: r.org_name, orgType: r.org_type, role: r.role,
    }))
    res.json(success(roles))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /api/user/training-records?userId=xxx — training history (not certifications)
userRouter.get('/training-records', (req, res) => {
  try {
    const userId = (req.query.userId as string) || ''
    const rows = db.prepare('SELECT * FROM training_records WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(userId) as any[]
    res.json(success(rows.map((r: any) => ({
      id: r.id, scenario: r.scenario, date: r.date,
      organizerName: r.organizer_name, drillId: r.drill_id, notes: r.notes,
    }))))
  } catch (e: any) { res.status(500).json(error(e.message || '服务器错误')) }
})

// PUT /api/user/interests — update volunteer interests
userRouter.put('/interests', (req, res) => {
  try {
    const { userId, interests } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    db.prepare('UPDATE users SET volunteer_type = ? WHERE id = ?').run((interests || []).join(','), userId)
    res.json(success({ volunteerType: (interests || []).join(',') }, '兴趣已更新'))
  } catch (e: any) { res.status(500).json(error(e.message || '服务器错误')) }
})

// PUT /api/user/privacy — toggle public profile
userRouter.put('/privacy', (req, res) => {
  try {
    const { userId, isPublic } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    db.prepare('UPDATE users SET is_public = ? WHERE id = ?').run(isPublic ? 1 : 0, userId)
    res.json(success({ isPublic: !!isPublic }, isPublic ? '已开启公开档案' : '已关闭公开档案'))
  } catch (e: any) { res.status(500).json(error(e.message || '服务器错误')) }
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
