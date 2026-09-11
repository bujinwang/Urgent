/**
 * 政府数据监管看板路由（P2-8）
 *
 * 鉴权：/me 与 /dashboard 走 `govMiddleware`（独立 gov 令牌 + gov_viewers.active 回查）；
 *       /viewers* 管理端点走业务 `authMiddleware` + 内联 is_leader 校验。
 * 脱敏：**响应零 PII**（无姓名/手机/任何 *_user_id），仅输出计数/比率/分布/district/channel。
 * 口径：district 归一化 `COALESCE(NULLIF(district,''),'__UNASSIGNED__')`（未分区不排除）；
 *       冷启动无样本 → 指标返 `null`（禁止用 0 冒充）。
 */

import { Router, Request } from 'express'
import db, { get, all } from '../db'
import {
  success, error,
  GovLoginInput, GovViewerInput, GovViewerUpdateInput,
} from '../types'
import type {
  GovDashboard, GovMeta, GovResponseTime, GovAed, GovTasks,
  GovRescue, GovPeople, GovDistrictRow, GovTrendPoint, GovChannelRow,
} from '../types'
import type { GovViewerRow, NamedCountRow } from '../types/rows'
import { validate } from '../middleware/validate'
import { authMiddleware } from '../middleware/auth'
import type { AuthPayload } from '../middleware/auth'
import {
  govMiddleware, govContextOf, signGovToken, hashPassword, verifyPassword,
  parseDistricts,
} from '../middleware/govAuth'
import type { GovContext } from '../middleware/govAuth'

export const govRouter = Router()

/** 读取路由参数为字符串（`validate` 中间件会使 `req.params` 推导为 ParamsDictionary）。 */
function paramStr(req: Request, name: string): string {
  const v = (req.params as Record<string, string | string[] | undefined>)[name]
  return Array.isArray(v) ? (v[0] || '') : (v || '')
}

const UNASSIGNED = '__UNASSIGNED__'
/** district 归一化表达式（唯一权威口径） */
const DISTRICT_EXPR = "COALESCE(NULLIF(district,''),'__UNASSIGNED__')"
const DAY_MS = 86400000

type Param = string | number

/** 按 query district 生成 district 直连过滤片段（aed_devices/tasks）。 */
function districtFilter(district?: string): { sql: string; params: Param[] } {
  if (!district) return { sql: '', params: [] }
  if (district === UNASSIGNED) return { sql: " AND (district IS NULL OR district='')", params: [] }
  return { sql: ' AND district = ?', params: [district] }
}

/** 按 district 生成“经 aed_devices 关联”的过滤片段（alerts/pickups）。 */
function aedDistrictFilter(district?: string): { sql: string; params: Param[] } {
  if (!district) return { sql: '', params: [] }
  return {
    sql: ` AND aed_id IN (SELECT id FROM aed_devices WHERE ${DISTRICT_EXPR} = ?)`,
    params: [district],
  }
}

/** nearest-rank P95（无样本 → null） */
function p95(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.max(0, Math.ceil(0.95 * sorted.length) - 1)
  return sorted[idx]
}

const DATA_GAPS = [
  'coverage_denominator:人口/面积基线缺失，M2/M3 仅标注',
  'district_dimension:district 待录入/回填',
]

// ---------- 指标构建（纯计数/比率，无 PII） ----------

