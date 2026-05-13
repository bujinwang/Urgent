import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const adminRouter = Router()

adminRouter.get('/dashboard', (_req, res) => {
  try {
    const users = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any
    const orgs = db.prepare('SELECT COUNT(*) as cnt FROM organizations').get() as any
    const coaches = db.prepare("SELECT COUNT(*) as cnt FROM volunteers WHERE role = 'coach'").get() as any
    const aeds = db.prepare('SELECT COUNT(*) as cnt FROM aed_devices').get() as any
    const certs = db.prepare('SELECT COUNT(*) as cnt FROM certificates').get() as any
    const activePickups = db.prepare('SELECT COUNT(*) as cnt FROM aed_pickups WHERE return_time IS NULL').get() as any
    res.json(success({ totalUsers:users.cnt,totalOrganizations:orgs.cnt,totalCoaches:coaches.cnt,totalAeds:aeds.cnt,totalCertificates:certs.cnt,activePickups:activePickups.cnt }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/users', (_req, res) => {
  try {
    const rows = db.prepare(`SELECT u.*, (SELECT COUNT(*) FROM certificates WHERE user_id=u.id) as cert_count, (SELECT COUNT(*) FROM organization_members WHERE user_id=u.id AND role IN ('admin','manager')) as org_admin_count FROM users u ORDER BY u.name`).all() as any[]
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,avatar:r.avatar,tier:r.tier,points:r.points,city:r.city,volunteerId:r.volunteer_id,certifications:JSON.parse(r.certifications||'[]'),rescueCount:r.rescue_count,certCount:r.cert_count,isOrgAdmin:r.org_admin_count>0 }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/organizations', (_req, res) => {
  try {
    const rows = db.prepare(`SELECT o.*, (SELECT COUNT(*) FROM organization_members WHERE org_id=o.id) as member_count, (SELECT COUNT(*) FROM certificates WHERE user_id IN (SELECT user_id FROM organization_members WHERE org_id=o.id)) as cert_count FROM organizations o ORDER BY o.created_at DESC`).all() as any[]
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,type:r.type,adminUserId:r.admin_user_id,createdAt:r.created_at,memberCount:r.member_count,certCount:r.cert_count }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/certificates', (_req, res) => {
  try {
    const rows = db.prepare(`SELECT c.*, u.name as user_name, (SELECT om.org_id FROM organization_members om WHERE om.user_id=c.user_id LIMIT 1) as org_id FROM certificates c JOIN users u ON u.id=c.user_id ORDER BY c.expiry_date ASC`).all() as any[]
    res.json(success(rows.map(r => ({ id:r.id,userId:r.user_id,userName:r.user_name,type:r.type,issuer:r.issuer,issueDate:r.issue_date,expiryDate:r.expiry_date,status:r.status,orgId:r.org_id }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/coaches', (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM volunteers WHERE role='coach' ORDER BY rescue_count DESC").all() as any[]
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,avatar:r.avatar,tier:r.tier,points:r.points,rescueCount:r.rescue_count,city:r.city,specialties:JSON.parse(r.coach_specialties||'[]'),certifications:JSON.parse(r.coach_certifications||'[]'),bio:r.coach_bio,available:r.coach_available===1 }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
