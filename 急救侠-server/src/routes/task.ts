import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, RescueTask } from '../types'
import type { TaskRow } from '../types/rows'
import { optionalAuth } from '../middleware/auth'
import { genId, closeServiceForUser, arriveParticipation, abandonParticipation, rejoinParticipation } from '../services/serviceLog'

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
 * ★ v1.4：本端点语义为 **upsert**（§11.11-①）——
 * ① 无本人行 ⇒ `INSERT OR IGNORE` 建 `responded` 行（保持现状）⇒ `attributed:true`；
 * ② 命中本人 `status='voided'` 的行 ⇒ **重新激活**（「放弃后反悔、重新参与」）⇒ `rejoined:true`；
 * ③ 命中 `responded`/`arrived`/`left` ⇒ 两者皆 `false`（幂等 / `left` 终局）。
 * 反悔**复用本端点**（不新增 `/task/rejoin`），前端「接受·立即出发」按钮即入口（§11.11-⑦）。
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
    let rejoined = false
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

      // ★ v1.4 反悔：未新建（已存在本人行）时，若是 `voided` 则重新激活（§11.11-①）。
      // 重置清单（**含清空 arrived_at_ms**）在 `rejoinParticipation()` 内，勿在此重复实现。
      if (!attributed) {
        rejoined = rejoinParticipation({ taskId, userId: uid, respondedMs: Date.now() })
      }
    }

    res.json(success({ attributed, rejoined }, '任务已接受'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/**
 * `POST /api/task/arrive` —— 记「**到达现场**」（★ v1.2，= 时长起点；§11.4）。
 *
 * 鉴权：`optionalAuth`；游客 ⇒ no-op、返 200（Q1 约束，非缺陷）。
 * 幂等（T27）：`arrived_at_ms IS NULL` 守卫 ⇒ 重复上报**不覆盖起点**。
 * 只作用于**本人**行（绝不 task-wide）。
 */
taskRouter.post('/arrive', optionalAuth, (req, res) => {
  try {
    const { taskId } = req.body
    const uid = (req as any).auth?.userId || (req as any).auth?.openid
    const arrived = uid ? arriveParticipation({ taskId, userId: uid, arrivedMs: Date.now() }) : false
    res.json(success({ arrived }, '已到达'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/**
 * `POST /api/task/complete` —— 记「**离开现场**」（★ v1.2 = 时长终点；§11.4）。
 *
 * 鉴权：`optionalAuth`；游客 ⇒ no-op、返 200（Q1）。
 * **按人闭合**（`user_id`）：只闭合本人「已到达且未闭合」的行 —— 修掉 v1.0 的 task-wide 连带缺陷
 * （堵「搭便车」，T29）。**未到场**（`arrived_at_ms IS NULL`）⇒ no-op、不写台账（T26）。
 * 幂等（T31）：`ended_at_ms IS NULL` 守卫 ⇒ 重复调用影响 0 行。
 *
 * `tasks.status='completed'` 仅在**本人真正闭合**（`closed > 0`）时更新（v1.2「保守」口径，§11.4）——
 * 不再由「某人离开」隐式关闭他人参与行。
 */
taskRouter.post('/complete', optionalAuth, (req, res) => {
  try {
    const { taskId } = req.body
    const uid = (req as any).auth?.userId || (req as any).auth?.openid
    const result = uid
      ? closeServiceForUser({ taskId, userId: uid, endedMs: Date.now() })
      : { closed: 0, minutes: 0 }
    if (result.closed > 0) {
      db.prepare("UPDATE tasks SET status = 'completed' WHERE id = ?").run(taskId)
    }
    res.json(success({ closed: result.closed, minutes: result.minutes }, '任务已完成'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/**
 * `POST /api/task/abandon` —— 记「**放弃 / 中途退出**」（★ v1.2，§11.4）。
 *
 * 鉴权：`optionalAuth`；游客 ⇒ no-op、返 200（Q1）。
 * ⚠️ ★ v1.4（T40）：本端点**绝不**改 `tasks.status`（尤其**不得**置 `completed`）——
 * 任务须保持 `active`，否则 `mission/index` 不再展示它，**「放弃后反悔」的入口就消失了**。
 * `abandon` 只动本人参与行，**不写台账**（这是「`(task,user)` 至多一条台账」的前提，§11.11-⑥）。
 */
taskRouter.post('/abandon', optionalAuth, (req, res) => {
  try {
    const { taskId, reason } = req.body
    const uid = (req as any).auth?.userId || (req as any).auth?.openid
    const voided = uid
      ? abandonParticipation({ taskId, userId: uid, reason: typeof reason === 'string' ? reason : undefined })
      : false
    res.json(success({ voided }, '已放弃'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
