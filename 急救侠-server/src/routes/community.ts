import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error } from '../types'
import { authMiddleware, identityOf } from '../middleware/auth'
import type {
  NearbyVolunteerRow, MessageRow, GroupWithMemberCountRow,
  GroupMessageRow, AedManagerRow,
} from '../types/rows'

export const communityRouter = Router()

/** `GET /nearby` 的 `radius` 下限（米）——低于此值没有业务意义，且会产生退化的极小包围盒。 */
const NEARBY_RADIUS_MIN = 100
/** `GET /nearby` 的 `radius` 上限（米）——防止一次请求拉回全表坐标。 */
const NEARBY_RADIUS_MAX = 10000
/** `radius` 缺省值（米）——沿用加固前的默认口径，避免改动既有调用方行为。 */
const NEARBY_RADIUS_DEFAULT = 5000
/**
 * 位置新鲜度窗口（小时）——超过此窗口未更新的 GPS 不再出现在「附近的人」里。
 * （陈旧坐标既无救援价值，继续暴露又构成隐私风险。）
 */
const NEARBY_FRESHNESS_HOURS = 24
/** SQLite `datetime()` 修饰符；由常量数字拼出，无注入面。 */
const NEARBY_FRESHNESS_MODIFIER = `-${NEARBY_FRESHNESS_HOURS} hours`

/**
 * 把 `radius` 钳制到 `[NEARBY_RADIUS_MIN, NEARBY_RADIUS_MAX]`。
 *
 * 非数字（缺失 / `abc` / 空串）回落到缺省值，与加固前一致。
 *
 * @param raw `req.query.radius` 原值。
 * @returns 落在合法区间内的半径（米）。
 */
function clampRadius(raw: unknown): number {
  const parsed = Number.parseFloat(String(raw ?? ''))
  if (!Number.isFinite(parsed)) return NEARBY_RADIUS_DEFAULT
  return Math.min(NEARBY_RADIUS_MAX, Math.max(NEARBY_RADIUS_MIN, parsed))
}

/**
 * 解析经纬度；非法值返回 `null`（由调用方转成参数错误）。
 *
 * @param raw `req.query.lat` / `req.query.lng` 原值。
 * @param limit 该坐标的取值上限（纬度 90、经度 180）。
 * @returns 合法坐标数值；非法时 `null`。
 */
function parseCoordinate(raw: unknown, limit: number): number | null {
  const parsed = Number.parseFloat(String(raw ?? ''))
  if (!Number.isFinite(parsed) || Math.abs(parsed) > limit) return null
  return parsed
}

/**
 * 判断调用者是否为指定群组的成员。
 *
 * @param groupId `volunteer_groups.id`。
 * @param userId 调用者身份（token 派生）。
 * @returns 成员为 `true`；否则 `false`。
 */
function isGroupMember(groupId: string, userId: string): boolean {
  const row = get<{ id: string }>(
    'SELECT id FROM group_members WHERE group_id=? AND user_id=? LIMIT 1', groupId, userId
  )
  return row != null
}

/**
 * ★ P0-2：`POST /location` 此前有三处问题（本次最高危端点之一）：
 * ① **完全无鉴权** ⇒ 任何人可上报任意坐标；
 * ② 身份取自 `req.body.userId` ⇒ 可把 GPS 记在**他人名下**（伪造他人行踪轨迹）；
 * ③ **最易漏的一处**：`UPDATE aed_devices ... WHERE linked_user_id = body.userId`
 *    ⇒ 可篡改**他人名下移动 AED 的坐标**。AED 位置是救命数据，被改等于把求救者导向错误地点。
 *
 * 现一律绑定 `identityOf(req)`（JWT 派生）：位置记录与移动 AED 坐标都只作用于**调用者本人**。
 * `userName` 仍取自 body —— 那是**显示名**，不是身份判据。
 */
