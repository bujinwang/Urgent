import { Router } from 'express'
import crypto from 'crypto'
import db, { get, all } from '../db'
import { success, error } from '../types'
import * as config from '../config'
import { parseSmsReports, handleSmsReport, MAX_REPORTS_PER_REQUEST } from '../services/smsReportService'
import { optionalAuth, AuthPayload } from '../middleware/auth'
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

/** `client_event_id` 长度上限（客户端提供时截断；不合法则由服务端生成）。 */
const SOS_CLIENT_EVENT_ID_MAX = 64
/** `client_platform` 长度上限（仅用于聚类，不参与判定）。 */
const SOS_CLIENT_PLATFORM_MAX = 32

/**
 * 严格白名单归一化 `is_drill` ⇒ 0/1。
 *
 * ⚠️ **不可写成 `!!v`**：`!!'false' === true`、`!!'0' === true`。若客户端某次把布尔值
 * 序列化成了字符串，`!!` 会把**真实 SOS 标成演习**，让它从反滥用计数里**静默消失**
 * （正好是 KPI「演习污染率」的反面）。故只认以下四种真值，其余一律为真实。
 */
function normalizeIsDrill(v: unknown): number {
  return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0
}

/**
 * 归一化 `client_event_id`。客户端未提供 / 为空 / 类型不对 ⇒ **服务端生成**，不拒绝。
 * 理由：埋点是旁路，**因格式问题丢弃一条 SOS 记录，比丢失幂等性糟得多**。
 */
function normalizeClientEventId(v: unknown): string {
  const s = typeof v === 'string' ? v.trim().slice(0, SOS_CLIENT_EVENT_ID_MAX) : ''
  return s || `srv_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`
}

/**
 * SOS 触发留痕上报（旁路埋点 → 兑现建议书 §10「恶意虚假呼救可追溯」）。
 *
 * 设计见 `deliverables/software-company/sos-telemetry-design.md`。三条不可动摇的约束：
 *
 * 1. **身份只从 token 派生，绝不读 `req.body.userId`。** 否则任何人都能把伪造的 SOS
 *    记到**别人名下**——那比"没有记录"更糟：会污染反滥用台账，甚至被用来构陷特定账号。
 * 2. **不落任何位置**（D1）：可追溯需要的是身份 + 时间，不是位置。表里没有位置列。
 * 3. **不阻塞、不报错**：急救场景下每延误 1 分钟存活率降 7–10%，埋点永远是旁路。
 *    因此本端点**不设业务错误响应**：校验失败一律降级处理（生成 id / 归一化为真实），
 *    只有真正的内部异常才 500。⚠️ 取舍声明：畸形的 `isDrill` 会被当作**真实**事件，
 *    这是**有意选择**——宁可多留痕，不可漏留痕。
 */
publicRouter.post('/sos-event', optionalAuth, (req, res) => {
  try {
    const auth = (req as { auth?: AuthPayload }).auth
    const userId = (auth && (auth.userId || auth.openid)) || null
    const body = (req.body || {}) as Record<string, unknown>
    const clientEventId = normalizeClientEventId(body.clientEventId)
    const clientPlatform = typeof body.platform === 'string' ? body.platform.slice(0, SOS_CLIENT_PLATFORM_MAX) : ''
    const isDrill = normalizeIsDrill(body.isDrill)
    const nowMs = Date.now()

    // 唯一索引 + OR IGNORE ⇒ 同一 clientEventId 重复提交只落一行（传输层幂等）。
    // 注意：DEFAULT 不能用于 created_at_ms（非事务时间，必须显式写入调用方已取的时间）。
    const info = db.prepare(
      'INSERT OR IGNORE INTO sos_events (id, client_event_id, user_id, is_drill, client_platform, created_at_ms) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(`sos_${nowMs}_${crypto.randomBytes(6).toString('hex')}`, clientEventId, userId, isDrill, clientPlatform, nowMs)

    // changes === 0 ⇒ 唯一索引命中，属重复提交（幂等语义），**不是错误**。
    res.json(success({ duplicate: info.changes === 0 }))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
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