function buildResponseTime(fromMs: number, toMs: number, district?: string): GovResponseTime {
  const f = aedDistrictFilter(district)

  const alertRow = get<{ total: number; expired: number | null }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status='expired' THEN 1 ELSE 0 END) AS expired
     FROM aed_custodian_alerts WHERE notify_time_ms BETWEEN ? AND ?${f.sql}`,
    fromMs, toMs, ...f.params
  )
  const alertTotal = alertRow?.total ?? 0
  const expired = alertRow?.expired ?? 0
  const hasData = alertTotal > 0
  const noResponseRate = alertTotal > 0 ? expired / alertTotal : null

  const latRows = all<{ v: number }>(
    `SELECT response_latency_ms AS v FROM aed_custodian_alerts
     WHERE status IN ('acknowledged','rejected') AND response_latency_ms IS NOT NULL
       AND notify_time_ms BETWEEN ? AND ?${f.sql}`,
    fromMs, toMs, ...f.params
  )
  const latencies = latRows.map((r) => r.v)

  const slaRow = get<{ n: number; ok: number | null }>(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN sla_met=1 THEN 1 ELSE 0 END) AS ok
     FROM aed_custodian_alerts
     WHERE notify_time_ms BETWEEN ? AND ? AND responded_time_ms IS NOT NULL AND sla_met IS NOT NULL${f.sql}`,
    fromMs, toMs, ...f.params
  )
  const slaN = slaRow?.n ?? 0
  const slaOk = slaRow?.ok ?? 0

  const chRows = all<NamedCountRow>(
    `SELECT channel AS key, COUNT(*) AS cnt FROM aed_custodian_alerts
     WHERE notify_time_ms BETWEEN ? AND ?${f.sql} GROUP BY channel`,
    fromMs, toMs, ...f.params
  )
  const channelDistribution: GovChannelRow[] = chRows.map((r) => ({
    channel: r.key, count: r.cnt, ratio: alertTotal > 0 ? r.cnt / alertTotal : 0,
  }))

  const trendRows = all<{ d: string; v: number | null }>(
    `SELECT date(notify_time_ms/1000,'unixepoch') AS d, response_latency_ms AS v
     FROM aed_custodian_alerts WHERE notify_time_ms BETWEEN ? AND ?${f.sql} ORDER BY d ASC`,
    fromMs, toMs, ...f.params
  )
  const byDay = new Map<string, number[]>()
  for (const r of trendRows) {
    if (!r.d) continue
    const arr = byDay.get(r.d) || []
    if (r.v !== null) arr.push(r.v)
    byDay.set(r.d, arr)
  }
  const trend: GovTrendPoint[] = [...byDay.entries()].map(([date, vals]) => ({
    date, p95Ms: p95(vals), count: vals.length,
  }))

  return {
    hasData,
    sampleSize: latencies.length,
    p95Ms: p95(latencies),
    slaRate: slaN > 0 ? slaOk / slaN : null,
    noResponseRate,
    alertTotal,
    trend,
    channelDistribution,
  }
}

function buildAed(fromMs: number, toMs: number, district?: string): GovAed {
  const f = districtFilter(district)
  const row = get<{ total: number; available: number | null }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) AS available
     FROM aed_devices WHERE 1=1${f.sql}`,
    ...f.params
  )
  const total = row?.total ?? 0
  const available = row?.available ?? 0

  const af = aedDistrictFilter(district)
  const isoFrom = new Date(fromMs).toISOString()
  const isoTo = new Date(toMs).toISOString()
  const pickupsRow = get<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM aed_pickups
     WHERE date(pickup_time) BETWEEN date(?) AND date(?)${af.sql}`,
    isoFrom, isoTo, ...af.params
  )
  const activeRow = get<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM aed_pickups WHERE return_time IS NULL')

  return {
    total,
    available,
    availabilityRate: total > 0 ? available / total : null,
    pickups: pickupsRow?.cnt ?? 0,
    activePickups: activeRow?.cnt ?? 0,
    // 覆盖率：分母（人口/面积基线）缺失 → 恒 null + dataGap，不做除法、不显示 0
    coverage: { per10k: null, perKm2: null, dataGap: true },
  }
}

