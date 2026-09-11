// Must set DB_PATH before any app imports
process.env.DB_PATH = ':memory:'

import { afterAll, afterEach } from 'vitest'
import app from '../app'
import { clearAll, resetSchema } from '../db'
import db from '../db'
import { hashPassword, signGovToken } from '../middleware/govAuth'
import { signToken } from '../middleware/auth'

// ---------------------------------------------------------------------------
// 1) 常驻 listener，显式绑定 127.0.0.1
//
// 不能用 supertest 默认的 `request(expressApp)`：那种写法内部会 `listen(0)`
// 绑到通配地址（`::` / `0.0.0.0`）。在 macOS 上，通配绑定与已存在的
// `127.0.0.1:<port>` 绑定可以**同时并存**，而 supertest 固定连 127.0.0.1，
// 内核会把请求投递给「更具体」的那个 socket —— 于是请求被本机其它应用的
// 监听端接走，测试拿到外部进程的响应，表现为本仓库路由表根本不会产生的
// 404 / 400 / 500（实测 20 次连跑约 10% 概率中招，如 GET /api/drill/organizers
// 返回 404、POST /api/push/register 期望 401 实得 500）。
//
// 显式绑定 127.0.0.1 后，OS 只会分配在 127.0.0.1 上真正空闲的端口，请求必然
// 落到我们自己的 server；同时每个测试文件只 listen 一次，免去 supertest
// 逐请求 listen/close 的端口抖动。
//
// 注：这里导出的是 server 而非 express app，两者 supertest 都接受；
// 全仓库测试仅以 `request(server)` 形式使用它，没有 express 专有用法。
const server = app.listen(0, '127.0.0.1')

afterAll(() => { server.close() })

// ---------------------------------------------------------------------------
// 2) 每个用例结束后从零重建数据库 schema
//
// vitest 配置为 singleFork + fileParallelism:false：所有测试文件在同一个子进程内
// 顺序执行；且 isolate 默认开启，每个文件都会重新加载模块，因此每个文件各自新建
// 一个 :memory: 库（实测 17 个文件各打印一次 "Migration applied: 001_add_password"）
// ——跨文件污染已被模块隔离消除。
//
// 这里兜底的是**同一文件内**的破坏性用例：coverage-fill.test.ts 有 7 处故意
// DROP TABLE 以覆盖 catch 分支；这些用例已用 try/finally 恢复，此全局钩子再加一道
// 保险——无论某用例通过还是抛异常，下一个用例开始时 schema 都是完整规范结构
// （DROP 全部表含 _migrations 后 initDb() 重建）。
afterEach(() => { resetSchema() })

