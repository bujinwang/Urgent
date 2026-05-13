import { Router } from 'express'
import db from '../db'
import { success, error, VolunteerRank, CoachSummary, CoachDetail } from '../types'

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

// GET /volunteer/coaches — list all CPR/Emergency coaches
volunteerRouter.get('/coaches', (_req, res) => {
  try {
    const rows = db.prepare(
      "SELECT * FROM volunteers WHERE role = 'coach' ORDER BY rescue_count DESC"
    ).all() as any[]
    const coaches: CoachSummary[] = rows.map(row => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      tier: row.tier,
      city: row.city,
      specialties: JSON.parse(row.coach_specialties || '[]'),
      rescueCount: row.rescue_count,
      traineeCount: row.points, // reuse points as trainee count for now
      available: row.coach_available === 1,
    }))
    res.json(success(coaches))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /volunteer/coaches/:id — coach detail
volunteerRouter.get('/coaches/:id', (req, res) => {
  try {
    const row = db.prepare(
      "SELECT * FROM volunteers WHERE id = ? AND role = 'coach'"
    ).get(req.params.id) as any
    if (!row) return res.json(error('教练不存在'))
    const coach: CoachDetail = {
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      tier: row.tier,
      city: row.city,
      specialties: JSON.parse(row.coach_specialties || '[]'),
      rescueCount: row.rescue_count,
      traineeCount: row.points,
      available: row.coach_available === 1,
      certifications: JSON.parse(row.coach_certifications || '[]'),
      bio: row.coach_bio || '',
      points: row.points,
    }
    res.json(success(coach))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
