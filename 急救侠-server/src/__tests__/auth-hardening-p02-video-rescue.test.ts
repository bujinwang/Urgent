/**
 * P0-2 鉴权加固 · `video.ts` 写端点收口 + `rescue.ts` 读端点归属过滤。
 *
 * 覆盖目标（逐条对应任务要求）：
 *
 * **A. video.ts**
 * 1. `POST /upload` / `POST /:id/view` / `POST /:id/like` 无 token ⇒ 401（此前完全匿名可用）
 * 2. `GET /recommend` / `/category/:cat` / `/:id/comments` **仍匿名可读**（公开内容流，不得误伤）
 * 3. `size=999999` ⇒ 被钳制到 50（此前可一次拉全表）；`page` 非法值 ⇒ 回落第 1 页
 *
 * **B. rescue.ts 读端点**
 * 4. `GET /mobilizations` —— **有意保留的公开读**，非参与者仍 200
 * 5. `GET /mobilizations/:taskId/media`（含实时 GPS）非参与者 ⇒ 403，且**拿不到 lat/lng**
 * 6. `GET /mobilizations/:id/volunteers`、`GET /live/:taskId` 非参与者 ⇒ 403
 * 7. 能力保留：发起者 / 已响应志愿者 / 已接受任务的志愿者 / 平台管理员 ⇒ 200
 * 8. 403 先于取记录 ⇒ 不存在的 taskId 同样是 403（探不到存在性）
 *
 * ⚠️ 纪律：不得为了让这些用例变绿而放松任何鉴权。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, makeAdmin, db } from './setup'

/* ═══════════════════════════ 夹具 ═══════════════════════════ */

