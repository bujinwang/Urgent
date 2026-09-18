import { Router } from 'express'
import path from 'path'
import multer from 'multer'
import db, { get, all } from '../db'
import { success, error } from '../types'
import { authMiddleware, identityOf } from '../middleware/auth'
import type { VideoPostRow, VideoCommentRow } from '../types/rows'

const VIDEOS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'videos')

// Multer: store uploaded videos to public/uploads/videos/
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const fs = require('fs')
    if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true })
    cb(null, VIDEOS_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4'
    cb(null, `video_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.3gp']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) return cb(null, true)
    cb(new Error('不支持的文件格式: ' + ext))
  },
})

export const videoRouter = Router()

// ---- 视频上传 ----
videoRouter.post('/upload', (req, res) => {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json(error(err.message))
    if (!req.file) return res.status(400).json(error('请选择视频文件'))

    const videoUrl = `/uploads/videos/${req.file.filename}`
    const duration = (req.body as any).duration || ''
    const thumbnail = (req.body as any).thumbnail || ''

    res.json(success({ videoUrl, thumbnail, duration, filename: req.file.filename }))
  })
})

videoRouter.get('/recommend', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const size = parseInt(req.query.size as string) || 10
    const offset = (page - 1) * size
    const rows = all<VideoPostRow & { score: number }>('SELECT *,(view_count*0.3+like_count*0.5+share_count*0.2) as score FROM video_posts ORDER BY score DESC,created_at DESC LIMIT ? OFFSET ?', size, offset)
    res.json(success({ items: rows.map(formatVideo), page, hasMore: rows.length === size }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

videoRouter.get('/category/:cat', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const size = parseInt(req.query.size as string) || 10
    const rows = all<VideoPostRow>('SELECT * FROM video_posts WHERE category=? ORDER BY created_at DESC LIMIT ? OFFSET ?', req.params.cat, size, (page-1)*size)
    res.json(success({ items: rows.map(formatVideo), page, hasMore: rows.length === size }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-1：`userId` 不再取自 body（可伪造 ⇒ 冒名发布视频）。
videoRouter.post('/', authMiddleware, (req, res) => {
  try {
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { userName, userAvatar, title, description, videoUrl, thumbnail, duration, category } = req.body
    const vid = 'vp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    db.prepare('INSERT INTO video_posts (id,user_id,user_name,user_avatar,title,description,video_url,thumbnail,duration,category) VALUES (?,?,?,?,?,?,?,?,?,?)').run(vid, userId, userName||'', userAvatar||'', title||'', description||'', videoUrl||'', thumbnail||'', duration||'', category||'rescue')
    res.json(success({ id: vid }, '已发布'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

videoRouter.post('/:id/view', (req, res) => {
  try { db.prepare('UPDATE video_posts SET view_count=view_count+1 WHERE id=?').run(req.params.id); res.json(success(null)) } catch (e: any) { res.status(500).json(error(e.message)) }
})

videoRouter.post('/:id/like', (req, res) => {
  try { db.prepare('UPDATE video_posts SET like_count=like_count+1 WHERE id=?').run(req.params.id); res.json(success(null)) } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ---- 评论 ----
videoRouter.get('/:id/comments', (req, res) => {
  try {
    const rows = all<VideoCommentRow>('SELECT * FROM video_comments WHERE video_id=? ORDER BY created_at DESC LIMIT 50', req.params.id)
    res.json(success(rows.map((c: VideoCommentRow) => ({
      id: c.id, userId: c.user_id, userName: c.user_name,
      userAvatar: c.user_avatar, content: c.content, createdAt: c.created_at,
    }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-1：`userId` 不再取自 body（可伪造 ⇒ 冒名评论）。
videoRouter.post('/:id/comment', authMiddleware, (req, res) => {
  try {
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { userName, userAvatar, content } = req.body
    if (!content) return res.json(error('参数不完整'))
    db.prepare('INSERT INTO video_comments (id,video_id,user_id,user_name,user_avatar,content) VALUES (?,?,?,?,?,?)').run('vc_'+Date.now() + '_' + Math.random().toString(36).slice(2, 6), req.params.id, userId, userName||'', userAvatar||'', content)
    db.prepare('UPDATE video_posts SET comment_count=comment_count+1 WHERE id=?').run(req.params.id)
    res.json(success(null, '评论成功'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★★ P0-1：原所有权校验是**失效的** —— 它比较 `row.user_id !== req.body.userId`，
// 而 `userId` 取自 body ⇒ 在 body 里传评论作者的 id 就能删掉**任意他人评论**。
// 现改为与 **token 派生身份**（{@link identityOf}）比较，冒名传 id 不再生效。
videoRouter.delete('/:id/comment/:commentId', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    const row = get<{ user_id: string }>('SELECT user_id FROM video_comments WHERE id=?', req.params.commentId)
    if (!row) return res.json(error('评论不存在'))
    if (row.user_id !== callerId) return res.status(403).json(error('无权删除'))
    db.prepare('DELETE FROM video_comments WHERE id=?').run(req.params.commentId)
    db.prepare('UPDATE video_posts SET comment_count=MAX(0,comment_count-1) WHERE id=?').run(req.params.id)
    res.json(success(null, '已删除'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

function formatVideo(r: VideoPostRow) {
  return { id: r.id, userId: r.user_id, userName: r.user_name, userAvatar: r.user_avatar, title: r.title, description: r.description, videoUrl: r.video_url, thumbnail: r.thumbnail, duration: r.duration, viewCount: r.view_count, likeCount: r.like_count, shareCount: r.share_count, commentCount: r.comment_count||0, category: r.category, createdAt: r.created_at }
}
