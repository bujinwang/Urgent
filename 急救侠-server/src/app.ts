import express from 'express'
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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ code: 0, message: '急救侠 API 运行中' })
})

export default app
