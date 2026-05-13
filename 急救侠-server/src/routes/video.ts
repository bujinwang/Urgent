import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const videoRouter = Router()

videoRouter.post('/', (req, res) => {
  try {
    const { userId, userName, userAvatar, title, description, thumbnail } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    const vid = 'vid_' + Date.now()
    db.prepare('INSERT INTO video_streams (id,user_id,user_name,user_avatar,title,description,thumbnail,is_live) VALUES (?,?,?,?,?,?,?,1)').run(vid, userId, userName||'', userAvatar||'', title||'', description||'', thumbnail||'')
    res.json(success({ id: vid }, '已发布'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

videoRouter.get('/feed', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20
    const rows = db.prepare('SELECT * FROM video_streams ORDER BY created_at DESC LIMIT ?').all(limit) as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, userId: r.user_id, userName: r.user_name, userAvatar: r.user_avatar, title: r.title, description: r.description, thumbnail: r.thumbnail, isLive: r.is_live===1, viewCount: r.view_count, likeCount: r.like_count, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

videoRouter.post('/:id/view', (req, res) => {
  try { db.prepare('UPDATE video_streams SET view_count=view_count+1 WHERE id=?').run(req.params.id); res.json(success(null)) } catch (e: any) { res.status(500).json(error(e.message)) }
})

videoRouter.post('/:id/like', (req, res) => {
  try { db.prepare('UPDATE video_streams SET like_count=like_count+1 WHERE id=?').run(req.params.id); res.json(success(null)) } catch (e: any) { res.status(500).json(error(e.message)) }
})
