import { Router } from 'express'
import db from '../db'
import { success, error, CourseItem } from '../types'

export const learnRouter = Router()

learnRouter.get('/courses', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM courses').all() as any[]
    const items: CourseItem[] = rows.map(row => ({
      id: row.id, title: row.title, category: row.category,
      duration: row.duration, completed: !!row.completed,
      progress: row.progress, icon: row.icon,
    }))
    res.json(success(items))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

learnRouter.post('/progress', (req, res) => {
  try {
    const { courseId, progress } = req.body
    const completed = progress >= 1.0 ? 1 : 0
    db.prepare('UPDATE courses SET progress = ?, completed = ? WHERE id = ?').run(progress, completed, courseId)
    res.json(success({ courseId, progress, completed: !!completed }, '进度已更新'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