function buildTasks(fromMs: number, toMs: number, district?: string): GovTasks {
  const f = districtFilter(district)
  const isoFrom = new Date(fromMs).toISOString()
  const isoTo = new Date(toMs).toISOString()

  const row = get<{ total: number; completed: number | null }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
     FROM tasks WHERE date(created_at) BETWEEN date(?) AND date(?)${f.sql}`,
    isoFrom, isoTo, ...f.params
  )
  const total = row?.total ?? 0
  const completed = row?.completed ?? 0

  const types = all<NamedCountRow>(
    `SELECT type AS key, COUNT(*) AS cnt FROM tasks
     WHERE date(created_at) BETWEEN date(?) AND date(?)${f.sql} GROUP BY type`,
    isoFrom, isoTo, ...f.params
  )
  const hours = all<{ hour: number; cnt: number }>(
    `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS cnt FROM tasks
     WHERE date(created_at) BETWEEN date(?) AND date(?)${f.sql} GROUP BY hour ORDER BY hour`,
    isoFrom, isoTo, ...f.params
  )

  return {
    total,
    completed,
    completionRate: total > 0 ? completed / total : null,
    typeDistribution: types.map((t) => ({ type: t.key, count: t.cnt })),
    hourlyDistribution: hours.map((h) => ({ hour: h.hour, count: h.cnt })),
  }
}

function buildRescue(fromMs: number, toMs: number): GovRescue {
  const isoFrom = new Date(fromMs).toISOString()
  const isoTo = new Date(toMs).toISOString()
  const rr = get<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM rescue_records WHERE date(date) BETWEEN date(?) AND date(?)',
    isoFrom, isoTo
  )
  const rc = get<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM rescue_cases WHERE date(date) BETWEEN date(?) AND date(?)',
    isoFrom, isoTo
  )
  return { records: rr?.cnt ?? 0, cases: rc?.cnt ?? 0 }
}

function buildPeople(): GovPeople {
  const cert = get<{ cnt: number }>("SELECT COUNT(DISTINCT user_id) AS cnt FROM certificates WHERE status='active'")
  const orgs = get<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM organizations')
  const orgMembers = get<{ cnt: number }>('SELECT COUNT(*) AS cnt FROM organization_members')

  // 在线：心跳优先，兜底 stats 快照
  let heartbeat = 0
  try {
    const row = get<{ cnt: number }>(
      "SELECT COUNT(*) AS cnt FROM volunteer_locations WHERE updated_at >= datetime('now','-10 minutes')"
    )
    heartbeat = row?.cnt ?? 0
  } catch {
    heartbeat = 0
  }
  const statsRow = get<{ online_volunteers: number }>('SELECT online_volunteers FROM stats WHERE id = 1')
  const onlineVolunteers = heartbeat > 0 ? heartbeat : (statsRow?.online_volunteers ?? 0)

  return {
    certifiedVolunteers: cert?.cnt ?? 0,
    onlineVolunteers,
    organizations: orgs?.cnt ?? 0,
    orgMembers: orgMembers?.cnt ?? 0,
  }
}

function buildDistricts(
  fromMs: number,
  toMs: number,
  scope: { scopeAll: boolean; districts: string[] }
): GovDistrictRow[] {
  const rows = all<{ d: string }>(`
    SELECT DISTINCT COALESCE(NULLIF(district,''),'__UNASSIGNED__') AS d FROM aed_devices
    UNION SELECT DISTINCT COALESCE(NULLIF(district,''),'__UNASSIGNED__') FROM tasks
  `)
  let keys = rows.map((r) => r.d)
  if (!scope.scopeAll) {
    const allowed = new Set(scope.districts)
    keys = keys.filter((d) => allowed.has(d))
  }
  keys.sort()

  const isoFrom = new Date(fromMs).toISOString()
  const isoTo = new Date(toMs).toISOString()

  return keys.map((d) => {
    const aedRow = get<{ total: number; available: number | null }>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) AS available
       FROM aed_devices WHERE ${DISTRICT_EXPR} = ?`, d
    )
    const taskRow = get<{ total: number; completed: number | null }>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed
       FROM tasks WHERE date(created_at) BETWEEN date(?) AND date(?) AND ${DISTRICT_EXPR} = ?`,
      isoFrom, isoTo, d
    )
    const alertRow = get<{ total: number }>(
      `SELECT COUNT(*) AS total FROM aed_custodian_alerts
       WHERE notify_time_ms BETWEEN ? AND ?
         AND aed_id IN (SELECT id FROM aed_devices WHERE ${DISTRICT_EXPR} = ?)`,
      fromMs, toMs, d
    )
    const latRows = all<{ v: number }>(
      `SELECT response_latency_ms AS v FROM aed_custodian_alerts
       WHERE status IN ('acknowledged','rejected') AND response_latency_ms IS NOT NULL
         AND notify_time_ms BETWEEN ? AND ?
         AND aed_id IN (SELECT id FROM aed_devices WHERE ${DISTRICT_EXPR} = ?)`,
      fromMs, toMs, d
    )
    const slaRow = get<{ n: number; ok: number | null }>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN sla_met=1 THEN 1 ELSE 0 END) AS ok
       FROM aed_custodian_alerts
       WHERE notify_time_ms BETWEEN ? AND ? AND responded_time_ms IS NOT NULL AND sla_met IS NOT NULL
         AND aed_id IN (SELECT id FROM aed_devices WHERE ${DISTRICT_EXPR} = ?)`,
      fromMs, toMs, d
    )

    const aedTotal = aedRow?.total ?? 0
    const taskTotal = taskRow?.total ?? 0
    const taskCompleted = taskRow?.completed ?? 0
    const slaN = slaRow?.n ?? 0
    const slaOk = slaRow?.ok ?? 0

    return {
      district: d,
      aedCount: aedTotal,
      aedAvailableRate: aedTotal > 0 ? (aedRow?.available ?? 0) / aedTotal : null,
      responseP95Ms: p95(latRows.map((r) => r.v)),
      slaRate: slaN > 0 ? slaOk / slaN : null,
      alertTotal: alertRow?.total ?? 0,
      taskCount: taskTotal,
      taskCompletionRate: taskTotal > 0 ? taskCompleted / taskTotal : null,
      coveragePer10k: null,
    }
  })
}

