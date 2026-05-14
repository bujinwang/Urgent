import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const videoRouter = Router()

videoRouter.get('/recommend', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const size = parseInt(req.query.size as string) || 10
    const offset = (page - 1) * size
    const rows = db.prepare('SELECT *,(view_count*0.3+like_count*0.5+share_count*0.2) as score FROM video_posts ORDER BY score DESC,created_at DESC LIMIT ? OFFSET ?').all(size, offset) as any[]
    res.json(success({ items: rows.map(formatVideo), page, hasMore: rows.length === size }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

videoRouter.get('/category/:cat', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const size = parseInt(req.query.size as string) || 10
    const rows = db.prepare('SELECT * FROM video_posts WHERE category=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(req.params.cat, size, (page-1)*size) as any[]
    res.json(success({ items: rows.map(formatVideo), page, hasMore: rows.length === size }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

videoRouter.post('/', (req, res) => {
  try {
    const { userId, userName, userAvatar, title, description, videoUrl, thumbnail, duration, category } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    const vid = 'vp_' + Date.now()
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

function formatVideo(r: any) {
  return { id: r.id, userId: r.user_id, userName: r.user_name, userAvatar: r.user_avatar, title: r.title, description: r.description, videoUrl: r.video_url, thumbnail: r.thumbnail, duration: r.duration, viewCount: r.view_count, likeCount: r.like_count, shareCount: r.share_count, category: r.category, createdAt: r.created_at }
}
