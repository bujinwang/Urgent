import express from 'express'
import path from 'path'
import fs from 'fs'
import cors from 'cors'
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
import { initDb } from './db'
import { authRouter } from './routes/auth'
import { pushRouter } from './routes/push'
import { orgRouter } from './routes/org'
import { adminRouter } from './routes/admin'
import { publicRouter } from './routes/public'
import { videoRouter } from './routes/video'
import { communityRouter } from './routes/community'
import { rescueRouter } from './routes/rescue'
import { trailRouter } from './routes/trail'
import { drillRouter } from './routes/drill'
import { wildlifeRouter } from './routes/wildlife'
import { animalRouter } from './routes/animals'

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Initialize DB
initDb()

// Routes
app.use('/api/auth', authRouter)
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
app.use('/api/org', orgRouter)
app.use('/api/admin', adminRouter)
app.use('/api/public', publicRouter)
app.use('/api/video', videoRouter)
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

// Image upload (base64) — accepts image or file key
app.post('/api/upload', (req, res) => {
  try {
    const raw = req.body.image || req.body.file
    if (!raw) return res.status(400).json({ code: -1, message: '缺少图片数据' })
    const base64Data = raw.replace(/^data:image\/\w+;base64,/, '')
    const ext = raw.includes('png') ? 'png' : 'jpg'
    const filename = `upload_${Date.now()}_${Math.random().toString(36).slice(2,6)}.${ext}`
    fs.writeFileSync(path.join(uploadsDir, filename), base64Data, 'base64')
    res.json({ code: 0, data: { url: `/uploads/${filename}` }, message: 'ok' })
  } catch (e: any) { res.status(500).json({ code: -1, message: e.message }) }
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: '急救侠 API 运行中' })
})

export default app
