import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error } from '../types'
import { authMiddleware } from '../middleware/auth'
import type { AuthPayload } from '../middleware/auth'
import { getVoiceDailyCount, getVoiceDailyLimit } from '../services/smsReportService'
import type {
  CountRow, UserWithCountsRow, OrganizationWithCountsRow,
  AdminCertificateRow, VolunteerRow,
} from '../types/rows'

/**
 * 管理面鉴权：依赖**平台管理员**（`is_platform_admin`，迁移 036 引入）。
 *
 * 拆分前此处判 `is_leader`（队伍队长），导致任何队长都能进管理面。
 * 队伍队长属**队伍角色**，不得据此进入平台管理面 —— 见 `types/rows.ts` 的字段说明。
 */
function adminMiddleware(req: Parameters<typeof authMiddleware>[0], res: Parameters<typeof authMiddleware>[1], next: Parameters<typeof authMiddleware>[2]) {
  const auth = (req as any).auth as AuthPayload | undefined
  if (!auth) return res.status(401).json(error('未登录'))
  const userId = auth.userId || auth.openid
  const user = db.prepare('SELECT is_platform_admin FROM users WHERE id = ?').get(userId) as { is_platform_admin: number } | undefined
  if (!user || !user.is_platform_admin) return res.status(403).json(error('仅管理员可执行此操作'))
  next()
}

export const adminRouter = Router()

adminRouter.use(authMiddleware, adminMiddleware)

adminRouter.get('/dashboard', (_req, res) => {
  try {
    const users = get<CountRow>('SELECT COUNT(*) as cnt FROM users')
    const orgs = get<CountRow>('SELECT COUNT(*) as cnt FROM organizations')
    const coaches = get<CountRow>("SELECT COUNT(*) as cnt FROM volunteers WHERE role = 'coach'")
    const aeds = get<CountRow>('SELECT COUNT(*) as cnt FROM aed_devices')
    const certs = get<CountRow>('SELECT COUNT(*) as cnt FROM certificates')
    const activePickups = get<CountRow>('SELECT COUNT(*) as cnt FROM aed_pickups WHERE return_time IS NULL')

    // ---- 责任人触达 / 短信·语音降级 可观测（P1）----
    // 仅**计数**，绝不含任何手机号/PII。delivery_state 用一条 GROUP BY 再映射（避免 5 条查询）。
    const deliveryRows = all<{ delivery_state: string; cnt: number }>(
      'SELECT delivery_state, COUNT(*) as cnt FROM aed_custodian_alerts GROUP BY delivery_state'
    )
    const ds: Record<string, number> = {}
    let alertTotal = 0
    for (const r of deliveryRows) { ds[r.delivery_state] = r.cnt; alertTotal += r.cnt }
    const delivered = ds['delivered'] || 0
    const smsFallback = ds['sms_fallback'] || 0
    // 触达率 = (直接送达 + 短信降级) / 总告警；**无样本（alerts=0）⇒ null**（禁止假报 0）
    const reachRate = alertTotal > 0 ? (delivered + smsFallback) / alertTotal : null

    const voiceRows = all<{ voice_state: string; cnt: number }>(
      'SELECT voice_state, COUNT(*) as cnt FROM aed_sms_dispatches GROUP BY voice_state'
    )
    const vs: Record<string, number> = {}
    let dispatched = 0
    for (const r of voiceRows) { vs[r.voice_state] = r.cnt; dispatched += r.cnt }

    const since24h = Date.now() - 24 * 60 * 60 * 1000
    const l24Alerts = get<CountRow>('SELECT COUNT(*) as cnt FROM aed_custodian_alerts WHERE notify_time_ms >= ?', since24h)
    const l24Sms = get<CountRow>("SELECT COUNT(*) as cnt FROM aed_custodian_alerts WHERE notify_time_ms >= ? AND delivery_state = 'sms_fallback'", since24h)
    const l24Voice = get<CountRow>("SELECT COUNT(*) as cnt FROM aed_sms_dispatches WHERE voice_state = 'called' AND voice_at_ms >= ?", since24h)

    const custodianReach = {
      alerts: alertTotal,
      pending: ds['pending'] || 0,
      delivered,
      smsFallback,
      failed: ds['failed'] || 0,
      noSubscription: ds['no_subscription'] || 0,
      reachRate,
      voice: {
        dispatched,
        called: vs['called'] || 0,
        failed: vs['failed'] || 0,
        noPhone: vs['no_phone'] || 0,
      },
      voiceDaily: { used: getVoiceDailyCount(), limit: getVoiceDailyLimit() },
      last24h: { alerts: l24Alerts!.cnt, smsFallback: l24Sms!.cnt, voiceCalled: l24Voice!.cnt },
    }

    res.json(success({ totalUsers:users!.cnt,totalOrganizations:orgs!.cnt,totalCoaches:coaches!.cnt,totalAeds:aeds!.cnt,totalCertificates:certs!.cnt,activePickups:activePickups!.cnt, custodianReach }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/users', (_req, res) => {
  try {
    const rows = all<UserWithCountsRow>(`SELECT u.*, (SELECT COUNT(*) FROM certificates WHERE user_id=u.id) as cert_count, (SELECT COUNT(*) FROM organization_members WHERE user_id=u.id AND role IN ('admin','manager')) as org_admin_count FROM users u ORDER BY u.name`)
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,avatar:r.avatar,tier:r.tier,points:r.points,city:r.city,volunteerId:r.volunteer_id,certifications:JSON.parse(r.certifications||'[]'),rescueCount:r.rescue_count,certCount:r.cert_count,isOrgAdmin:r.org_admin_count>0 }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/organizations', (_req, res) => {
  try {
    const rows = all<OrganizationWithCountsRow>(`SELECT o.*, (SELECT COUNT(*) FROM organization_members WHERE org_id=o.id) as member_count, (SELECT COUNT(*) FROM certificates WHERE user_id IN (SELECT user_id FROM organization_members WHERE org_id=o.id)) as cert_count FROM organizations o ORDER BY o.created_at DESC`)
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,type:r.type,adminUserId:r.admin_user_id,createdAt:r.created_at,memberCount:r.member_count,certCount:r.cert_count }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/certificates', (_req, res) => {
  try {
    const rows = all<AdminCertificateRow>(`SELECT c.*, u.name as user_name, (SELECT om.org_id FROM organization_members om WHERE om.user_id=c.user_id LIMIT 1) as org_id FROM certificates c JOIN users u ON u.id=c.user_id ORDER BY c.expiry_date ASC`)
    res.json(success(rows.map(r => ({ id:r.id,userId:r.user_id,userName:r.user_name,type:r.type,issuer:r.issuer,issueDate:r.issue_date,expiryDate:r.expiry_date,status:r.status,orgId:r.org_id }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

adminRouter.get('/coaches', (_req, res) => {
  try {
    const rows = all<VolunteerRow>("SELECT * FROM volunteers WHERE role='coach' ORDER BY rescue_count DESC")
    res.json(success(rows.map(r => ({ id:r.id,name:r.name,avatar:r.avatar,tier:r.tier,points:r.points,rescueCount:r.rescue_count,city:r.city,specialties:JSON.parse(r.coach_specialties||'[]'),certifications:JSON.parse(r.coach_certifications||'[]'),bio:r.coach_bio,available:r.coach_available===1 }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