// Seed helper used by individual tests
export function seedTestData() {
  clearAll()

  db.prepare(`INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'user_001', '陆远', '陆', 'gold', 2340, '深圳', 'SZ-012',
    JSON.stringify(['CPR-AHA', 'AED-Operator']), 12
  )

  db.prepare('INSERT INTO stats (id, certified_rescuers, networked_aeds, monthly_rescues, online_volunteers, aeds_within_1km) VALUES (1, 12847, 3256, 89, 3, 12)').run()

  db.prepare('INSERT INTO tasks (id, type, address, distance, lat, lng, volunteers_needed, volunteers_responded, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(
    'task_001', 'cpr', '深圳湾公园南门', 100, 22.517, 113.947, 3, 3, 'active', new Date().toISOString()
  )

  db.prepare('INSERT INTO aed_devices (id, name, address, lat, lng, distance, status, last_check, battery_level) VALUES (?,?,?,?,?,?,?,?,?)').run(
    'aed_001', '深圳湾公园 AED', '深圳湾公园南门', 22.517, 113.947, 80, 'available', '2025-05-01', 98)

  db.prepare("INSERT INTO news (id, title, type, category, time, location_name, location_lat, location_lng, tags, is_live, is_urgent) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
    'n001', '测试新闻标题', 'article', 'recommend', '2小时前', '深圳', 22.543, 114.058, '["测试"]', 0, 0)

  db.prepare('INSERT INTO courses (id, title, category, duration, completed, progress, icon) VALUES (?,?,?,?,?,?,?)').run(
    'course_001', 'CPR 基础', '知识库', '15分钟', 0, 0.5, '❤️')

  db.prepare('INSERT INTO volunteers (id, name, avatar, tier, points, rescue_count, city, rank_pos) VALUES (?,?,?,?,?,?,?,?)').run(
    'v001', '陆远', '陆', 'gold', 2340, 12, '深圳', 1)

  db.prepare("INSERT INTO rescue_records (id, type, date, location, role, squad, result) VALUES (?,?,?,?,?,?,?)").run(
    'rec_001', 'CPR', '2025-05-01', '深圳湾公园', '按压员', '["陆远","陈敏"]', '成功')

  db.prepare("INSERT INTO rescue_cases (id, title, summary, date, location, result, volunteers, body) VALUES (?,?,?,?,?,?,?,?)").run(
    'case_001', '心脏骤停救援', '测试摘要', '2025-05-01', '深圳湾公园', '成功', '["陆远"]', '详细记录')

  db.prepare("INSERT INTO atlas_cards (id, title, category, description, steps, icon) VALUES (?,?,?,?,?,?)").run(
    'atlas_001', 'CPR 心肺复苏', '基础技能', '测试描述', '["步骤1","步骤2"]', '❤️')
}

// ---- AED 责任人联动测试夹具（供 aed-custodian.test.ts 使用；均为追加式，不影响其它用例）----

/** 将一个已存在的用户指派为某 AED 的责任人（primary / backup）。 */
export function addCustodian(
  aedId: string,
  userId: string,
  userName: string,
  role: 'primary' | 'backup'
): void {
  db.prepare('INSERT INTO aed_managers (id, aed_id, user_id, user_name, role) VALUES (?,?,?,?,?)').run(
    'am_' + aedId + '_' + userId, aedId, userId, userName, role
  )
}

/** 为用户登记一条推送订阅（dev 模式可送达）。 */
export function addPushSubscription(userId: string, templateId: string, accepted = true): void {
  db.prepare('INSERT INTO push_subscriptions (id, user_id, template_id, accepted) VALUES (?,?,?,?)').run(
    'ps_' + userId + '_' + templateId, userId, templateId, accepted ? 1 : 0
  )
}

/**
 * 业务用户令牌夹具（供需要 `authMiddleware` 的端点使用）。
 *
 * @param userId `users.id`；默认 `user_001` 即 `seedTestData()` 的默认用户。
 */
export function userToken(userId = 'user_001'): string {
  return signToken({ userId })
}

/** 政府看板账号夹具（P2-8）：返回可用于登录/直连的凭据与令牌。 */
export function seedGovViewer(opts: {
  username?: string; password?: string; name?: string; orgName?: string
  scopeAll?: boolean; scopeDistricts?: string[]; active?: boolean
} = {}) {
  const username = opts.username || 'gov_admin'
  const password = opts.password || 'gov-pass-123'
  const name = opts.name || '政府监管员'
  const id = 'gv_test_' + Math.random().toString(36).slice(2, 8)
  const now = Date.now()
  db.prepare(`INSERT INTO gov_viewers
    (id, username, password_hash, name, org_name, scope_all, scope_districts, allowed_ips, active, last_login_at, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, username, hashPassword(password), name, opts.orgName || '市卫健委',
    opts.scopeAll ? 1 : 0, JSON.stringify(opts.scopeDistricts || []), '',
    opts.active === false ? 0 : 1, null, now, now
  )
  const token = signGovToken({ govViewerId: id, name })
  return { id, username, password, token }
}

export { server }
export { clearAll } from '../db'
export { default as db } from '../db'
