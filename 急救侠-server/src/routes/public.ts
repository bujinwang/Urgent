import { Router } from 'express'
import crypto from 'crypto'
import db, { get, all } from '../db'
import { success, error } from '../types'
import * as config from '../config'
import { parseSmsReports, handleSmsReport, MAX_REPORTS_PER_REQUEST } from '../services/smsReportService'
import type {
  UserRow, UserTrailRow, PublicCertificateRow, PublicTrainingRow, PublicExternalCertRow,
} from '../types/rows'

export const publicRouter = Router()

publicRouter.get('/verify/:publicId', (req, res) => {
  try {
    const row = get<UserRow>('SELECT * FROM users WHERE public_id = ?', req.params.publicId)
    if (!row) return res.json(error('无效的验证码'))
    if (!row.is_public) return res.json(error('该用户未开启公开档案'))

    const certs = all<PublicCertificateRow>('SELECT type, issuer, issue_date, expiry_date, status FROM certificates WHERE user_id=? ORDER BY expiry_date ASC', row.id)
    const training = all<PublicTrainingRow>('SELECT scenario, date, organizer_name, notes FROM training_records WHERE user_id=? ORDER BY date DESC LIMIT 10', row.id)
    const trail = get<UserTrailRow>('SELECT * FROM user_trails WHERE user_id=?', row.id)
    const extCerts = all<PublicExternalCertRow>("SELECT type, issuer, cert_number FROM external_certifications WHERE user_id=? AND status='verified'", row.id)

    res.json(success({
      tier: row.tier, tierLabel: tierLabel(row.tier),
      avatar: row.avatar, city: row.city, rescueCount: row.rescue_count,
      certifications: certs.map((c: PublicCertificateRow) => ({ type: c.type, issuer: c.issuer, expiryDate: c.expiry_date, status: c.status })),
      badges: computeBadges(row.tier, row.rescue_count, row.points),
      trainingRecords: training.map((t: PublicTrainingRow) => ({ scenario: t.scenario, date: t.date, organizer: t.organizer_name, notes: t.notes })),
      trailExperience: trail ? { totalDistance: trail.total_distance, totalElevation: trail.total_elevation, hikesCompleted: trail.hikes_completed, longestHike: trail.longest_hike, badge: trail.badge } : null,
      externalCertifications: extCerts.map((e: PublicExternalCertRow) => ({ type: e.type, issuer: e.issuer, certNumber: e.cert_number })),
      volunteerType: row.volunteer_type,
      affiliation: row.affiliation || undefined,
      isOrganizer: row.is_organizer === 1,
      // 仅暴露**队伍角色**（`is_leader`）。`is_platform_admin`（平台管理员）是公开接口
      // 的绝对禁区 —— 输出即等于公开管理员名单（迁移 036）。
      isLeader: row.is_leader === 1,
    }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

publicRouter.post('/inquire', (req, res) => {
  try {
    const { name, phone, message, targetPublicId } = req.body
    if (!message) return res.json(error('请填写咨询内容'))
    db.prepare('INSERT INTO public_inquiries (id, name, phone, message, target_public_id) VALUES (?, ?, ?, ?, ?)').run('inq_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name || '', phone || '', message, targetPublicId || '')
    res.json(success(null, '咨询已提交'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/**
 * 阿里云短信状态报告回调（P1 语音降级触发）——公开端点（无 authMiddleware）。
 *
 * 安全：
 * - `ALIYUN_SMS_REPORT_SECRET` **未配置 → 404**（不暴露端点存在）。
 * - 已配置：校验请求头 `x-sms-report-secret`，用 **`crypto.timingSafeEqual`** 常量时间比较；不匹配 → 404 且**绝不呼语音**。
 * - 号码**绝不取自回调 payload**：由 `handleSmsReport` 按 `custodian_user_id` 回本库解析（防伪造回调）。
 *
 * 响应契约（官方要求）：已处理的正常结局 → **200 + `{"code":0,"msg":"接收成功"}`**（仅校验 code 为数字），
 * 否则阿里云会重推；**仅真正的内部异常** → **500**（让阿里云重推，幂等已兜底）。
 */
function smsReportSecretMatches(provided: string): boolean {
  const expected = config.ALIYUN_SMS_REPORT_SECRET
  if (!expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

publicRouter.post('/aliyun-sms-report', async (req, res) => {
  // 未配置密钥 ⇒ 端点整体关闭，避免暴露其存在
  if (!config.ALIYUN_SMS_REPORT_SECRET) return res.status(404).json({ code: -1, message: 'not found' })
  const provided = String(req.headers['x-sms-report-secret'] || '')
  if (!smsReportSecretMatches(provided)) return res.status(404).json({ code: -1, message: 'not found' })

  try {
    const items = parseSmsReports(req.body)
    if (items.length > MAX_REPORTS_PER_REQUEST) {
      console.warn(
        `[SMSReport] 单次报告 ${items.length} 条超上限 ${MAX_REPORTS_PER_REQUEST}，仅处理前 ${MAX_REPORTS_PER_REQUEST} 条`
      )
    }
    for (const item of items.slice(0, MAX_REPORTS_PER_REQUEST)) {
      await handleSmsReport(item)
    }
    res.status(200).json({ code: 0, msg: '接收成功' })
  } catch (e: unknown) {
    // 仅真正的内部异常返回 500（让阿里云重推；重复推送由幂等兜底，安全）
    console.error(`[SMSReport] 处理异常: ${e instanceof Error ? e.message : String(e)}`)
    res.status(500).json({ code: -1, message: 'internal error' })
  }
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
