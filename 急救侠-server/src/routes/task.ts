import { Router } from 'express'
import db from '../db'
import { success, error, RescueTask } from '../types'

export const taskRouter = Router()

taskRouter.get('/active', (_req, res) => {
  try {
    const row = db.prepare("SELECT * FROM tasks WHERE status = 'active' LIMIT 1").get() as any
    if (!row) return res.json(success(null, '无活跃任务'))
    const task: RescueTask = {
      id: row.id, type: row.type, address: row.address,
      distance: row.distance, lat: row.lat, lng: row.lng,
      volunteersNeeded: row.volunteers_needed,
      volunteersResponded: row.volunteers_responded,
      status: row.status, createdAt: row.created_at,
    }
    res.json(success(task))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

taskRouter.get('/list', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as any[]
    const tasks: RescueTask[] = rows.map(row => ({
      id: row.id, type: row.type, address: row.address,
      distance: row.distance, lat: row.lat, lng: row.lng,
      volunteersNeeded: row.volunteers_needed,
      volunteersResponded: row.volunteers_responded,
      status: row.status, createdAt: row.created_at,
    }))
    res.json(success(tasks))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

taskRouter.post('/accept', (req, res) => {
  try {
    const { taskId } = req.body
    db.prepare("UPDATE tasks SET status = 'active', volunteers_responded = volunteers_responded + 1 WHERE id = ?").run(taskId)
    res.json(success(null, '任务已接受'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

taskRouter.post('/complete', (req, res) => {
  try {
    const { taskId } = req.body
    db.prepare("UPDATE tasks SET status = 'completed' WHERE id = ?").run(taskId)
    res.json(success(null, '任务已完成'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
