import { Router } from 'express'
import db from '../db'
import { success, error, RescueRecord } from '../types'

export const recordsRouter = Router()

recordsRouter.get('/list', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM rescue_records ORDER BY date DESC').all() as any[]
    const records: RescueRecord[] = rows.map(row => ({
      id: row.id, type: row.type, date: row.date,
      location: row.location, role: row.role,
      squad: JSON.parse(row.squad), result: row.result,
    }))
    res.json(success(records))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
