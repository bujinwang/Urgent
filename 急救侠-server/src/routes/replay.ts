import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const replayRouter = Router()

replayRouter.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    const rows = db.prepare('SELECT * FROM rescue_replays ORDER BY created_at DESC LIMIT ?').all(limit) as any[]
    res.json(success(rows.map(formatReplay)))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

replayRouter.get('/:id', (req, res) => {
  try {
    const rp = db.prepare('SELECT * FROM rescue_replays WHERE id=?').get(req.params.id) as any
    if (!rp) return res.json(error('回放不存在'))
    const media = db.prepare('SELECT * FROM task_media WHERE task_id=? ORDER BY created_at ASC').all(rp.task_id) as any[]
    const comments = db.prepare('SELECT * FROM replay_comments WHERE replay_id=? ORDER BY created_at DESC LIMIT 30').all(req.params.id) as any[]
    res.json(success({
      ...formatReplay(rp),
      timeline: media.map((m:any) => ({ id:m.id,userId:m.user_id,userName:m.user_name,userAvatar:m.user_avatar,type:m.type,content:m.content,mediaUrl:m.media_url,createdAt:m.created_at })),
      comments: comments.map((c:any) => ({ id:c.id,userId:c.user_id,userName:c.user_name,userAvatar:c.user_avatar,content:c.content,createdAt:c.created_at })),
    }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

replayRouter.post('/:id/like', (req, res) => {
  try { db.prepare('UPDATE rescue_replays SET like_count=like_count+1 WHERE id=?').run(req.params.id); res.json(success(null)) } catch (e: any) { res.status(500).json(error(e.message)) }
})

replayRouter.post('/:id/comment', (req, res) => {
  try {
    const { userId, userName, userAvatar, content } = req.body
    if (!userId || !content) return res.json(error('参数不完整'))
    db.prepare('INSERT INTO replay_comments (id,replay_id,user_id,user_name,user_avatar,content) VALUES (?,?,?,?,?,?)').run('rc_'+Date.now(), req.params.id, userId, userName||'', userAvatar||'', content)
    db.prepare('UPDATE rescue_replays SET comment_count=comment_count+1 WHERE id=?').run(req.params.id)
    res.json(success(null))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

replayRouter.post('/:id/bookmark', (req, res) => {
  try { db.prepare('UPDATE rescue_replays SET bookmark_count=bookmark_count+1 WHERE id=?').run(req.params.id); res.json(success(null)) } catch (e: any) { res.status(500).json(error(e.message)) }
})

function formatReplay(r: any) {
  return { id:r.id,taskId:r.task_id,title:r.title,description:r.description,address:r.address,sceneType:r.scene_type,patientAge:r.patient_age,patientGender:r.patient_gender,volunteersCount:r.volunteers_count,duration:r.duration,outcome:r.outcome,likeCount:r.like_count,commentCount:r.comment_count,bookmarkCount:r.bookmark_count,createdAt:r.created_at }
}
