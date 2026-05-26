import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error } from '../types'
import { authMiddleware } from '../middleware/auth'
import type { AuthPayload } from '../middleware/auth'

/** Require authenticated user with is_leader = 1 */
function adminMiddleware(req: Parameters<typeof authMiddleware>[0], res: Parameters<typeof authMiddleware>[1], next: Parameters<typeof authMiddleware>[2]) {
  const auth = (req as any).auth as AuthPayload | undefined
  if (!auth) return res.status(401).json(error('未登录'))
  const userId = auth.userId || auth.openid
  const user = db.prepare('SELECT is_leader FROM users WHERE id = ?').get(userId) as { is_leader: number } | undefined
  if (!user || !user.is_leader) return res.status(403).json(error('仅管理员可执行此操作'))
  next()
}

export const adminRouter = Router()

adminRouter.use(authMiddleware, adminMiddleware)

adminRouter.get('/dashboard', (_req, res) => {
  try {
    const users = get('SELECT COUNT(*) as cnt FROM users', )
    const orgs = get('SELECT COUNT(*) as cnt FROM organizations', )
    const coaches = get("SELECT COUNT(*) as cnt FROM volunteers WHERE role = 'coach'", )
    const aeds = get('SELECT COUNT(*) as cnt FROM aed_devices', )
    const certs = get('SELECT COUNT(*) as cnt FROM certificates', )
    const activePickups = get('SELECT COUNT(*) as cnt FROM aed_pickups WHERE return_time IS NULL', )
    res.json(success({ totalUsers:users.cnt,totalOrganizations:orgs.cnt,totalCoaches:coaches.cnt,totalAeds:aeds.cnt,totalCertificates:certs.cnt,activePickups:activePickups.cnt }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/users', (_req, res) => {
  try {
    const rows = all(`SELECT u.*, (SELECT COUNT(*) FROM certificates WHERE user_id=u.id) as cert_count, (SELECT COUNT(*) FROM organization_members WHERE user_id=u.id AND role IN ('admin','manager')) as org_admin_count FROM users u ORDER BY u.name`)
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,avatar:r.avatar,tier:r.tier,points:r.points,city:r.city,volunteerId:r.volunteer_id,certifications:JSON.parse(r.certifications||'[]'),rescueCount:r.rescue_count,certCount:r.cert_count,isOrgAdmin:r.org_admin_count>0 }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/organizations', (_req, res) => {
  try {
    const rows = all(`SELECT o.*, (SELECT COUNT(*) FROM organization_members WHERE org_id=o.id) as member_count, (SELECT COUNT(*) FROM certificates WHERE user_id IN (SELECT user_id FROM organization_members WHERE org_id=o.id)) as cert_count FROM organizations o ORDER BY o.created_at DESC`)
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,type:r.type,adminUserId:r.admin_user_id,createdAt:r.created_at,memberCount:r.member_count,certCount:r.cert_count }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/certificates', (_req, res) => {
  try {
    const rows = all(`SELECT c.*, u.name as user_name, (SELECT om.org_id FROM organization_members om WHERE om.user_id=c.user_id LIMIT 1) as org_id FROM certificates c JOIN users u ON u.id=c.user_id ORDER BY c.expiry_date ASC`)
    res.json(success(rows.map(r => ({ id:r.id,userId:r.user_id,userName:r.user_name,type:r.type,issuer:r.issuer,issueDate:r.issue_date,expiryDate:r.expiry_date,status:r.status,orgId:r.org_id }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/coaches', (_req, res) => {
  try {
    const rows = all("SELECT * FROM volunteers WHERE role='coach' ORDER BY rescue_count DESC", )
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,avatar:r.avatar,tier:r.tier,points:r.points,rescueCount:r.rescue_count,city:r.city,specialties:JSON.parse(r.coach_specialties||'[]'),certifications:JSON.parse(r.coach_certifications||'[]'),bio:r.coach_bio,available:r.coach_available===1 }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
