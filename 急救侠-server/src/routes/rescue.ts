import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const rescueRouter = Router()

rescueRouter.post('/certification', (req, res) => {
  try {
    const { userId, type, issuer, certNumber, issueDate, expiryDate, fileUrl } = req.body
    if (!userId || !type) return res.json(error('参数不完整'))
    db.prepare('INSERT INTO external_certifications (id, user_id, type, issuer, cert_number, issue_date, expiry_date, file_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('ec_' + Date.now(), userId, type, issuer || '', certNumber || '', issueDate || '', expiryDate || '', fileUrl || '')
    res.json(success(null, '认证已提交'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.get('/certifications', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM external_certifications WHERE user_id=? ORDER BY created_at DESC').all(req.query.userId as string) as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, type: r.type, issuer: r.issuer, certNumber: r.cert_number, issueDate: r.issue_date, expiryDate: r.expiry_date, fileUrl: r.file_url, status: r.status }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.put('/certification/:id/verify', (req, res) => {
  try { db.prepare("UPDATE external_certifications SET status='verified' WHERE id=?").run(req.params.id); res.json(success(null, '已认证')) } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.post('/mobilize', (req, res) => {
  try {
    const { title, description, type, address, lat, lng, volunteersNeeded, leaderId, leaderName } = req.body
    if (!title || !leaderId) return res.json(error('参数不完整'))
    const leader = db.prepare('SELECT is_leader FROM users WHERE id=?').get(leaderId) as any
    if (!leader || !leader.is_leader) return res.json(error('只有认证救援领导者才能发起动员'))
    const mid = 'mob_' + Date.now()
    db.prepare('INSERT INTO emergency_mobilizations (id, title, description, type, address, lat, lng, volunteers_needed, leader_id, leader_name) VALUES (?,?,?,?,?,?,?,?,?,?)').run(mid, title, description || '', type || 'rescue', address || '', lat || 0, lng || 0, volunteersNeeded || 5, leaderId, leaderName || '')
    res.json(success({ id: mid }, '动员已发起，等待平台审批'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.get('/mobilizations', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM emergency_mobilizations ORDER BY created_at DESC LIMIT 20').all() as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, title: r.title, description: r.description, type: r.type, address: r.address, volunteersNeeded: r.volunteers_needed, volunteersResponded: r.volunteers_responded, leaderId: r.leader_id, leaderName: r.leader_name, status: r.status, approvedBy: r.approved_by, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.put('/mobilizations/:id/approve', (req, res) => {
  try {
    const { approvedBy } = req.body
    const mob = db.prepare('SELECT leader_id FROM emergency_mobilizations WHERE id=?').get(req.params.id) as any
    db.prepare("UPDATE emergency_mobilizations SET status='active', approved_by=?, approved_at=datetime('now') WHERE id=?").run(approvedBy || 'admin', req.params.id)
    if (mob) db.prepare('UPDATE users SET is_organizer = 1 WHERE id = ?').run(mob.leader_id)
    res.json(success(null, '已批准'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.put('/mobilizations/:id/complete', (_req, res) => {
  try { db.prepare("UPDATE emergency_mobilizations SET status='completed' WHERE id=?").run(req.params.id); res.json(success(null, '已结束')) } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.post('/mobilizations/:id/respond', (req, res) => {
  try {
    const { userId, userName } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    db.prepare('INSERT OR IGNORE INTO mobilization_volunteers (id, mobilization_id, user_id, user_name) VALUES (?,?,?,?)').run('mv_' + Date.now(), req.params.id, userId, userName || '')
    db.prepare('UPDATE emergency_mobilizations SET volunteers_responded = volunteers_responded + 1 WHERE id=?').run(req.params.id)
    res.json(success(null, '已响应'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.get('/mobilizations/:id/volunteers', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM mobilization_volunteers WHERE mobilization_id=?').all(req.params.id) as any[]
    res.json(success(rows.map((r: any) => ({ userId: r.user_id, userName: r.user_name, status: r.status, respondedAt: r.responded_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.get('/team', (req, res) => {
  try {
    const leader = db.prepare('SELECT affiliation FROM users WHERE id=? AND is_leader=1').get(req.query.leaderId as string) as any
    if (!leader) return res.json(error('非认证领导者'))
    const rows = db.prepare("SELECT u.id, u.name, u.avatar, u.tier, u.rescue_count, u.city FROM users u WHERE u.affiliation=? ORDER BY u.rescue_count DESC").all(leader.affiliation) as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, name: r.name, avatar: r.avatar, tier: r.tier, rescueCount: r.rescue_count, city: r.city }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/* ──── Task Media (现场实时更新) ──── */

// GET /api/rescue/mobilizations/:taskId/media
rescueRouter.get('/mobilizations/:taskId/media', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM task_media WHERE task_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.taskId) as any[]
    res.json(success(rows.map((r: any) => ({
      id: r.id, taskId: r.task_id,
      userId: r.user_id, userName: r.user_name, userAvatar: r.user_avatar,
      type: r.type, content: r.content, mediaUrl: r.media_url,
      lat: r.lat, lng: r.lng, createdAt: r.created_at,
    }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// POST /api/rescue/mobilizations/:taskId/media
rescueRouter.post('/mobilizations/:taskId/media', (req, res) => {
  try {
    const { userId, userName, userAvatar, type, content, mediaUrl, lat, lng } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    const mid = 'tm_' + Date.now()
    db.prepare('INSERT INTO task_media (id, task_id, user_id, user_name, user_avatar, type, content, media_url, lat, lng) VALUES (?,?,?,?,?,?,?,?,?,?)').run(mid, req.params.taskId, userId, userName||'', userAvatar||'', type||'text', content||'', mediaUrl||'', lat||0, lng||0)
    res.json(success({ id: mid }, '已发布'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
