import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, RescueRecord } from '../types'
import type { RescueRecordRow } from '../types/rows'

export const recordsRouter = Router()

recordsRouter.get('/list', (_req, res) => {
  try {
    const rows = all<RescueRecordRow>('SELECT * FROM rescue_records ORDER BY date DESC')
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

// GET /api/records/:id — 单条救援记录（结构与列表项一致）
recordsRouter.get('/:id', (req, res) => {
  try {
    const row = get<RescueRecordRow>('SELECT * FROM rescue_records WHERE id = ?', req.params.id)
    if (!row) return res.status(404).json(error('救援记录不存在'))
    const record: RescueRecord = {
      id: row.id, type: row.type, date: row.date,
      location: row.location, role: row.role,
      squad: JSON.parse(row.squad), result: row.result,
    }
    res.json(success(record))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
