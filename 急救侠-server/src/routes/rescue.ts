import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error } from '../types'
import { authMiddleware, identityOf } from '../middleware/auth'
import type {
  ExternalCertificationRow, UserLeaderRow, EmergencyMobilizationRow,
  MobilizationVolunteerRow, UserAffiliationRow, VolunteerTeamRow,
  TaskMediaRow, LiveSessionRow,
} from '../types/rows'

/**
 * 救援动员 / 队伍 / 现场直播 路由（挂 `/api/rescue`）。
 *
 * ⚠️ **P0-1 鉴权加固**：本文件此前**一个鉴权都没有**，且多处从 `req.body.userId` /
 * `req.query.userId` 取身份 ⇒ 全部可伪造。加固后：
 * 1. **所有端点**均挂 `authMiddleware`（未带 token ⇒ 401）；
 * 2. 身份一律由 {@link identityOf} 从 token 派生（硬约束 #1），**不再信任 body/query**；
 * 3. 跨用户 / 提权 / 状态变更类操作额外做**授权校验**（平台管理员或归属关系），失败 ⇒ 403。
 */
export const rescueRouter = Router()

/**
 * 队伍花名册单次返回上限（P0-1 收尾）。
 *
 * `affiliation` 为空的**最坏情况**已由下方短路挡住（`WHERE u.affiliation=''` 会命中大量空值用户），
 * 但**非空**的超大队伍仍会无界返回 ⇒ 这里再加一道上限，避免一次拉回全队。
 */
const TEAM_ROSTER_LIMIT = 200

/**
 * 平台管理员判定：`users.is_platform_admin`（迁移 036 引入，口径同 `routes/admin.ts:19-26`）。
 * ⚠️ 队伍队长 `is_leader` 属**队伍角色**，不得据此行使平台级权限。
 */
function isPlatformAdmin(userId: string): boolean {
  if (!userId) return false
  const row = get<{ is_platform_admin: number }>(
    'SELECT is_platform_admin FROM users WHERE id = ?', userId
  )
  return !!row?.is_platform_admin
}

/**
 * 机构管理者判定（模板同 `routes/org.ts:74-80`）：
 * 调用者在**任意**机构的 `organization_members.role` 是否为 `admin`/`manager`。
 */
function isOrgManager(userId: string): boolean {
  if (!userId) return false
  const row = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM organization_members WHERE user_id = ? AND role IN ('admin','manager')",
    userId
  )
  return (row?.c ?? 0) > 0
}

/** 「平台管理员 或 机构 admin/manager」——外部认证核实 / 动员审批的准入口径。 */
function isPlatformOrOrgManager(userId: string): boolean {
  return isPlatformAdmin(userId) || isOrgManager(userId)
}

/**
 * 调用者是否是「**指定用户所属机构**」的 admin/manager（★ P0-1 收窄，QA 复核提出）。
 *
 * 与 {@link isOrgManager} 的区别：后者只问「调用者在**任意**机构是不是 admin/manager」
 * ⇒ A 机构的 admin 能核实与 A **毫无关系**的用户的外部认证，并把它置为 `verified`
 * （外部认证同样出现在公开验真页 ⇒ 越权伪造）。本函数要求**双方在同一机构**：
 * 调用者在该机构是 admin/manager ∧ 目标用户也在该机构。
 *
 * 统一原则：**机构维度**的操作必须限定在本机构成员范围内。
 */
function isOrgManagerOf(callerId: string, targetUserId: string): boolean {
  if (!callerId || !targetUserId) return false
  const row = get<{ c: number }>(
    `SELECT COUNT(*) AS c
     FROM organization_members om
     WHERE om.user_id = ? AND om.role IN ('admin','manager')
       AND EXISTS (
         SELECT 1 FROM organization_members t
         WHERE t.org_id = om.org_id AND t.user_id = ?
       )`,
    callerId, targetUserId
  )
  return (row?.c ?? 0) > 0
}

