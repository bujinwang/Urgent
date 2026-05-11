import { Router } from 'express'
import db from '../db'
import { success, error, VolunteerRank } from '../types'

export const volunteerRouter = Router()

volunteerRouter.get('/rankings', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM volunteers ORDER BY rank_pos ASC').all() as any[]
    const rankings: VolunteerRank[] = rows.map(row => ({
      id: row.id, name: row.name, avatar: row.avatar, tier: row.tier,
      points: row.points, rescueCount: row.rescue_count,
      city: row.city, rank: row.rank_pos,
    }))
    res.json(success(rankings))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
