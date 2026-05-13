import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const drillRouter = Router()

drillRouter.post('/events', (req, res) => {
  try {
    const { title, description, scenario, date, location, lat, lng, maxParticipants, organizerId, organizerName } = req.body
    if (!title || !organizerId) return res.json(error('参数不完整'))
    db.prepare("UPDATE users SET is_organizer = 1 WHERE id = ? AND is_organizer = 0").run(organizerId)
    const eid = 'dr_' + Date.now()
    db.prepare('INSERT INTO drill_events (id,title,description,scenario,date,location,lat,lng,max_participants,organizer_id,organizer_name,points_reward) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(eid, title, description || '', scenario || 'cpr', date, location || '', lat || 0, lng || 0, maxParticipants || 15, organizerId, organizerName || '', 50)
    res.json(success({ id: eid }, '演习已创建'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

drillRouter.get('/events', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM drill_events ORDER BY date ASC LIMIT 20').all() as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, title: r.title, description: r.description, scenario: r.scenario, date: r.date, location: r.location, maxParticipants: r.max_participants, currentParticipants: r.current_participants, organizerId: r.organizer_id, organizerName: r.organizer_name, status: r.status, pointsReward: r.points_reward }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

drillRouter.post('/events/:id/join', (req, res) => {
  try {
    const { userId, userName } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    db.prepare('INSERT OR IGNORE INTO drill_participants (id, event_id, user_id, user_name) VALUES (?,?,?,?)').run('dp_' + Date.now(), req.params.id, userId, userName || '')
    db.prepare('UPDATE drill_events SET current_participants = current_participants + 1 WHERE id = ?').run(req.params.id)
    res.json(success(null, '已报名'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

drillRouter.put('/events/:id/complete', (req, res) => {
  try {
    const ev = db.prepare('SELECT * FROM drill_events WHERE id=?').get(req.params.id) as any
    if (!ev) return res.json(error('演习不存在'))
    db.prepare("UPDATE drill_events SET status='completed' WHERE id=?").run(req.params.id)
    db.prepare('UPDATE users SET points = points + ? WHERE id = ?').run(ev.points_reward, ev.organizer_id)
    db.prepare('UPDATE users SET is_organizer = 1 WHERE id = ?').run(ev.organizer_id)
    const parts = db.prepare('SELECT user_id FROM drill_participants WHERE event_id=?').all(req.params.id) as any[]
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
    const rows = db.prepare("SELECT u.id,u.name,u.avatar,u.tier,u.points,(SELECT COUNT(*) FROM drill_events WHERE organizer_id=u.id AND status='completed') as drills_completed FROM users u WHERE u.is_organizer=1 ORDER BY drills_completed DESC").all() as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, name: r.name, avatar: r.avatar, tier: r.tier, points: r.points, drillsCompleted: r.drills_completed }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
