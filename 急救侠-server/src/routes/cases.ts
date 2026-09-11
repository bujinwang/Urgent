import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, RescueCase } from '../types'
import type { RescueCaseRow } from '../types/rows'

export const casesRouter = Router()

casesRouter.get('/list', (_req, res) => {
  try {
    const rows = all<RescueCaseRow>('SELECT * FROM rescue_cases ORDER BY date DESC')
    const rc: RescueCase[] = rows.map(row => ({
      id: row.id, title: row.title, summary: row.summary,
      date: row.date, location: row.location, result: row.result,
      volunteers: JSON.parse(row.volunteers), body: row.body,
    }))
    res.json(success(rc))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

casesRouter.get('/:id', (req, res) => {
  try {
    const row = get<RescueCaseRow>('SELECT * FROM rescue_cases WHERE id = ?', req.params.id)
    if (!row) return res.json(error('案例不存在'))
    const c: RescueCase = {
      id: row.id, title: row.title, summary: row.summary,
      date: row.date, location: row.location, result: row.result,
      volunteers: JSON.parse(row.volunteers), body: row.body,
    }
    res.json(success(c))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
