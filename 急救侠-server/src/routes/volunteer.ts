import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, VolunteerRank, CoachSummary, CoachDetail } from '../types'
import type { VolunteerRow } from '../types/rows'

export const volunteerRouter = Router()

volunteerRouter.get('/rankings', (_req, res) => {
  try {
    const rows = all<VolunteerRow>('SELECT * FROM volunteers ORDER BY rank_pos ASC')
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
    const rows = all<VolunteerRow>(
      "SELECT * FROM volunteers WHERE role = 'coach' ORDER BY rescue_count DESC"
    )
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
    const row = get<VolunteerRow>(
      "SELECT * FROM volunteers WHERE id = ? AND role = 'coach'",
      req.params.id
    )
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
