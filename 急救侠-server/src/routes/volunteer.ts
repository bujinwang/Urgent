import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, VolunteerRank, CoachSummary, CoachDetail } from '../types'
import type { VolunteerRow } from '../types/rows'

export const volunteerRouter = Router()

volunteerRouter.get('/rankings', (req, res) => {
  try {
    // type: points（默认，按积分降序） | rescue（按救援次数降序）
    // 注意：只新增 type 维度；既有 rank 字段语义保持为 `rank_pos`，另增 `position` 表示所选维度位次。
    const type = (req.query.type as string) === 'rescue' ? 'rescue' : 'points'
    const orderBy = type === 'rescue'
      ? 'rescue_count DESC, points DESC'
      : 'points DESC, rescue_count DESC'
    const rows = all<VolunteerRow>(`SELECT * FROM volunteers ORDER BY ${orderBy}`)
    const rankings: VolunteerRank[] = rows.map((row, i) => ({
      id: row.id, name: row.name, avatar: row.avatar, tier: row.tier,
      points: row.points, rescueCount: row.rescue_count,
      city: row.city, rank: row.rank_pos,
      position: i + 1,
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