// ---------- 公开：政府登录 ----------

govRouter.post('/login', validate(GovLoginInput), (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string }
    const viewer = get<GovViewerRow>('SELECT * FROM gov_viewers WHERE username = ?', username)
    if (!viewer || !verifyPassword(password, viewer.password_hash)) {
      return res.status(401).json(error('用户名或密码错误'))
    }
    if (viewer.active !== 1) return res.status(403).json(error('账号已停用'))

    const token = signGovToken({ govViewerId: viewer.id, name: viewer.name })
    db.prepare('UPDATE gov_viewers SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .run(Date.now(), Date.now(), viewer.id)

    res.json(success({
      token,
      viewer: {
        id: viewer.id,
        name: viewer.name,
        orgName: viewer.org_name,
        scopeAll: viewer.scope_all === 1,
        districts: parseDistricts(viewer.scope_districts),
      },
    }, '登录成功'))
  } catch (e: unknown) {
    res.status(500).json(error(e instanceof Error ? e.message : '服务器错误'))
  }
})

// ---------- 受保护：当前身份 / 看板聚合 ----------

govRouter.get('/me', govMiddleware, (req, res) => {
  const ctx = govContextOf(req)
  if (!ctx) return res.status(401).json(error('未登录'))
  res.json(success({
    viewerId: ctx.viewerId, name: ctx.name, orgName: ctx.orgName,
    scopeAll: ctx.scopeAll, districts: ctx.districts,
  }))
})

govRouter.get('/dashboard', govMiddleware, (req, res) => {
  try {
    const ctx = govContextOf(req)
    if (!ctx) return res.status(401).json(error('未登录'))

    const now = Date.now()
    const q = req.query
    const windowDays = q.window ? Number(q.window) : 30
    const from = q.window ? now - windowDays * DAY_MS : (q.from ? Number(q.from) : now - 30 * DAY_MS)
    const to = q.to ? Number(q.to) : now
    const district = typeof q.district === 'string' && q.district ? q.district : undefined

    // scope 校验：非全域可见者只能查授权区
    if (!ctx.scopeAll) {
      if (district && !ctx.districts.includes(district)) {
        return res.status(403).json(error('无权访问该区域'))
      }
    }

    const meta: GovMeta = {
      from, to, windowDays, district: district ?? null, generatedAt: now, dataGaps: DATA_GAPS,
    }

    const dashboard: GovDashboard = {
      meta,
      responseTime: buildResponseTime(from, to, district),
      aed: buildAed(from, to, district),
      tasks: buildTasks(from, to, district),
      rescue: buildRescue(from, to),
      people: buildPeople(),
      districts: buildDistricts(from, to, { scopeAll: ctx.scopeAll, districts: ctx.districts }),
    }

    res.json(success(dashboard))
  } catch (e: unknown) {
    res.status(500).json(error(e instanceof Error ? e.message : '服务器错误'))
  }
})

// ---------- 管理：政府账号（业务 authMiddleware + is_leader） ----------

