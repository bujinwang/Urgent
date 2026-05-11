import { Router } from 'express'
import db from '../db'
import { success, error, RescueCase } from '../types'

export const casesRouter = Router()

casesRouter.get('/list', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM rescue_cases ORDER BY date DESC').all() as any[]
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
    const row = db.prepare('SELECT * FROM rescue_cases WHERE id = ?').get(req.params.id) as any
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
