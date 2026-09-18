import express from 'express'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { userRouter } from './routes/user'
import { taskRouter } from './routes/task'
import { aedRouter } from './routes/aed'
import { newsRouter } from './routes/news'
import { learnRouter } from './routes/learn'
import { volunteerRouter } from './routes/volunteer'
import { recordsRouter } from './routes/records'
import { casesRouter } from './routes/cases'
import { atlasRouter } from './routes/atlas'
import { mediaAlertRouter } from './routes/media-alert'
import { govRouter } from './routes/gov'
import { initDb } from './db'
import { TRUST_PROXY_HOPS } from './config'
import { authMiddleware } from './middleware/auth'
import { authRouter } from './routes/auth'
import { pushRouter } from './routes/push'
import { orgRouter } from './routes/org'
import { adminRouter } from './routes/admin'
import { publicRouter } from './routes/public'
import { videoRouter } from './routes/video'
import { replayRouter } from './routes/replay'
import { communityRouter } from './routes/community'
import { rescueRouter } from './routes/rescue'
import { trailRouter } from './routes/trail'
import { drillRouter } from './routes/drill'
import { wildlifeRouter } from './routes/wildlife'
import { animalRouter } from './routes/animals'
import { serviceHoursRouter } from './routes/serviceHours'

const app = express()

// 反代信任跳数（安全）：生产为 Caddy → nginx → server（2 跳）。**必须在所有限流器与路由之前**设置，
// 否则 Express 会忽略 `X-Forwarded-For`，`req.ip` 退化为反代容器 IP ⇒ **所有外部客户端共用一个限流桶**
// （一人刷满即阻断全体合法用户）。`0` ⇒ `false`（关闭；服务被直接暴露时用）。
app.set('trust proxy', TRUST_PROXY_HOPS === 0 ? false : TRUST_PROXY_HOPS)

// Middleware
// CORS（安全收敛 E）：来源白名单来自 env `CORS_ORIGINS`（逗号分隔）；
// 未配置时：开发放开、生产告警（保持可用但提示收紧）。
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
if (corsOrigins.length > 0) {
  app.use(cors({ origin: corsOrigins }))
} else {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[cors] 生产环境未配置 CORS_ORIGINS，已放开全部来源（建议配置白名单收紧）')
  }
  app.use(cors())
}

// 安全响应头（安全收敛 D）：helmet 默认集；关闭 CSP 以免影响 /admin 静态页内联脚本
app.use(helmet({ contentSecurityPolicy: false }))

// 请求体大小上限（安全收敛 C）：1mb，防超大 JSON DoS
app.use(express.json({ limit: '1mb' }))

// Initialize DB
initDb()

// Rate limiters (skip in test / dev-memory mode)
const isTestMode = process.env.DB_PATH === ':memory:' || process.env.NODE_ENV === 'test'

const authLimiter = isTestMode
  ? (req: any, _res: any, next: any) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,  // 15 分钟
      max: 20,                     // 最多 20 次请求
      message: { code: -1, message: '请求过于频繁，请稍后再试' },
      standardHeaders: true,
      legacyHeaders: false,
    })

const pushSendLimiter = isTestMode
  ? (req: any, _res: any, next: any) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5,
      message: { code: -1, message: '请求过于频繁，请稍后再试' },
      standardHeaders: true,
      legacyHeaders: false,
    })

/** 政府登录限流（沿用测试豁免模式） */
const govLoginLimiter = isTestMode
  ? (req: any, _res: any, next: any) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: { code: -1, message: '请求过于频繁，请稍后再试' },
      standardHeaders: true,
      legacyHeaders: false,
    })

/** 阿里云短信状态报告回调：限流参数（导出以便单测断言）。 */
export const SMS_REPORT_LIMIT = { windowMs: 60 * 1000, max: 60 } as const