/**
 * 参与者判定（★ P0-2）：调用者是否属于该「救援事件」。
 *
 * 满足任一即为参与者：
 * ① **平台管理员**（{@link isPlatformAdmin}）；
 * ② **动员发起者**：`emergency_mobilizations.id = taskId AND leader_id = callerId`；
 * ③ **已响应的动员志愿者**：`mobilization_volunteers(mobilization_id=taskId, user_id=callerId)`；
 * ④ **已接受任务的救援志愿者**：`task_volunteers(task_id=taskId, user_id=callerId)`。
 *
 * ⚠️ **为什么 ④ 不能省**（动手前已查证，勿照路径名想当然）：
 * `task_media.task_id` 与 `live_sessions.task_id` 都**没有外键**（schema 里是自由 TEXT），
 * 且**与 `emergency_mobilizations.id` 不是同一套 id** ——
 * 唯一的真实调用方 `急救侠-uniapp/src/pages/rescue/task-detail.vue` 把
 * `useTaskStore().tasks[0].id`（即 **`tasks` 表**的 `task_001`）当作 `taskId` 传给
 * `/rescue/mobilizations/:taskId/media` 与 `/rescue/live/:taskId`。
 * 也就是说：路由路径写作 `mobilizations`，实际流量却是 `tasks` 的 id 空间。
 * 只判 ②③ 会让**真实流量里的合法参与者全部 403**，故 ④ 是主判据、②③ 是路径口径兜底。
 */
function isMobilizationParticipant(taskId: string, callerId: string): boolean {
  if (!taskId || !callerId) return false
  if (isPlatformAdmin(callerId)) return true
  // ② 动员发起者
  const mob = get<{ leader_id: string }>(
    'SELECT leader_id FROM emergency_mobilizations WHERE id = ?', taskId
  )
  if (mob?.leader_id === callerId) return true
  // ③ 已响应的动员志愿者
  const mv = get<{ c: number }>(
    'SELECT COUNT(*) AS c FROM mobilization_volunteers WHERE mobilization_id = ? AND user_id = ?',
    taskId, callerId
  )
  if ((mv?.c ?? 0) > 0) return true
  // ④ 已接受任务的救援志愿者（`tasks` id 空间，实际流量口径）
  const tv = get<{ c: number }>(
    'SELECT COUNT(*) AS c FROM task_volunteers WHERE task_id = ? AND user_id = ?',
    taskId, callerId
  )
  return (tv?.c ?? 0) > 0
}

