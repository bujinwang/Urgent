import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, RescueTask } from '../types'
import type { TaskRow } from '../types/rows'
import { optionalAuth } from '../middleware/auth'
import { genId, closeService } from '../services/serviceLog'

export const taskRouter = Router()

taskRouter.get('/active', (_req, res) => {
  try {
    const row = get<TaskRow>("SELECT * FROM tasks WHERE status = 'active' LIMIT 1")
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
    const rows = all<TaskRow>('SELECT * FROM tasks ORDER BY created_at DESC')
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

/**
 * `POST /api/task/accept` —— 接受救援任务并**归因留痕**（F4 P0-2，§5.1 时序）。
 *
 * 鉴权：`optionalAuth`（§10-Q1）。**游客（无 token）不产生参与行、不产生台账行，仍返回 200**
 * —— 这是约束的结果、不是缺陷（不登录就没有 `user_id`，物理上无法归因），**不得**改成 401。
 *
 * 身份**只从 token 派生**（硬约束 #1）：绝不读 `req.body.userId`（否则可把参与记到他人名下）。
 *
 * ⚠️ `volunteers_responded = volunteers_responded + 1` 的**既有非幂等行为保持不变**（§10-Q2）。
 * 该计数器重复 accept 会反复 +1，**不是可靠真值** —— 可靠真值由 `task_volunteers` 提供。
 */
taskRouter.post('/accept', optionalAuth, (req, res) => {
  try {
    const { taskId } = req.body
    const uid = (req as any).auth?.userId || (req as any).auth?.openid

    // 既有行为：置 active 并自增计数器（保留，非幂等，见上）。
    db.prepare("UPDATE tasks SET status = 'active', volunteers_responded = volunteers_responded + 1 WHERE id = ?").run(taskId)

    let attributed = false
    if (uid) {
      // 幂等靠 UNIQUE(task_id, user_id) + INSERT OR IGNORE（硬约束 #4）。
      // 用 `SELECT ... WHERE EXISTS(tasks)` 守卫：任务不存在时不写（避免 FK 违约抛 500，
      // 保持既有「未知 taskId 仍返回 200」的行为）。
      const info = db.prepare(
        `INSERT OR IGNORE INTO task_volunteers (id, task_id, user_id, responded_at_ms, status)
         SELECT ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM tasks WHERE id = ?)`
      ).run(genId('tv'), taskId, uid, Date.now(), 'responded', taskId)
      attributed = info.changes === 1
    }

    res.json(success({ attributed }, '任务已接受'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/**
 * `POST /api/task/complete` —— 完成任务、闭合参与行、写入服务时长台账（§5.1 时序）。
 *
 * 鉴权：`optionalAuth`（§10-Q1）；游客不产生任何记录，仍返回 200。
 *
 * 幂等（T18）：闭合由 `closeService()` 的 `ended_at_ms IS NULL` 守卫 + `idx_vsl_dedup`
 * 双重保证 ⇒ 重复调用影响 0 行、`ended_at_ms` 不被覆盖、时长**不重复累加**。
 */
taskRouter.post('/complete', optionalAuth, (req, res) => {
  try {
    const { taskId } = req.body
    db.prepare("UPDATE tasks SET status = 'completed' WHERE id = ?").run(taskId)
    const { closed, minutes } = closeService({ taskId, endedMs: Date.now() })
    res.json(success({ closed, minutes }, '任务已完成'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
