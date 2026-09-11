import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error } from '../types'
import type {
  NearbyVolunteerRow, MessageRow, GroupWithMemberCountRow,
  GroupMessageRow, AedManagerRow,
} from '../types/rows'

export const communityRouter = Router()

communityRouter.post('/location', (req, res) => {
  try {
    const { userId, userName, lat, lng } = req.body
    if (!userId || lat == null || lng == null) return res.json(error('参数不完整'))
    db.prepare('INSERT OR REPLACE INTO volunteer_locations (id, user_id, user_name, lat, lng, updated_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))').run('vl_' + userId, userId, userName || '', lat, lng)
    // Sync mobile AED positions
    db.prepare('UPDATE aed_devices SET lat = ?, lng = ? WHERE linked_user_id = ? AND is_mobile = 1').run(lat, lng, userId)
    res.json(success(null, '位置已更新'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.get('/nearby', (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string) || 0
    const lng = parseFloat(req.query.lng as string) || 0
    const radius = parseFloat(req.query.radius as string) || 5000
    const dlat = radius / 111000
    const dlng = radius / (111000 * Math.cos(lat * Math.PI / 180))
    const rows = all<NearbyVolunteerRow>('SELECT vl.*, u.tier, u.rescue_count FROM volunteer_locations vl JOIN users u ON u.id=vl.user_id WHERE vl.lat BETWEEN ? AND ? AND vl.lng BETWEEN ? AND ? ORDER BY ((vl.lat-?)*(vl.lat-?) + (vl.lng-?)*(vl.lng-?)) ASC LIMIT 30', lat - dlat, lat + dlat, lng - dlng, lng + dlng, lat, lat, lng, lng)
    res.json(success(rows.map((r: NearbyVolunteerRow) => ({ userId: r.user_id, userName: r.user_name, tier: r.tier, rescueCount: r.rescue_count, lat: r.lat, lng: r.lng, updatedAt: r.updated_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.get('/messages', (req, res) => {
  try {
    const userId = req.query.userId as string
    const rows = all<MessageRow>('SELECT * FROM messages WHERE from_user_id=? OR to_user_id=? ORDER BY created_at DESC LIMIT 50', userId, userId)
    res.json(success(rows.map((r: MessageRow) => ({ id: r.id, fromUserId: r.from_user_id, fromUserName: r.from_user_name, toUserId: r.to_user_id, content: r.content, isRead: r.is_read === 1, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.post('/messages', (req, res) => {
  try {
    const { fromUserId, fromUserName, toUserId, content } = req.body
    if (!fromUserId || !toUserId || !content) return res.json(error('参数不完整'))
    db.prepare('INSERT INTO messages (id, from_user_id, from_user_name, to_user_id, content) VALUES (?, ?, ?, ?, ?)').run('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), fromUserId, fromUserName || '', toUserId, content)
    res.json(success(null, '已发送'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.post('/contact-aed/:aedId', (req, res) => {
  try {
    const aed = get<{ name: string }>('SELECT name FROM aed_devices WHERE id=?', req.params.aedId)
    if (!aed) return res.json(error('AED 不存在'))
    const mgr = get<AedManagerRow>("SELECT * FROM aed_managers WHERE aed_id=? AND role='primary' LIMIT 1", req.params.aedId)
    if (!mgr) return res.json(error('该 AED 暂无维护者'))
    const { fromUserId, fromUserName, content } = req.body
    db.prepare('INSERT INTO messages (id, from_user_id, from_user_name, to_user_id, content) VALUES (?, ?, ?, ?, ?)').run('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), fromUserId, fromUserName || '', mgr.user_id, `[${aed.name}] ${content}`)
    res.json(success(null, '已发送给 AED 维护者'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.get('/groups', (_req, res) => {
  try {
    const rows = all<GroupWithMemberCountRow>('SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as mc FROM volunteer_groups g ORDER BY g.created_at DESC')
    res.json(success(rows.map((r: GroupWithMemberCountRow) => ({ id: r.id, name: r.name, description: r.description, createdBy: r.created_by, memberCount: r.mc, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.post('/groups', (req, res) => {
  try {
    const { name, description, createdBy, createdByName } = req.body
    if (!name || !createdBy) return res.json(error('name 和 createdBy 不能为空'))
    const gid = 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    db.prepare('INSERT INTO volunteer_groups (id, name, description, created_by) VALUES (?, ?, ?, ?)').run(gid, name, description || '', createdBy)
    db.prepare('INSERT OR IGNORE INTO group_members (id, group_id, user_id, user_name) VALUES (?, ?, ?, ?)').run('gm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), gid, createdBy, createdByName || '')
    res.json(success({ id: gid }, '群组已创建'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.post('/groups/:id/join', (req, res) => {
  try {
    const { userId, userName } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    db.prepare('INSERT OR IGNORE INTO group_members (id, group_id, user_id, user_name) VALUES (?, ?, ?, ?)').run('gm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), req.params.id, userId, userName || '')
    res.json(success(null, '已加入'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.get('/groups/:id/messages', (req, res) => {
  try {
    const rows = all<GroupMessageRow>('SELECT * FROM group_messages WHERE group_id=? ORDER BY created_at ASC LIMIT 100', req.params.id)
    res.json(success(rows.map((r: GroupMessageRow) => ({ id: r.id, userId: r.user_id, userName: r.user_name, content: r.content, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

communityRouter.post('/groups/:id/messages', (req, res) => {
  try {
    const { userId, userName, content } = req.body
    if (!userId || !content) return res.json(error('参数不完整'))
    db.prepare('INSERT INTO group_messages (id, group_id, user_id, user_name, content) VALUES (?, ?, ?, ?, ?)').run('gmsg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), req.params.id, userId, userName || '', content)
    res.json(success(null, '已发送'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