communityRouter.post('/location', authMiddleware, (req, res) => {
  try {
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { userName, lat, lng } = req.body
    if (lat == null || lng == null) return res.json(error('参数不完整'))
    db.prepare('INSERT OR REPLACE INTO volunteer_locations (id, user_id, user_name, lat, lng, updated_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))').run('vl_' + userId, userId, userName || '', lat, lng)
    // Sync mobile AED positions —— ★ 绑定 token 身份，绝不绑定 body.userId（否则可改他人 AED 坐标）
    db.prepare('UPDATE aed_devices SET lat = ?, lng = ? WHERE linked_user_id = ? AND is_mobile = 1').run(lat, lng, userId)
    res.json(success(null, '位置已更新'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/**
 * ★ P0-2：`GET /nearby` 此前**匿名**即可枚举他人实时 GPS —— 他人坐标属最敏感的一类数据。
 * 四处一并收紧：
 * ① 必须登录（`authMiddleware`）；
 * ② `radius` 未做上限 ⇒ 传一个极大 `radius` 即可**一次拉回全表**坐标。现钳制到 [100, 10000] 米；
 * ③ `lat`/`lng` 非法时此前静默取 0（等价于变成一个以 0°,0° 为中心的超大矩形，同样近于全表），
 *    现返回 400 参数错误；
 * ④ 只返回**最近 24 小时内**更新过的位置，陈旧 GPS 不再继续暴露。
 *
 * ⚠️ **P1 待办**：本批**故意未加** `AND u.is_public = 1` 过滤（`users.is_public`，迁移 028）。
 * 该列定义为 `is_public INTEGER NOT NULL DEFAULT 0`（见 `src/db.ts` 建表 + 迁移 028），
 * 默认值为 **0** ⇒ 一旦加上该条件，尚未主动开启公开档案的用户会被全部滤掉，
 * 「附近志愿者」功能将**整体归零**。待前端提供「公开我的位置」开关并完成存量回填后再引入。
 */
communityRouter.get('/nearby', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    const lat = parseCoordinate(req.query.lat, 90)
    const lng = parseCoordinate(req.query.lng, 180)
    if (lat === null || lng === null) return res.status(400).json(error('lat/lng 参数非法'))
    const radius = clampRadius(req.query.radius)
    const dlat = radius / 111000
    const dlng = radius / (111000 * Math.cos(lat * Math.PI / 180))
    const rows = all<NearbyVolunteerRow>(`SELECT vl.*, u.tier, u.rescue_count FROM volunteer_locations vl JOIN users u ON u.id=vl.user_id WHERE vl.lat BETWEEN ? AND ? AND vl.lng BETWEEN ? AND ? AND vl.updated_at >= datetime('now', '${NEARBY_FRESHNESS_MODIFIER}') ORDER BY ((vl.lat-?)*(vl.lat-?) + (vl.lng-?)*(vl.lng-?)) ASC LIMIT 30`, lat - dlat, lat + dlat, lng - dlng, lng + dlng, lat, lat, lng, lng)
    res.json(success(rows.map((r: NearbyVolunteerRow) => ({ userId: r.user_id, userName: r.user_name, tier: r.tier, rescueCount: r.rescue_count, lat: r.lat, lng: r.lng, updatedAt: r.updated_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-1：不再信任 `query.userId`（换成任意 userId 即可读他人私信正文 ⇒ 隐私泄露，Top3）。
// 现恒返回**调用者本人**收发到的私信。
communityRouter.get('/messages', authMiddleware, (req, res) => {
  try {
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const rows = all<MessageRow>('SELECT * FROM messages WHERE from_user_id=? OR to_user_id=? ORDER BY created_at DESC LIMIT 50', userId, userId)
    res.json(success(rows.map((r: MessageRow) => ({ id: r.id, fromUserId: r.from_user_id, fromUserName: r.from_user_name, toUserId: r.to_user_id, content: r.content, isRead: r.is_read === 1, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-1：`fromUserId` 不再取自 body（可伪造 ⇒ 冒用他人身份发私信），一律 token 派生。
// `toUserId` 保留在 body —— 那是**收件人**（正常业务目标），不是调用者身份。
communityRouter.post('/messages', authMiddleware, (req, res) => {
  try {
    const fromUserId = identityOf(req)
    if (!fromUserId) return res.status(401).json(error('未登录'))
    const { fromUserName, toUserId, content } = req.body
    if (!toUserId || !content) return res.json(error('参数不完整'))
    db.prepare('INSERT INTO messages (id, from_user_id, from_user_name, to_user_id, content) VALUES (?, ?, ?, ?, ?)').run('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), fromUserId, fromUserName || '', toUserId, content)
    res.json(success(null, '已发送'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-1：`fromUserId` 不再取自 body（可伪造 ⇒ 冒用他人身份联系 AED 维护者）。
communityRouter.post('/contact-aed/:aedId', authMiddleware, (req, res) => {
  try {
    const fromUserId = identityOf(req)
    if (!fromUserId) return res.status(401).json(error('未登录'))
    const aed = get<{ name: string }>('SELECT name FROM aed_devices WHERE id=?', req.params.aedId)
    if (!aed) return res.json(error('AED 不存在'))
    const mgr = get<AedManagerRow>("SELECT * FROM aed_managers WHERE aed_id=? AND role='primary' LIMIT 1", req.params.aedId)
    if (!mgr) return res.json(error('该 AED 暂无维护者'))
    const { fromUserName, content } = req.body
    db.prepare('INSERT INTO messages (id, from_user_id, from_user_name, to_user_id, content) VALUES (?, ?, ?, ?, ?)').run('msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), fromUserId, fromUserName || '', mgr.user_id, `[${aed.name}] ${content}`)
    res.json(success(null, '已发送给 AED 维护者'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-2：群组列表属于社区内容（含群名 / 简介 / 创建者 id），此前**匿名可读**。现要求登录。
// 登录即可见，不再细分到群成员 —— 群组本身是半公开的招募入口。
communityRouter.get('/groups', authMiddleware, (_req, res) => {
  try {
    const rows = all<GroupWithMemberCountRow>('SELECT g.*, (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) as mc FROM volunteer_groups g ORDER BY g.created_at DESC')
    res.json(success(rows.map((r: GroupWithMemberCountRow) => ({ id: r.id, name: r.name, description: r.description, createdBy: r.created_by, memberCount: r.mc, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-2：`createdBy` 此前取自 body ⇒ 可把任意群组挂到**他人名下**（伪造他人创建的群，用于钓鱼/名誉攻击）。
// 现 `createdBy` 由 token 派生；`createdByName` 保留在 body —— 那是**显示名**，不是身份判据。
communityRouter.post('/groups', authMiddleware, (req, res) => {
  try {
    const createdBy = identityOf(req)
    if (!createdBy) return res.status(401).json(error('未登录'))
    const { name, description, createdByName } = req.body
    if (!name) return res.json(error('name 不能为空'))
    const gid = 'grp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    db.prepare('INSERT INTO volunteer_groups (id, name, description, created_by) VALUES (?, ?, ?, ?)').run(gid, name, description || '', createdBy)
    db.prepare('INSERT OR IGNORE INTO group_members (id, group_id, user_id, user_name) VALUES (?, ?, ?, ?)').run('gm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), gid, createdBy, createdByName || '')
    res.json(success({ id: gid }, '群组已创建'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-2：此前匿名且 `userId` 取自 body ⇒ 可把**任意用户**拉进任意群组（伪造成员关系，
// 让受害者出现在与己无关的群里；也是绕过下方「群成员」判据的入口 ⇒ 必须一并收死）。
// 现成员身份由 token 派生；`userName` 保留在 body —— **显示名**，不是身份判据。
communityRouter.post('/groups/:id/join', authMiddleware, (req, res) => {
  try {
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { userName } = req.body
    db.prepare('INSERT OR IGNORE INTO group_members (id, group_id, user_id, user_name) VALUES (?, ?, ?, ?)').run('gm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), req.params.id, userId, userName || '')
    res.json(success(null, '已加入'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-2：群聊消息此前**匿名可读** ⇒ 知道 group id 就能拉走整个群的聊天正文。
// 现要求登录 **且** 调用者必须是本群成员，否则 403。
// 注：非成员一律 403（含「群不存在」的情形）—— 不返回 404，避免用状态码探测该 id 是否存在。
communityRouter.get('/groups/:id/messages', authMiddleware, (req, res) => {
  try {
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    if (!isGroupMember(req.params.id, userId)) return res.status(403).json(error('无权查看该群消息'))
    const rows = all<GroupMessageRow>('SELECT * FROM group_messages WHERE group_id=? ORDER BY created_at ASC LIMIT 100', req.params.id)
    res.json(success(rows.map((r: GroupMessageRow) => ({ id: r.id, userId: r.user_id, userName: r.user_name, content: r.content, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-2：此前匿名 + `userId` 取自 body ⇒ 非成员可往任意群灌私信内容、并冒用他人身份发言。
// 现要求登录 **且** 是本群成员才能发言；`userId` 由 token 派生，`userName` 保留在 body（显示名）。
communityRouter.post('/groups/:id/messages', authMiddleware, (req, res) => {
  try {
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    if (!isGroupMember(req.params.id, userId)) return res.status(403).json(error('无权在该群发言'))
    const { userName, content } = req.body
    if (!content) return res.json(error('参数不完整'))
    db.prepare('INSERT INTO group_messages (id, group_id, user_id, user_name, content) VALUES (?, ?, ?, ?, ?)').run('gmsg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), req.params.id, userId, userName || '', content)
    res.json(success(null, '已发送'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