/** 阿里云短信状态报告回调限流中间件（公开端点，沿用测试豁免模式）。
 * `force=true` 时**绕过测试豁免**，返回真实限流器（供测试注入验证）。
 * 阈值可用 env `SMS_REPORT_MINUTE_LIMIT` 覆盖（与其它限流器一致）。 */
export function createSmsReportLimiter(force = false) {
  if (isTestMode && !force) return (req: any, _res: any, next: any) => next()
  const n = parseInt(process.env.SMS_REPORT_MINUTE_LIMIT || '', 10)
  const max = Number.isFinite(n) && n > 0 ? n : SMS_REPORT_LIMIT.max
  return rateLimit({
    windowMs: SMS_REPORT_LIMIT.windowMs,
    max,
    message: { code: -1, message: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

const smsReportLimiter = createSmsReportLimiter()

/**
 * 匿名端点的**按 IP 小时限流**（复用测试豁免模式）；`force=true` 绕过豁免（供测试）。
 * 阈值可用 env 覆盖（缺省用 `def`）。仅**限频**，**不加登录要求**（保持"急救现场无需注册"）。
 */
export function createHourlyIpLimiter(envKey: string, def: number, force = false) {
  if (isTestMode && !force) return (req: any, _res: any, next: any) => next()
  const n = parseInt(process.env[envKey] || '', 10)
  const max = Number.isFinite(n) && n > 0 ? n : def
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max,
    message: { code: -1, message: '操作过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

/**
 * 阈值缺省值（导出以便单测断言）。
 *
 * `sosEvent` = 120 次/小时/IP，明显高于其它匿名端点，是**唯一的"故意放宽"**，理由（详见设计文档 §4）：
 * 1. 本端点**无任何外部调用**（不发短信、不推送、不写盘）⇒ **无放大效应**，滥用风险有界在磁盘增长。
 * 2. 上报是旁路且失败静默 ⇒ 撞限流的代价是"丢一条记录"，而阈值定低损失的是**最需要留痕**的那部分
 *    （共享出口 IP 的医院/学校/企业 NAT，以及网络抖动）。
 * 3. 与 `inquire`（5 次/小时）不同，合法调用频率**不由客户端控制**：一次真实急救 = 一次用户主动触发，
 *    而同一出口 IP 背后可能站着成百上千人。
 */
export const ANON_LIMITS = { mediaUpload: 10, inquire: 5, sosEvent: 120 } as const

/** 服务证明**验真**端点默认阈值（次/小时/IP，Q7；导出以便单测断言）。 */
export const SERVICE_CERT_VERIFY_HOURLY_LIMIT = 60

/**
 * 服务证明**验真**端点的按 IP 小时限流（Q7）。`force=true` 绕过测试豁免（供测试注入），
 * 照 `createSmsReportLimiter` 先例。
 *
 * ⚠️ **只作用于公开验真路径** `GET /service-certificates/:certNo` —— **绝不**误伤同前缀的
 * `GET /service-certificates/me` 与 `POST /service-certificates`（T25）。
 *
 * ⚠️ **不能**直接把限流器挂到 `app.use('/api/volunteer/service-certificates', limiter)`：
 * Express 的**前缀匹配**会让 `/me` 与 POST 也被限流（**已实测**：中间件对 `GET /me`、
 * `POST /`、`GET /<certNo>` 三者都会触发）。故加一层「仅验真」判定：
 * 挂载点下 `req.path` 为 `'/'`（POST 集合）/ `'/me'` / `'/<certNo>'`，
 * 只有 **GET 且非 `/`、非 `/me`** 才是公开验真。
 */
export function createServiceCertVerifyLimiter(force = false) {
  const limiter = createHourlyIpLimiter('SERVICE_CERT_VERIFY_HOURLY_LIMIT', SERVICE_CERT_VERIFY_HOURLY_LIMIT, force)
  return (req: any, res: any, next: any) => {
    const isVerify = req.method === 'GET' && req.path !== '/' && req.path !== '/me'
    if (!isVerify) return next()
    return limiter(req, res, next)
  }
}

const serviceCertVerifyLimiter = createServiceCertVerifyLimiter()

// Routes
app.use('/api/auth', authLimiter, authRouter)
app.use('/api/push/send', pushSendLimiter)
app.use('/api/push', pushRouter)
app.use('/api/user', userRouter)
app.use('/api/task', taskRouter)
app.use('/api/aed', aedRouter)
app.use('/api/news', newsRouter)
app.use('/api/learn', learnRouter)
app.use('/api/volunteer', volunteerRouter)
// F4 T02：验真限流器必须挂在其路由之前；工厂内**只对公开验真路径**生效（不误伤 /me、POST）。
app.use('/api/volunteer/service-certificates', serviceCertVerifyLimiter)
app.use('/api/volunteer', serviceHoursRouter)
app.use('/api/records', recordsRouter)
app.use('/api/cases', casesRouter)
app.use('/api/atlas', atlasRouter)
app.use('/api/media-alert/upload', createHourlyIpLimiter('MEDIA_UPLOAD_HOURLY_LIMIT', ANON_LIMITS.mediaUpload))
app.use('/api/media-alert', mediaAlertRouter)
app.use('/api/gov/login', govLoginLimiter)
app.use('/api/gov', govRouter)
app.use('/api/org', orgRouter)
app.use('/api/admin', adminRouter)
app.use('/api/public/aliyun-sms-report', smsReportLimiter)
app.use('/api/public/inquire', createHourlyIpLimiter('INQUIRE_HOURLY_LIMIT', ANON_LIMITS.inquire))
// 必须在 `app.use('/api/public', publicRouter)` **之前**挂载，否则限流不会生效。
app.use('/api/public/sos-event', createHourlyIpLimiter('SOS_EVENT_HOURLY_LIMIT', ANON_LIMITS.sosEvent))
app.use('/api/public', publicRouter)
app.use('/api/video', videoRouter)
app.use('/api/replay', replayRouter)
app.use('/api/community', communityRouter)
app.use('/api/rescue', rescueRouter)
app.use('/api/trail', trailRouter)
app.use('/api/drill', drillRouter)
app.use('/api/wildlife', wildlifeRouter)
app.use('/api/animals', animalRouter)

// Static files — Web admin portal
app.use('/admin', express.static(path.join(__dirname, '..', 'public')))
// Serve uploaded images
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

// Image upload (base64 data URL) — 安全收敛 F：类型白名单 + 大小上限
const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB
// 需登录：该端点无前端调用方（实际上传走 multipart 的 /media-alert/upload 与 /video/upload），
// 若不鉴权则任何人可匿名写盘（`public/uploads`）并拿到可访问 URL。
app.post('/api/upload', authMiddleware, (req, res) => {
  try {
    const raw: unknown = req.body.image || req.body.file
    if (typeof raw !== 'string' || !raw) {
      return res.status(400).json({ code: -1, message: '缺少图片数据' })
    }
    const matched = /^data:([a-zA-Z0-9/+.-]+);base64,(.*)$/s.exec(raw)
    if (!matched) {
      return res.status(400).json({ code: -1, message: '仅支持 base64 data URL 图片' })
    }
    const mime = matched[1].toLowerCase()
    const ext = ALLOWED_IMAGE_MIME[mime]
    if (!ext) {
      return res.status(400).json({ code: -1, message: '不支持的图片类型: ' + mime })
    }
    const buf = Buffer.from(matched[2], 'base64')
    if (buf.length === 0) {
      return res.status(400).json({ code: -1, message: '图片数据为空' })
    }
    if (buf.length > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ code: -1, message: '图片过大（上限 5MB）' })
    }
    const filename = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`
    fs.writeFileSync(path.join(uploadsDir, filename), buf)
    res.json({ code: 0, data: { url: `/uploads/${filename}` }, message: 'ok' })
  } catch (e: unknown) {
    res.status(500).json({ code: -1, message: e instanceof Error ? e.message : '服务器错误' })
  }
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: '急救侠 API 运行中' })
})

export default app