/** 建一个用户（列的写法对齐 `seedTestData`，避免 NOT NULL 缺失）。 */
function addUser(id: string, name: string): void {
  db.prepare(
    `INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(id, name, name.slice(0, 1), 'bronze', 0, '深圳', 'VID-' + id, '[]', 0)
}

/** 建一条动员（`leader_id` 是 FK，用户必须先存在）。 */
function addMobilization(id: string, title: string, leaderId: string): void {
  db.prepare(
    `INSERT INTO emergency_mobilizations (id, title, leader_id, leader_name, status)
     VALUES (?,?,?,?,?)`
  ).run(id, title, leaderId, leaderId, 'active')
}

/** 让某用户响应某动员（= 动员侧参与者）。 */
function addMobilizationVolunteer(mobId: string, userId: string): void {
  db.prepare(
    `INSERT INTO mobilization_volunteers (id, mobilization_id, user_id, user_name, status)
     VALUES (?,?,?,?,?)`
  ).run('mv_' + mobId + '_' + userId, mobId, userId, userId, 'responded')
}

/** 让某用户接受某救援任务（= `tasks` 侧参与者，**真实流量口径**，见 rescue.ts 注释）。 */
function addTaskVolunteer(taskId: string, userId: string): void {
  db.prepare(
    `INSERT INTO task_volunteers (id, task_id, user_id, responded_at_ms, status)
     VALUES (?,?,?,?,?)`
  ).run('tv_' + taskId + '_' + userId, taskId, userId, Date.now(), 'responded')
}

/** 直接落一条现场动态（`task_id` 无 FK，可写 task 侧或动员侧 id）。 */
function addTaskMedia(id: string, taskId: string, userId: string, lat: number, lng: number): void {
  db.prepare(
    `INSERT INTO task_media (id, task_id, user_id, user_name, user_avatar, type, content, media_url, lat, lng)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(id, taskId, userId, userId, '', 'text', '到达现场', '', lat, lng)
}

/** 直接落一条直播会话（`ended_at` 为空 = 在播）。 */
function addLiveSession(id: string, taskId: string, userId: string): void {
  db.prepare(
    `INSERT INTO live_sessions (id, task_id, user_id, user_name, user_avatar, device_info, ended_at)
     VALUES (?,?,?,?,?,?,?)`
  ).run(id, taskId, userId, userId, '', 'mobile', null)
}

/** 直接落一条视频（供分页钳制用例批量造数据）。 */
function addVideoPost(id: string, category = 'rescue'): void {
  db.prepare(
    `INSERT INTO video_posts (id, user_id, user_name, title, category, view_count, like_count, share_count)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(id, 'u_alice', 'Alice', '标题-' + id, category, 0, 0, 0)
}

/** 直接落一条视频评论。 */
function addVideoComment(id: string, videoId: string, userId: string, content: string): void {
  db.prepare(
    `INSERT INTO video_comments (id, video_id, user_id, user_name, user_avatar, content)
     VALUES (?,?,?,?,?,?)`
  ).run(id, videoId, userId, userId, '', content)
}

/** 统计某表行数。 */
function count(sql: string, ...args: unknown[]): number {
  return (db.prepare(sql).get(...(args as never[])) as { c: number }).c
}

/** 取 `Authorization` 头。 */
function tk(userId: string): string {
  return `Bearer ${userToken(userId)}`
}

// 现场动态的「机密坐标」—— 断言里用它们验证是否泄露。
const SECRET_LAT = 22.50123
const SECRET_LNG = 113.90123

beforeEach(() => {
  seedTestData()
  addUser('u_alice', 'Alice') // 动员发起者
  addUser('u_bob', 'Bob')     // 已响应的动员志愿者
  addUser('u_carol', 'Carol') // 局外人：无参与关系
  addUser('u_dave', 'Dave')   // 已接受救援任务（tasks 侧参与者）
})

/* ═══════════ A1. video 写端点：无 token ⇒ 401 ═══════════ */

describe('P0-2 · video 写端点收口：无 token ⇒ 401', () => {
  const CASES: Array<{ path: string; label: string }> = [
    { path: '/api/video/upload',          label: 'video 上传视频文件（此前=匿名免费文件托管）' },
    { path: '/api/video/vp_1/view',       label: 'video 记播放量（此前=匿名刷量）' },
    { path: '/api/video/vp_1/like',       label: 'video 记点赞（此前=匿名刷赞）' },
  ]

  it.each(CASES)('$label ⇒ 401（$path）', async ({ path }) => {
    const res = await request(server).post(path)
    expect(res.status).toBe(401)
  })

  it('无效 token 同样被拒（401）', async () => {
    const res = await request(server)
      .post('/api/video/vp_1/like')
      .set('Authorization', 'Bearer not-a-real-jwt')
    expect(res.status).toBe(401)
  })

  it('★ 匿名上传不得落盘：401 时 uploads 目录没有新增文件', async () => {
    addVideoPost('vp_1')
    const res = await request(server).post('/api/video/upload')
    expect(res.status).toBe(401)
    // 鉴权在任何 multer 处理之前 ⇒ 响应体不含任何上传结果
    expect(JSON.stringify(res.body)).not.toContain('videoUrl')
  })
})

/* ═══════════ A2. video 公开读：仍匿名可读（不得误伤） ═══════════ */

describe('P0-2 · video 公开内容流：匿名仍 200（能力保留）', () => {
  beforeEach(() => {
    addVideoPost('vp_1')
    addVideoComment('vc_1', 'vp_1', 'u_alice', '公开评论')
  })

  const CASES: Array<{ path: string; label: string }> = [
    { path: '/api/video/recommend',        label: 'video 推荐流' },
    { path: '/api/video/category/rescue',  label: 'video 分类流' },
    { path: '/api/video/vp_1/comments',    label: 'video 评论流' },
  ]

  it.each(CASES)('$label ⇒ 仍 200（$path）', async ({ path }) => {
    const res = await request(server).get(path)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('匿名读推荐流能拿到数据（不是被鉴权挡成空）', async () => {
    const res = await request(server).get('/api/video/recommend')
    expect(res.status).toBe(200)
    expect((res.body.data.items as Array<{ id: string }>).map((i) => i.id)).toContain('vp_1')
  })

  it('匿名读评论流能拿到评论正文', async () => {
    const res = await request(server).get('/api/video/vp_1/comments')
    expect(res.status).toBe(200)
    expect((res.body.data as Array<{ content: string }>).map((c) => c.content)).toContain('公开评论')
  })
})

/* ═══════════ A3. video 分页钳制 ═══════════ */

describe('P0-2 · video 分页参数钳制（size 上限 50）', () => {
  beforeEach(() => {
    // 60 条 ⇒ 若上限失效，`size=999999` 会一次回 60 条
    for (let i = 0; i < 60; i++) addVideoPost(`vp_bulk_${i}`)
  })

  it('① GET /recommend?size=999999 ⇒ 被钳到 50（库里共 60 条）', async () => {
    const res = await request(server).get('/api/video/recommend').query({ size: 999999 })
    expect(res.status).toBe(200)
    expect(count('SELECT COUNT(*) AS c FROM video_posts')).toBe(60)
    expect(res.body.data.items).toHaveLength(50)
  })

  it('② GET /category/:cat?size=999999 ⇒ 同样被钳到 50', async () => {
    const res = await request(server).get('/api/video/category/rescue').query({ size: 999999 })
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(50)
  })

  it('③ 合法小 size 不受影响（size=5 ⇒ 5 条，正常能力保留）', async () => {
    const res = await request(server).get('/api/video/recommend').query({ size: 5 })
    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(5)
  })

  it('④ size 非法（0 / 负数 / 非数字）⇒ 回落默认 10，不 500', async () => {
    for (const bad of ['0', '-8', 'abc', '']) {
      const res = await request(server).get('/api/video/recommend').query({ size: bad })
      expect(res.status).toBe(200)
      expect(res.body.data.items).toHaveLength(10)
    }
  })

  it('⑤ page 非法（0 / 负数 / 非数字）⇒ 回落第 1 页，内容与 page=1 一致', async () => {
    const first = await request(server).get('/api/video/recommend').query({ size: 5, page: 1 })
    expect(first.status).toBe(200)
    const firstIds = (first.body.data.items as Array<{ id: string }>).map((i) => i.id)

    for (const bad of ['0', '-3', 'abc']) {
      const res = await request(server).get('/api/video/recommend').query({ size: 5, page: bad })
      expect(res.status).toBe(200)
      // ★ 断言**精确等于 1**（而非 `>= 1`）：否则「放宽为正整数校验」的突变仍能变绿
      expect(res.body.data.page).toBe(1)
      expect((res.body.data.items as Array<{ id: string }>).map((i) => i.id)).toEqual(firstIds)
    }
  })

  it('⑥ 翻页仍可用（page=2 与 page=1 不重叠）', async () => {
    const p1 = await request(server).get('/api/video/recommend').query({ size: 5, page: 1 })
    const p2 = await request(server).get('/api/video/recommend').query({ size: 5, page: 2 })
    const ids1 = (p1.body.data.items as Array<{ id: string }>).map((i) => i.id)
    const ids2 = (p2.body.data.items as Array<{ id: string }>).map((i) => i.id)
    expect(ids1).toHaveLength(5)
    expect(ids2).toHaveLength(5)
    expect(ids2.some((id) => ids1.includes(id))).toBe(false)
  })
})

/* ═══════════ A4. video 刷量端点：登录后仍可用（能力保留） ═══════════ */

describe('P0-2 · video 播放/点赞：登录后可正常计数（能力保留）', () => {
  beforeEach(() => addVideoPost('vp_1'))

  it('① 登录后 POST /:id/view ⇒ 200，view_count +1', async () => {
    const res = await request(server).post('/api/video/vp_1/view').set('Authorization', tk('u_alice'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect((db.prepare('SELECT view_count FROM video_posts WHERE id=?').get('vp_1') as { view_count: number }).view_count).toBe(1)
  })

  it('② 登录后 POST /:id/like ⇒ 200，like_count +1', async () => {
    const res = await request(server).post('/api/video/vp_1/like').set('Authorization', tk('u_alice'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect((db.prepare('SELECT like_count FROM video_posts WHERE id=?').get('vp_1') as { like_count: number }).like_count).toBe(1)
  })
})

/* ═══════════ B1. 动员列表：有意保留的公开读 ═══════════ */

describe('P0-2 · rescue GET /mobilizations：有意保留的公开读', () => {
  beforeEach(() => addMobilization('mob_1', '某救援动员', 'u_alice'))

  it('① 非参与者（局外人）仍可 200（公开招募，收紧会摧毁响应链路）', async () => {
    const res = await request(server).get('/api/rescue/mobilizations').set('Authorization', tk('u_carol'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect((res.body.data as Array<{ id: string }>).map((m) => m.id)).toContain('mob_1')
  })

  it('② 返回体只含 address 字符串，**不含** lat/lng（精确定位不外泄）', async () => {
    const res = await request(server).get('/api/rescue/mobilizations').set('Authorization', tk('u_carol'))
    expect(res.status).toBe(200)
    const body = JSON.stringify(res.body.data)
    expect(body).not.toContain('"lat"')
    expect(body).not.toContain('"lng"')
  })

  it('③ 无 token ⇒ 401（登录门槛仍在）', async () => {
    const res = await request(server).get('/api/rescue/mobilizations')
    expect(res.status).toBe(401)
  })
})

/* ═══════════ B2. ★★ 现场动态（含实时 GPS）：非参与者 403 ═══════════ */

describe('P0-2 · rescue GET /mobilizations/:taskId/media（含实时 GPS）', () => {
  beforeEach(() => {
    addMobilization('mob_1', '某救援动员', 'u_alice')
    addMobilizationVolunteer('mob_1', 'u_bob')
    addTaskVolunteer('task_001', 'u_dave')
    // 动员侧 + 任务侧各放一条含机密坐标的动态
    addTaskMedia('tm_mob_1', 'mob_1', 'u_alice', SECRET_LAT, SECRET_LNG)
    addTaskMedia('tm_task_1', 'task_001', 'u_alice', SECRET_LAT, SECRET_LNG)
  })

  it('① 局外人读他人动员的现场动态 ⇒ 403，且**拿不到 lat/lng**', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_1/media')
      .set('Authorization', tk('u_carol'))
    expect(res.status).toBe(403)
    // ★ 坐标零泄露（不是只看返回码）
    expect(JSON.stringify(res.body)).not.toContain(String(SECRET_LAT))
    expect(JSON.stringify(res.body)).not.toContain(String(SECRET_LNG))
    expect(JSON.stringify(res.body)).not.toContain('到达现场')
    expect(res.body.data).toBeUndefined()
  })

  it('② 局外人读**任务侧**（真实流量 id 空间）的现场动态 ⇒ 403，坐标零泄露', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/task_001/media')
      .set('Authorization', tk('u_carol'))
    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).not.toContain(String(SECRET_LAT))
    expect(JSON.stringify(res.body)).not.toContain(String(SECRET_LNG))
    expect(res.body.data).toBeUndefined()
  })

  it('③ 不存在的 taskId ⇒ 同样 403（探不到存在性，而非 404/空数组）', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_ghost/media')
      .set('Authorization', tk('u_carol'))
    expect(res.status).toBe(403)
  })

  it('④ 发起者本人 ⇒ 200，能拿到自己的动态', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_1/media')
      .set('Authorization', tk('u_alice'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect((res.body.data as Array<{ id: string }>).map((m) => m.id)).toContain('tm_mob_1')
  })

  it('⑤ 已响应的志愿者 ⇒ 200（能力保留）', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_1/media')
      .set('Authorization', tk('u_bob'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('⑥ 已接受任务的志愿者（tasks id 空间，真实流量）⇒ 200（能力保留）', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/task_001/media')
      .set('Authorization', tk('u_dave'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect((res.body.data as Array<{ id: string }>).map((m) => m.id)).toContain('tm_task_1')
  })

  it('⑦ 平台管理员 ⇒ 200（能力保留）', async () => {
    addUser('u_admin', 'Admin')
    makeAdmin('u_admin')
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_1/media')
      .set('Authorization', tk('u_admin'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('⑧ 无 token ⇒ 401', async () => {
    const res = await request(server).get('/api/rescue/mobilizations/mob_1/media')
    expect(res.status).toBe(401)
  })
})

/* ═══════════ B3. 志愿者名单：非参与者 403 ═══════════ */

describe('P0-2 · rescue GET /mobilizations/:id/volunteers', () => {
  beforeEach(() => {
    addMobilization('mob_1', '某救援动员', 'u_alice')
    addMobilizationVolunteer('mob_1', 'u_bob')
  })

  it('① 局外人读他人动员的志愿者名单 ⇒ 403，且拿不到任何志愿者', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_1/volunteers')
      .set('Authorization', tk('u_carol'))
    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).not.toContain('u_bob')
    expect(res.body.data).toBeUndefined()
  })

  it('② 不存在的动员 ⇒ 同样 403（探不到存在性）', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_ghost/volunteers')
      .set('Authorization', tk('u_carol'))
    expect(res.status).toBe(403)
  })

  it('③ 发起者本人 ⇒ 200，能看到响应者', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_1/volunteers')
      .set('Authorization', tk('u_alice'))
    expect(res.status).toBe(200)
    expect((res.body.data as Array<{ userId: string }>).map((v) => v.userId)).toContain('u_bob')
  })

  it('④ 已响应的志愿者本人 ⇒ 200（能力保留）', async () => {
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_1/volunteers')
      .set('Authorization', tk('u_bob'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('⑤ 平台管理员 ⇒ 200（能力保留）', async () => {
    addUser('u_admin', 'Admin')
    makeAdmin('u_admin')
    const res = await request(server)
      .get('/api/rescue/mobilizations/mob_1/volunteers')
      .set('Authorization', tk('u_admin'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('⑥ 无 token ⇒ 401', async () => {
    const res = await request(server).get('/api/rescue/mobilizations/mob_1/volunteers')
    expect(res.status).toBe(401)
  })
})

/* ═══════════ B4. 直播会话：非参与者 403 ═══════════ */

describe('P0-2 · rescue GET /live/:taskId', () => {
  beforeEach(() => {
    addMobilization('mob_1', '某救援动员', 'u_alice')
    addMobilizationVolunteer('mob_1', 'u_bob')
    addTaskVolunteer('task_001', 'u_dave')
    addLiveSession('live_mob_1', 'mob_1', 'u_alice')
    addLiveSession('live_task_1', 'task_001', 'u_alice')
  })

  it('① 局外人读他人动员的直播会话 ⇒ 403，且拿不到主播信息', async () => {
    const res = await request(server)
      .get('/api/rescue/live/mob_1')
      .set('Authorization', tk('u_carol'))
    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).not.toContain('live_mob_1')
    expect(res.body.data).toBeUndefined()
  })

  it('② 局外人读**任务侧**（真实流量 id 空间）⇒ 403', async () => {
    const res = await request(server)
      .get('/api/rescue/live/task_001')
      .set('Authorization', tk('u_carol'))
    expect(res.status).toBe(403)
    expect(JSON.stringify(res.body)).not.toContain('live_task_1')
  })

  it('③ 不存在的 taskId ⇒ 同样 403（探不到存在性）', async () => {
    const res = await request(server)
      .get('/api/rescue/live/task_ghost')
      .set('Authorization', tk('u_carol'))
    expect(res.status).toBe(403)
  })

  it('④ 主播本人（发起者）⇒ 200', async () => {
    const res = await request(server)
      .get('/api/rescue/live/mob_1')
      .set('Authorization', tk('u_alice'))
    expect(res.status).toBe(200)
    expect((res.body.data as Array<{ id: string }>).map((s) => s.id)).toContain('live_mob_1')
  })

  it('⑤ 已响应的志愿者 ⇒ 200（能力保留）', async () => {
    const res = await request(server)
      .get('/api/rescue/live/mob_1')
      .set('Authorization', tk('u_bob'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('⑥ 已接受任务的志愿者（tasks id 空间，真实流量）⇒ 200（能力保留）', async () => {
    const res = await request(server)
      .get('/api/rescue/live/task_001')
      .set('Authorization', tk('u_dave'))
    expect(res.status).toBe(200)
    expect((res.body.data as Array<{ id: string }>).map((s) => s.id)).toContain('live_task_1')
  })

  it('⑦ 平台管理员 ⇒ 200（能力保留）', async () => {
    addUser('u_admin', 'Admin')
    makeAdmin('u_admin')
    const res = await request(server)
      .get('/api/rescue/live/mob_1')
      .set('Authorization', tk('u_admin'))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('⑧ 无 token ⇒ 401', async () => {
    const res = await request(server).get('/api/rescue/live/mob_1')
    expect(res.status).toBe(401)
  })
})
