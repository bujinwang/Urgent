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

const app = express()

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
app.use('/api/records', recordsRouter)
app.use('/api/cases', casesRouter)
app.use('/api/atlas', atlasRouter)
app.use('/api/media-alert', mediaAlertRouter)
app.use('/api/gov/login', govLoginLimiter)
app.use('/api/gov', govRouter)
app.use('/api/org', orgRouter)
app.use('/api/admin', adminRouter)
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
