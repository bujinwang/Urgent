import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const publicRouter = Router()

publicRouter.get('/verify/:publicId', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM users WHERE public_id = ?').get(req.params.publicId) as any
    if (!row) return res.json(error('无效的验证码'))
    if (!row.is_public) return res.json(error('该用户未开启公开档案'))

    const certs = db.prepare('SELECT type, issuer, issue_date, expiry_date, status FROM certificates WHERE user_id=? ORDER BY expiry_date ASC').all(row.id) as any[]
    const training = db.prepare('SELECT scenario, date, organizer_name, notes FROM training_records WHERE user_id=? ORDER BY date DESC LIMIT 10').all(row.id) as any[]
    const trail = db.prepare('SELECT * FROM user_trails WHERE user_id=?').get(row.id) as any
    const extCerts = db.prepare("SELECT type, issuer, cert_number FROM external_certifications WHERE user_id=? AND status='verified'").all(row.id) as any[]

    res.json(success({
      tier: row.tier, tierLabel: tierLabel(row.tier),
      avatar: row.avatar, city: row.city, rescueCount: row.rescue_count,
      certifications: certs.map((c: any) => ({ type: c.type, issuer: c.issuer, expiryDate: c.expiry_date, status: c.status })),
      badges: computeBadges(row.tier, row.rescue_count, row.points),
      trainingRecords: training.map((t: any) => ({ scenario: t.scenario, date: t.date, organizer: t.organizer_name, notes: t.notes })),
      trailExperience: trail ? { totalDistance: trail.total_distance, totalElevation: trail.total_elevation, hikesCompleted: trail.hikes_completed, longestHike: trail.longest_hike, badge: trail.badge } : null,
      externalCertifications: extCerts.map((e: any) => ({ type: e.type, issuer: e.issuer, certNumber: e.cert_number })),
      volunteerType: row.volunteer_type,
      affiliation: row.affiliation || undefined,
      isOrganizer: row.is_organizer === 1,
      isLeader: row.is_leader === 1,
    }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

publicRouter.post('/inquire', (req, res) => {
  try {
    const { name, phone, message, targetPublicId } = req.body
    if (!message) return res.json(error('请填写咨询内容'))
    db.prepare('INSERT INTO public_inquiries (id, name, phone, message, target_public_id) VALUES (?, ?, ?, ?, ?)').run('inq_' + Date.now(), name || '', phone || '', message, targetPublicId || '')
    res.json(success(null, '咨询已提交'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

function tierLabel(t: string) { return { gold:'金牌急救侠',silver:'银牌急救侠',bronze:'铜牌急救侠',diamond:'钻石急救侠' }[t]||t }
function computeBadges(tier: string, rescueCount: number, points: number): string[] {
  const b: string[] = []
  if (tier==='diamond'||tier==='gold') b.push('资深急救员')
  if (rescueCount>=10) b.push('救援先锋')
  else if (rescueCount>=5) b.push('实战经验者')
  if (points>=2000) b.push('高积分贡献者')
  b.push({gold:'🏅金牌',silver:'🥈银牌',bronze:'🥉铜牌',diamond:'💎钻石'}[tier]||'')
  return b.filter(Boolean)
}
