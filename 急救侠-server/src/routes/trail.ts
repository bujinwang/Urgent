import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const trailRouter = Router()

trailRouter.get('/hikers', (_req, res) => {
  try {
    const rows = db.prepare('SELECT ut.*, u.tier, u.avatar, u.city, u.rescue_count FROM user_trails ut JOIN users u ON u.id=ut.user_id ORDER BY ut.total_distance DESC').all() as any[]
    res.json(success(rows.map((r: any) => ({ userId: r.user_id, userName: r.user_name, avatar: r.avatar, tier: r.tier, city: r.city, totalDistance: r.total_distance, totalElevation: r.total_elevation, hikesCompleted: r.hikes_completed, longestHike: r.longest_hike, lastHikeDate: r.last_hike_date, badge: r.badge, rescueCount: r.rescue_count }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

trailRouter.get('/experience/:userId', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM user_trails WHERE user_id=?').get(req.params.userId) as any
    if (!row) return res.json(success({ totalDistance: 0, totalElevation: 0, hikesCompleted: 0, longestHike: 0, badge: '' }))
    res.json(success({ userId: row.user_id, userName: row.user_name, totalDistance: row.total_distance, totalElevation: row.total_elevation, hikesCompleted: row.hikes_completed, longestHike: row.longest_hike, lastHikeDate: row.last_hike_date, badge: row.badge }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

trailRouter.post('/experience', (req, res) => {
  try {
    const { userId, userName, distance, elevation, date } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    const d = parseFloat(distance) || 0; const e = parseFloat(elevation) || 0
    const ex = db.prepare('SELECT * FROM user_trails WHERE user_id=?').get(userId) as any
    let badge = ''; const td = (ex?.total_distance || 0) + d; const te = (ex?.total_elevation || 0) + e
    if (td >= 500) badge = '🏔️ 雪山行者'; else if (td >= 200) badge = '⛰️ 山野达人'; else if (td >= 50) badge = '🥾 徒步爱好者'
    if (ex) db.prepare('UPDATE user_trails SET total_distance=?,total_elevation=?,hikes_completed=hikes_completed+1,last_hike_date=?,longest_hike=MAX(longest_hike,?),badge=? WHERE user_id=?').run(td, te, date || '', d, badge, userId)
    else db.prepare('INSERT INTO user_trails (id,user_id,user_name,total_distance,total_elevation,hikes_completed,last_hike_date,longest_hike,badge) VALUES (?,?,?,?,?,?,?,?,?)').run('ut_' + userId, userId, userName || '', d, e, 1, date || '', d, badge)
    res.json(success(null, '已保存'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

trailRouter.get('/events', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM trail_events ORDER BY date ASC LIMIT 20').all() as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, title: r.title, description: r.description, route: r.route, distance: r.distance, elevation: r.elevation, difficulty: r.difficulty, date: r.date, meetingPoint: r.meeting_point, maxParticipants: r.max_participants, currentParticipants: r.current_participants, organizerId: r.organizer_id, organizerName: r.organizer_name, status: r.status }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

trailRouter.post('/events', (req, res) => {
  try {
    const { title, description, route, distance, elevation, difficulty, date, meetingPoint, lat, lng, maxParticipants, organizerId, organizerName } = req.body
    if (!title || !organizerId) return res.json(error('参数不完整'))
    const eid = 'te_' + Date.now()
    db.prepare('INSERT INTO trail_events (id,title,description,route,distance,elevation,difficulty,date,meeting_point,lat,lng,max_participants,organizer_id,organizer_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(eid, title, description || '', route || '', distance || 0, elevation || 0, difficulty || 'moderate', date, meetingPoint || '', lat || 0, lng || 0, maxParticipants || 20, organizerId, organizerName || '')
    res.json(success({ id: eid }, '已创建'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

trailRouter.post('/events/:id/join', (req, res) => {
  try {
    const { userId, userName } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    db.prepare('INSERT OR IGNORE INTO trail_event_participants (id,event_id,user_id,user_name) VALUES (?,?,?,?)').run('tp_' + Date.now(), req.params.id, userId, userName || '')
    db.prepare('UPDATE trail_events SET current_participants=current_participants+1 WHERE id=?').run(req.params.id)
    res.json(success(null, '已报名'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

trailRouter.put('/events/:id/complete', (req, res) => {
  try {
    const ev = db.prepare('SELECT organizer_id FROM trail_events WHERE id=?').get(req.params.id) as any
    if (!ev) return res.json(error('活动不存在'))
    db.prepare("UPDATE trail_events SET status='completed' WHERE id=?").run(req.params.id)
    db.prepare('UPDATE users SET is_organizer = 1 WHERE id = ?').run(ev.organizer_id)
    db.prepare('UPDATE users SET points = points + 30 WHERE id = ?').run(ev.organizer_id)
    res.json(success(null, '已完成，组织者已升级'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
