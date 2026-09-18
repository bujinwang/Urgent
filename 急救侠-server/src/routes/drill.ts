import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error } from '../types'
import { authMiddleware, identityOf } from '../middleware/auth'
import type { DrillEventRow, DrillOrganizerRow } from '../types/rows'

export const drillRouter = Router()

/**
 * 平台管理员判定：`users.is_platform_admin`（迁移 036 引入，口径同 `routes/admin.ts:19-26`）。
 * ⚠️ 队伍队长 `is_leader` 属**队伍角色**，不得据此行使平台级权限。
 */
function isPlatformAdmin(userId: string): boolean {
  if (!userId) return false
  const row = get<{ is_platform_admin: number }>(
    'SELECT is_platform_admin FROM users WHERE id = ?', userId
  )
  return !!row?.is_platform_admin
}

// ★ P0-1：`organizerId` 不再取自 body（可伪造 ⇒ 冒名他人创建演习）。
drillRouter.post('/events', authMiddleware, (req, res) => {
  try {
    const organizerId = identityOf(req)
    if (!organizerId) return res.status(401).json(error('未登录'))
    const { title, description, scenario, date, location, lat, lng, maxParticipants, organizerName } = req.body
    if (!title) return res.json(error('参数不完整'))
    // ★ 提权写 `UPDATE users SET is_organizer = 1`：`organizerId` 现已恒为调用者本人
    // ⇒ 该写操作**只可能作用于自己**（"限定只对自己生效"），无法再冒名给他人提权。
    db.prepare("UPDATE users SET is_organizer = 1 WHERE id = ? AND is_organizer = 0").run(organizerId)
    const eid = 'dr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    db.prepare('INSERT INTO drill_events (id,title,description,scenario,date,location,lat,lng,max_participants,organizer_id,organizer_name,points_reward) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(eid, title, description || '', scenario || 'cpr', date, location || '', lat || 0, lng || 0, maxParticipants || 15, organizerId, organizerName || '', 50)
    res.json(success({ id: eid }, '演习已创建'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

drillRouter.get('/events', (_req, res) => {
  try {
    const rows = all<DrillEventRow>('SELECT * FROM drill_events ORDER BY date ASC LIMIT 20')
    res.json(success(rows.map((r: DrillEventRow) => ({ id: r.id, title: r.title, description: r.description, scenario: r.scenario, date: r.date, location: r.location, maxParticipants: r.max_participants, currentParticipants: r.current_participants, organizerId: r.organizer_id, organizerName: r.organizer_name, status: r.status, pointsReward: r.points_reward }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-1：`userId` 不再取自 body（可伪造 ⇒ 替他人报名）。
drillRouter.post('/events/:id/join', authMiddleware, (req, res) => {
  try {
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { userName } = req.body
    db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('dp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), req.params.id, userId, userName || '')
    db.prepare('UPDATE drill_events SET current_participants = current_participants + 1 WHERE id = ?').run(req.params.id)
    res.json(success(null, '已报名'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

drillRouter.put('/events/:id/complete', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    const ev = get<DrillEventRow>('SELECT * FROM drill_events WHERE id=?', req.params.id)
    if (!ev) return res.json(error('演习不存在'))
    // ★ P0-1：本端点会写 training_records + 参与者 `points + 20` + `attended = 1`
    // （权益发放）。此前**任意用户**可对自己报名的任意演习完结 ⇒ 刷积分/训练记录。
    // 现限定为**该演习组织者本人**或**平台管理员**。
    if (ev.organizer_id !== callerId && !isPlatformAdmin(callerId)) {
      return res.status(403).json(error('无权结束该演习，仅组织者或平台管理员可执行'))
    }
    db.prepare("UPDATE drill_events SET status='completed' WHERE id=?").run(req.params.id)
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(ev.points_reward, ev.organizer_id)
    db.prepare('UPDATE users SET is_organizer = 1 WHERE id = ?').run(ev.organizer_id)
    const parts = all<{ user_id: string }>('SELECT user_id FROM drill_participants WHERE event_id=?', req.params.id)
    for (const p of parts) {
      db.prepare('UPDATE users SET points = points + 20 WHERE id = ?').run(p.user_id)
      db.prepare('UPDATE drill_participants SET attended = 1 WHERE event_id=? AND user_id=?').run(req.params.id, p.user_id)
      // Create training record (NOT a certification — certs only from coaches/orgs)
      db.prepare('INSERT INTO training_records (id, user_id, user_name, scenario, date, organizer_id, organizer_name, drill_id, notes) VALUES (?,?,?,?,?,?,?,?,?)').run('tr_' + Date.now() + '_' + p.user_id, p.user_id, '', ev.scenario, ev.date, ev.organizer_id, ev.organizer_name, ev.id, ev.title)
    }
    res.json(success({ organizerPoints: ev.points_reward, participantPoints: 20, totalParticipants: parts.length }, '演习已完成，积分已发放，训练记录已保存'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

drillRouter.get('/organizers', (_req, res) => {
  try {
    const rows = all<DrillOrganizerRow>("SELECT u.id,u.name,u.avatar,u.tier,u.points,(SELECT COUNT(*) FROM drill_events WHERE organizer_id=u.id AND status='completed') as drills_completed FROM users u WHERE u.is_organizer=1 ORDER BY drills_completed DESC")
    res.json(success(rows.map((r: DrillOrganizerRow) => ({ id: r.id, name: r.name, avatar: r.avatar, tier: r.tier, points: r.points, drillsCompleted: r.drills_completed }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