rescueRouter.post('/certification', authMiddleware, (req, res) => {
  try {
    // ★ P0-1： userId 不再取自 body（可伪造 ⇒ 可替他人提交认证），一律 token 派生。
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { type, issuer, certNumber, issueDate, expiryDate, fileUrl } = req.body
    if (!type) return res.json(error('参数不完整'))
    db.prepare('INSERT INTO external_certifications (id, user_id, type, issuer, cert_number, issue_date, expiry_date, file_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run('ec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), userId, type, issuer || '', certNumber || '', issueDate || '', expiryDate || '', fileUrl || '')
    res.json(success(null, '认证已提交'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.get('/certifications', authMiddleware, (req, res) => {
  try {
    // ★ P0-1：不再信任 query.userId（换成任意 userId 即可读他人认证），一律 token 派生。
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const rows = all<ExternalCertificationRow>('SELECT * FROM external_certifications WHERE user_id=? ORDER BY created_at DESC', userId)
    res.json(success(rows.map((r: ExternalCertificationRow) => ({ id: r.id, type: r.type, issuer: r.issuer, certNumber: r.cert_number, issueDate: r.issue_date, expiryDate: r.expiry_date, fileUrl: r.file_url, status: r.status }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.put('/certification/:id/verify', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    // ★★ P0-1 最关键一处：打断「自闭环伪造链」。
    // 此前**任何人**都能把自己刚提交的认证置为 verified，而外部认证会出现在公开验真页
    // （`public/verify`）⇒ 等于毫无成本地伪造已核实资质。
    // 现要求调用者是**平台管理员**或**机构 admin/manager**，提交者自助核实 ⇒ 403。
    // （放在取记录之前：无权限者连"这条认证是否存在"都不该探到 ⇒ 403 而非 404。）
    if (!isPlatformOrOrgManager(callerId)) {
      return res.status(403).json(error('无权核实认证，仅平台管理员或机构管理员可执行'))
    }
    const exist = get<{ id: string; user_id: string }>('SELECT id, user_id FROM external_certifications WHERE id=?', req.params.id)
    if (!exist) return res.status(404).json(error('认证不存在'))
    // ★★ P0-1 收窄（QA 复核）：机构维度操作必须限定在本机构成员范围内。
    // 仅 `isOrgManager` 时，A 机构 admin 可核实**与 A 无关**的用户 ⇒ 越权。
    // 现在：平台管理员不限；机构 admin/manager **只能核实本机构成员**的认证。
    if (!isPlatformAdmin(callerId) && !isOrgManagerOf(callerId, exist.user_id)) {
      return res.status(403).json(error('无权核实该认证，仅平台管理员或其所属机构管理员可执行'))
    }
    db.prepare("UPDATE external_certifications SET status='verified' WHERE id=?").run(req.params.id)
    res.json(success(null, '已认证'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.post('/mobilize', authMiddleware, (req, res) => {
  try {
    // ★ P0-1：leaderId 不再取自 body（可伪造 ⇒ 可冒名他人发起动员），发起人恒为调用者本人。
    const leaderId = identityOf(req)
    if (!leaderId) return res.status(401).json(error('未登录'))
    const { title, description, type, address, lat, lng, volunteersNeeded, leaderName } = req.body
    if (!title) return res.json(error('参数不完整'))
    // 依赖**队伍角色**（`is_leader`）：发起救援动员是队长职责，与平台管理面无关，
    // 故拆分后仍判 `is_leader`；仅具平台管理员身份者不得据此发起动员。
    // （leaderId 现恒为调用者本人 ⇒ 该判据天然只可能作用于自己，无法再冒名他人。）
    const leader = get<UserLeaderRow>('SELECT is_leader FROM users WHERE id=?', leaderId)
    if (!leader || !leader.is_leader) return res.json(error('只有认证救援领导者才能发起动员'))
    const mid = 'mob_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    db.prepare('INSERT INTO emergency_mobilizations (id, title, description, type, address, lat, lng, volunteers_needed, leader_id, leader_name) VALUES (?,?,?,?,?,?,?,?,?,?)').run(mid, title, description || '', type || 'rescue', address || '', lat || 0, lng || 0, volunteersNeeded || 5, leaderId, leaderName || '')
    res.json(success({ id: mid }, '动员已发起，等待平台审批'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// ★ P0-2：**这是有意保留的「公开读」**，不是漏网之鱼 —— 救援动员是**公开招募**，
// 志愿者必须能看见列表才能响应（收紧会直接摧毁「响应动员」这条主链路）。
// 因此这里只保留登录门槛，不做参与者过滤。
// 返回值也刻意只映射出 `address`（字符串）而**不含 `lat`/`lng`** ⇒ 精确定位不随列表外泄。
rescueRouter.get('/mobilizations', authMiddleware, (_req, res) => {
  try {
    const rows = all<EmergencyMobilizationRow>('SELECT * FROM emergency_mobilizations ORDER BY created_at DESC LIMIT 20')
    res.json(success(rows.map((r: EmergencyMobilizationRow) => ({ id: r.id, title: r.title, description: r.description, type: r.type, address: r.address, volunteersNeeded: r.volunteers_needed, volunteersResponded: r.volunteers_responded, leaderId: r.leader_id, leaderName: r.leader_name, status: r.status, approvedBy: r.approved_by, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.put('/mobilizations/:id/approve', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    // ★ P0-1：审批是跨用户操作，且内含 `UPDATE users SET is_organizer = 1`（提权写），
    // 此前任何人都能批准并把某人提升为 organizer ⇒ 自提 trendsetter 权限。
    // 现要求调用者是**平台管理员**或**机构 admin/manager**。
    if (!isPlatformOrOrgManager(callerId)) {
      return res.status(403).json(error('无权审批动员，仅平台管理员或机构管理员可执行'))
    }
    // approvedBy 同样取自 token（原取自 body，可伪造审批人留痕）。
    const mob = get<{ leader_id: string }>('SELECT leader_id FROM emergency_mobilizations WHERE id=?', req.params.id)
    db.prepare("UPDATE emergency_mobilizations SET status='active', approved_by=?, approved_at=datetime('now') WHERE id=?").run(callerId, req.params.id)
    if (mob) db.prepare('UPDATE users SET is_organizer = 1 WHERE id = ?').run(mob.leader_id)
    res.json(success(null, '已批准'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.put('/mobilizations/:id/complete', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    // ★ P0-1：此前**任意用户**可把任意动员置为 completed（篡改他人救援任务状态）。
    // 现限定为**发起者本人**或**平台管理员**。
    const mob = get<{ leader_id: string }>('SELECT leader_id FROM emergency_mobilizations WHERE id=?', req.params.id)
    if (!mob) return res.status(404).json(error('动员不存在'))
    if (mob.leader_id !== callerId && !isPlatformAdmin(callerId)) {
      return res.status(403).json(error('无权结束该动员，仅发起者或平台管理员可执行'))
    }
    db.prepare("UPDATE emergency_mobilizations SET status='completed' WHERE id=?").run(req.params.id)
    res.json(success(null, '已结束'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.post('/mobilizations/:id/respond', authMiddleware, (req, res) => {
  try {
    // ★ P0-1：userId 不再取自 body（可伪造 ⇒ 替他人"响应"动员）。
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { userName } = req.body
    db.prepare('INSERT OR IGNORE INTO mobilization_volunteers (id, mobilization_id, user_id, user_name) VALUES (?,?,?,?)').run('mv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), req.params.id, userId, userName || '')
    db.prepare('UPDATE emergency_mobilizations SET volunteers_responded = volunteers_responded + 1 WHERE id=?').run(req.params.id)
    res.json(success(null, '已响应'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.get('/mobilizations/:id/volunteers', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    // ★ P0-2：此前**任意登录用户**传任意 `id` 即可读到**任意动员的志愿者名单**
    // （谁响应了哪场救援 —— 行踪 + 社交关系）。现限定为参与者（发起者 / 已响应志愿者 / 平台管理员）。
    // 先判权限、再取记录：无权限者连「该动员是否存在」都不该探到 ⇒ 一律 403（而非 404）。
    if (!isMobilizationParticipant(req.params.id, callerId)) {
      return res.status(403).json(error('无权查看该动员的志愿者名单，仅参与者或平台管理员可查看'))
    }
    const rows = all<MobilizationVolunteerRow>('SELECT * FROM mobilization_volunteers WHERE mobilization_id=?', req.params.id)
    res.json(success(rows.map((r: MobilizationVolunteerRow) => ({ userId: r.user_id, userName: r.user_name, status: r.status, respondedAt: r.responded_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

rescueRouter.get('/team', authMiddleware, (req, res) => {
  try {
    // 依赖**队伍角色**（`is_leader`）：队伍成员花名册按队长所属队伍（affiliation）返回，
    // 与平台管理面无关，故拆分后仍判 `is_leader`。
    // ★ P0-1：leader 不再取自 query.leaderId（换成任意 leaderId 即可看他人队伍，且
    // affiliation 为空时会退化为 `WHERE u.affiliation=''` ⇒ 返回接近全表的用户清单）。
    // 现 leader 恒为调用者本人（须 `is_leader=1`），并对空 affiliation 做短路。
    const leaderId = identityOf(req)
    if (!leaderId) return res.status(401).json(error('未登录'))
    const leader = get<UserAffiliationRow>('SELECT affiliation FROM users WHERE id=? AND is_leader=1', leaderId)
    if (!leader) return res.json(error('非认证领导者'))
    const affiliation = (leader.affiliation ?? '').trim()
    // ★★ P0-1 空值短路：affiliation 为空 ⇒ SQL 会退化成 `WHERE u.affiliation=''`，
    // 而大量用户 affiliation 恰为空串 ⇒ 无 LIMIT 地返回近乎全表用户。此处直接返回空花名册。
    if (!affiliation) return res.json(success([]))
    // ★ P0-1 收尾：非空 affiliation 仍可能对应超大队伍 ⇒ 加上限，避免无界返回。
    const rows = all<VolunteerTeamRow>("SELECT u.id, u.name, u.avatar, u.tier, u.rescue_count, u.city FROM users u WHERE u.affiliation=? ORDER BY u.rescue_count DESC LIMIT ?", affiliation, TEAM_ROSTER_LIMIT)
    res.json(success(rows.map((r: VolunteerTeamRow) => ({ id: r.id, name: r.name, avatar: r.avatar, tier: r.tier, rescueCount: r.rescue_count, city: r.city }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

/* ──── Task Media (现场实时更新) ──── */

// GET /api/rescue/mobilizations/:taskId/media
rescueRouter.get('/mobilizations/:taskId/media', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    // ★★ P0-2 · **本批最高危**：返回体含 `lat`/`lng`，即**现场志愿者的实时 GPS**。
    // 此前任意登录用户传任意 `taskId` 即可拿到他人的实时位置（人身安全级别泄露）。
    // 现限定为参与者（见 {@link isMobilizationParticipant} 的 id 空间说明）。
    // 先判权限、再取记录 ⇒ 无权限者探不到「该 taskId 是否存在」（403 而非 404/空数组）。
    if (!isMobilizationParticipant(req.params.taskId, callerId)) {
      return res.status(403).json(error('无权查看该任务的现场动态，仅参与者或平台管理员可查看'))
    }
    const rows = all<TaskMediaRow>('SELECT * FROM task_media WHERE task_id = ? ORDER BY created_at DESC LIMIT 50', req.params.taskId)
    res.json(success(rows.map((r: TaskMediaRow) => ({
      id: r.id, taskId: r.task_id,
      userId: r.user_id, userName: r.user_name, userAvatar: r.user_avatar,
      type: r.type, content: r.content, mediaUrl: r.media_url,
      lat: r.lat, lng: r.lng, createdAt: r.created_at,
    }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// GET /api/rescue/live/:taskId
rescueRouter.get('/live/:taskId', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    // ★ P0-2：直播会话与现场动态同源（`live_sessions.task_id` 同为 `tasks` id 空间），
    // 此前任意登录用户可枚举任意 taskId 的在线直播者。同样限定为参与者。
    if (!isMobilizationParticipant(req.params.taskId, callerId)) {
      return res.status(403).json(error('无权查看该任务的直播会话，仅参与者或平台管理员可查看'))
    }
    const rows = all<LiveSessionRow>("SELECT * FROM live_sessions WHERE task_id=? AND ended_at IS NULL ORDER BY started_at DESC", req.params.taskId)
    res.json(success(rows.map((r: LiveSessionRow) => ({ id:r.id,taskId:r.task_id,userId:r.user_id,userName:r.user_name,userAvatar:r.user_avatar,deviceInfo:r.device_info,startedAt:r.started_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// POST /api/rescue/live/:taskId/start
rescueRouter.post('/live/:taskId/start', authMiddleware, (req, res) => {
  try {
    // ★ P0-1：userId 不再取自 body（可伪造 ⇒ 冒名开直播）。
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { userName, userAvatar, deviceInfo } = req.body
    const lid = 'live_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    db.prepare('INSERT INTO live_sessions (id,task_id,user_id,user_name,user_avatar,device_info) VALUES (?,?,?,?,?,?)').run(lid, req.params.taskId, userId, userName||'', userAvatar||'', deviceInfo||'')
    db.prepare('INSERT INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content) VALUES (?,?,?,?,?,?,?)').run('tm_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), req.params.taskId, userId, userName||'', userAvatar||'', 'status', '🔴 '+(userName||'志愿者')+' 正在现场直播')
    res.json(success({ id: lid }, '直播已开始'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// POST /api/rescue/live/end/:sessionId
rescueRouter.post('/live/end/:sessionId', authMiddleware, (req, res) => {
  try {
    const callerId = identityOf(req)
    if (!callerId) return res.status(401).json(error('未登录'))
    // ★ P0-1：此前**任意用户**可结束任意直播（篡改他人直播状态）。
    // 先读取会话以判定归属（必须在 UPDATE **之前**校验，否则等于先斩后奏）。
    const s = get<LiveSessionRow>('SELECT * FROM live_sessions WHERE id=?', req.params.sessionId)
    if (!s) return res.status(404).json(error('直播不存在'))
    if (s.user_id !== callerId && !isPlatformAdmin(callerId)) {
      return res.status(403).json(error('无权结束该直播，仅主播本人或平台管理员可执行'))
    }
    db.prepare("UPDATE live_sessions SET ended_at = datetime('now') WHERE id = ?").run(req.params.sessionId)
    db.prepare('INSERT INTO task_media (id,task_id,user_id,user_name,user_avatar,type,content) VALUES (?,?,?,?,?,?,?)').run('tm_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), s.task_id, s.user_id, s.user_name, s.user_avatar, 'status', (s.user_name||'志愿者')+' 直播已结束')
    res.json(success(null, '直播已结束'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

// POST /api/rescue/mobilizations/:taskId/media
rescueRouter.post('/mobilizations/:taskId/media', authMiddleware, (req, res) => {
  try {
    // ★ P0-1：userId 不再取自 body；本端点含他人 GPS 坐标，冒名危害大。
    const userId = identityOf(req)
    if (!userId) return res.status(401).json(error('未登录'))
    const { userName, userAvatar, type, content, mediaUrl, lat, lng } = req.body
    const mid = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    db.prepare('INSERT INTO task_media (id, task_id, user_id, user_name, user_avatar, type, content, media_url, lat, lng) VALUES (?,?,?,?,?,?,?,?,?,?)').run(mid, req.params.taskId, userId, userName||'', userAvatar||'', type||'text', content||'', mediaUrl||'', lat||0, lng||0)
    res.json(success({ id: mid }, '已发布'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