function leaderOnly(
  req: Parameters<typeof authMiddleware>[0],
  res: Parameters<typeof authMiddleware>[1],
  next: Parameters<typeof authMiddleware>[2]
) {
  const auth = (req as { auth?: AuthPayload }).auth
  if (!auth) return res.status(401).json(error('未登录'))
  const userId = auth.userId || auth.openid
  if (!userId) return res.status(401).json(error('未登录'))
  const user = get<{ is_leader: number }>('SELECT is_leader FROM users WHERE id = ?', userId)
  if (!user || !user.is_leader) return res.status(403).json(error('仅管理员可执行此操作'))
  next()
}

govRouter.get('/viewers', authMiddleware, leaderOnly, (_req, res) => {
  try {
    const rows = all<GovViewerRow>('SELECT * FROM gov_viewers ORDER BY created_at DESC')
    // 绝不返回 password_hash
    res.json(success(rows.map((r) => ({
      id: r.id, username: r.username, name: r.name, orgName: r.org_name,
      scopeAll: r.scope_all === 1, districts: parseDistricts(r.scope_districts),
      active: r.active === 1, lastLoginAt: r.last_login_at,
    }))))
  } catch (e: unknown) {
    res.status(500).json(error(e instanceof Error ? e.message : '服务器错误'))
  }
})

govRouter.post('/viewers', authMiddleware, leaderOnly, validate(GovViewerInput), (req, res) => {
  try {
    const body = req.body as {
      username: string; password: string; name?: string; orgName?: string
      scopeAll?: boolean; scopeDistricts?: string[]
    }
    const exists = get<{ id: string }>('SELECT id FROM gov_viewers WHERE username = ?', body.username)
    if (exists) return res.status(400).json(error('用户名已存在'))

    const now = Date.now()
    const id = 'gv_' + now
    db.prepare(`INSERT INTO gov_viewers
      (id, username, password_hash, name, org_name, scope_all, scope_districts, allowed_ips, active, last_login_at, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id, body.username, hashPassword(body.password), body.name || '', body.orgName || '',
      body.scopeAll ? 1 : 0, JSON.stringify(body.scopeDistricts || []), '', 1, null, now, now
    )
    res.json(success({ id }, '已创建政府账号'))
  } catch (e: unknown) {
    res.status(500).json(error(e instanceof Error ? e.message : '服务器错误'))
  }
})

govRouter.put('/viewers/:id', authMiddleware, leaderOnly, validate(GovViewerUpdateInput), (req, res) => {
  try {
    const id = paramStr(req, 'id')
    const viewer = get<GovViewerRow>('SELECT * FROM gov_viewers WHERE id = ?', id)
    if (!viewer) return res.status(404).json(error('政府账号不存在'))

    const b = req.body as {
      name?: string; orgName?: string; scopeAll?: boolean
      scopeDistricts?: string[]; active?: boolean; password?: string
    }
    const now = Date.now()
    db.prepare(`UPDATE gov_viewers SET
      name = ?, org_name = ?, scope_all = ?, scope_districts = ?, active = ?, password_hash = ?, updated_at = ?
      WHERE id = ?`).run(
      b.name ?? viewer.name,
      b.orgName ?? viewer.org_name,
      b.scopeAll === undefined ? viewer.scope_all : (b.scopeAll ? 1 : 0),
      b.scopeDistricts === undefined ? viewer.scope_districts : JSON.stringify(b.scopeDistricts),
      b.active === undefined ? viewer.active : (b.active ? 1 : 0),
      b.password ? hashPassword(b.password) : viewer.password_hash,
      now, id
    )
    res.json(success(null, '已更新'))
  } catch (e: unknown) {
    res.status(500).json(error(e instanceof Error ? e.message : '服务器错误'))
  }
})

govRouter.delete('/viewers/:id', authMiddleware, leaderOnly, (req, res) => {
  try {
    const viewer = get<GovViewerRow>('SELECT * FROM gov_viewers WHERE id = ?', paramStr(req, 'id'))
    if (!viewer) return res.status(404).json(error('政府账号不存在'))
    db.prepare('UPDATE gov_viewers SET active = 0, updated_at = ? WHERE id = ?').run(Date.now(), paramStr(req, 'id'))
    res.json(success(null, '已停用'))
  } catch (e: unknown) {
    res.status(500).json(error(e instanceof Error ? e.message : '服务器错误'))
  }
})
