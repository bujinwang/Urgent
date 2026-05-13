import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const wildlifeRouter = Router()

wildlifeRouter.post('/report', (req, res) => {
  try {
    const { userId, userName, category, species, description, lat, lng, location, photos } = req.body
    if (!userId || !species) return res.json(error('参数不完整'))
    const cat = category || 'wildlife'
    if (cat === 'wildlife') {
      const user = db.prepare("SELECT volunteer_type FROM users WHERE id=? AND volunteer_type LIKE '%wildlife%'").get(userId) as any
      if (!user) return res.json(error('仅选择野生动物救援的用户可上报'))
    }
    db.prepare('INSERT INTO wildlife_reports (id,user_id,user_name,category,species,description,lat,lng,location,photos) VALUES (?,?,?,?,?,?,?,?,?,?)').run('wr_'+Date.now(), userId, userName||'', cat, species, description||'', lat||0, lng||0, location||'', photos||'')
    res.json(success(null, '已上报'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

wildlifeRouter.get('/reports', (req, res) => {
  try {
    const cat = req.query.category as string
    let sql = 'SELECT * FROM wildlife_reports'
    const params: any[] = []
    if (cat) { sql += ' WHERE category=?'; params.push(cat) }
    sql += ' ORDER BY created_at DESC LIMIT 30'
    const rows = db.prepare(sql).all(...params) as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, userId: r.user_id, userName: r.user_name, category: r.category, species: r.species, description: r.description, lat: r.lat, lng: r.lng, location: r.location, photos: r.photos, status: r.status, assignedTo: r.assigned_to, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

wildlifeRouter.post('/rescue', (req, res) => {
  try {
    const { title, species, description, address, lat, lng, volunteersNeeded, leaderId, leaderName, reportId } = req.body
    if (!title || !leaderId) return res.json(error('参数不完整'))
    // Only conservation org members can initiate wildlife rescue
    const isConservation = db.prepare(
      "SELECT 1 FROM organization_members om JOIN organizations o ON o.id=om.org_id WHERE om.user_id=? AND o.type='conservation'"
    ).get(leaderId) as any
    if (!isConservation) return res.json(error('仅保护机构成员可发起野生动物救援。请报告给当地林业部门'))
    const tid = 'wl_' + Date.now()
    db.prepare('INSERT INTO wildlife_rescue_tasks (id,report_id,title,species,description,address,lat,lng,volunteers_needed,leader_id,leader_name) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(tid, reportId||'', title, species||'', description||'', address||'', lat||0, lng||0, volunteersNeeded||3, leaderId, leaderName||'')
    if (reportId) db.prepare("UPDATE wildlife_reports SET status='assigned', assigned_to=? WHERE id=?").run(leaderId, reportId)
    res.json(success({ id: tid }, '救援已发起'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// GET /api/wildlife/conservation-orgs
wildlifeRouter.get('/conservation-orgs', (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM organizations WHERE type='conservation'").all() as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, name: r.name, adminUserId: r.admin_user_id }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

wildlifeRouter.get('/rescue', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM wildlife_rescue_tasks ORDER BY created_at DESC LIMIT 20').all() as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, reportId: r.report_id, title: r.title, species: r.species, description: r.description, address: r.address, volunteersNeeded: r.volunteers_needed, volunteersResponded: r.volunteers_responded, leaderId: r.leader_id, leaderName: r.leader_name, status: r.status, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
