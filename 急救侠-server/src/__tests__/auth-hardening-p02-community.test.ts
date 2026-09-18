/**
 * P0-2 鉴权加固 · `src/routes/community.ts` 七端点守卫。
 *
 * 本轮要把「位置 + 群组」这一批仍未收口的端点补齐：
 * 1. **匿名可达 ⇒ 401**：/location、/nearby、/groups（GET/POST）、/:id/join、/:id/messages（GET/POST）
 * 2. **GPS 归属不可伪造**：body.userId=B ⇒ 位置落在调用者名下，且**他人移动 AED 坐标零变化**（★ 最易漏）
 * 3. **nearby 不再退化为全表**：radius 钳制 [100,10000]、lat/lng 非法 ⇒ 400（而非静默取 0）、
 *    且只暴露 24h 内刷新过的位置
 * 4. **群成员判据**：非成员读/发群消息 ⇒ 403 且目标侧零变化；成员读写正常 ⇒ 200（能力保留）
 *
 * ⚠️ 纪律：不得为了让这些用例变绿而放松任何鉴权。每条守卫均已用「改坏源码 ⇒ 用例变红」
 * 做过突变验证（见提交说明）。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken, db } from './setup'

/* ═══════════════════ 夹具 ═══════════════════ */

/** 基准坐标（与前端社区页硬编码的一致）。 */
const BASE_LAT = 22.517
const BASE_LNG = 113.947

/**
 * 距离基准点约 30m 的坐标（0.0002° 纬度 ≈ 22m）。
 * 选它是因为**即便 radius 被钳到下限 100m** 仍在包围盒内 ⇒ 可用于验证下限生效。
 */
const NEAR_LAT = 22.5172
const NEAR_LNG = 113.9472

/** 距离基准点约 1000km 的坐标。只有「radius 未被钳制」时才会落进包围盒。 */
const FAR_LAT = 30.0
const FAR_LNG = 120.0

/** 建一个用户（列的写法对齐 `seedTestData`，避免 NOT NULL 缺失）。 */
function addUser(id: string, name: string): void {
  db.prepare(
    `INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count, affiliation)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(id, name, name.slice(0, 1), 'bronze', 0, '深圳', 'VID-' + id, '[]', 0, '')
}

/**
 * 确保用户存在（`volunteer_locations.user_id` 有指向 `users.id` 的外键，且本次忆中 FK 是开启的）。
 * 幂等；已存在则原样返回。
 */
function ensureUser(id: string): void {
  if (!db.prepare('SELECT id FROM users WHERE id=?').get(id)) addUser(id, id)
}

/**
 * 直接落一条志愿者位置（`updated_at` 可回溯，用于构造「陈旧 GPS」）。
 *
 * @param hoursAgo 距今多少小时更新；0 表示"刚刚"。
 */
function addLocation(userId: string, lat: number, lng: number, hoursAgo = 0): void {
  ensureUser(userId)
  const id = 'vl_' + userId
  if (hoursAgo > 0) {
    db.prepare(
      `INSERT INTO volunteer_locations (id, user_id, user_name, lat, lng, updated_at)
       VALUES (?,?,?,?,?, datetime('now', ?))`
    ).run(id, userId, userId, lat, lng, `-${hoursAgo} hours`)
  } else {
    db.prepare(
      `INSERT INTO volunteer_locations (id, user_id, user_name, lat, lng) VALUES (?,?,?,?,?)`
    ).run(id, userId, userId, lat, lng)
  }
}

/** 读某志愿者的最新坐标。 */
function locationOf(userId: string): { lat: number; lng: number } | undefined {
  return db.prepare('SELECT lat, lng FROM volunteer_locations WHERE user_id=?').get(userId) as
    { lat: number; lng: number } | undefined
}

/** 建一台**移动** AED（`is_mobile=1`），归属 `ownerId`。 */
function addMobileAed(id: string, ownerId: string, lat: number, lng: number): void {
  db.prepare(
    `INSERT INTO aed_devices (id, name, address, lat, lng, last_check, is_mobile, linked_user_id)
     VALUES (?,?,?,?,?,?,1,?)`
  ).run(id, 'AED-' + id, '随志愿者移动', lat, lng, '2025-05-01', ownerId)
}

/** 读某 AED 的坐标（用于断言"没被改到别人身上"）。 */
function aedCoord(id: string): { lat: number; lng: number } | undefined {
  return db.prepare('SELECT lat, lng FROM aed_devices WHERE id=?').get(id) as
    { lat: number; lng: number } | undefined
}

/** 建一个群组（`created_by` 是 FK，用户须先存在）。 */
function addGroup(id: string, name: string, createdBy: string): void {
  db.prepare('INSERT INTO volunteer_groups (id, name, description, created_by) VALUES (?,?,?,?)')
    .run(id, name, '测试群简介', createdBy)
}

/** 直接把用户加进群（绕过接口，用于构造"非成员"对照组）。 */
function addGroupMember(groupId: string, userId: string): void {
  db.prepare('INSERT OR IGNORE INTO group_members (id, group_id, user_id, user_name) VALUES (?,?,?,?)')
    .run('gm_' + groupId + '_' + userId, groupId, userId, userId)
}

/** 直接落一条群消息（构造"他人群聊正文"）。 */
function addGroupMessage(id: string, groupId: string, userId: string, content: string): void {
  db.prepare('INSERT INTO group_messages (id, group_id, user_id, user_name, content) VALUES (?,?,?,?,?)')
    .run(id, groupId, userId, userId, content)
}

/** 某群的成员名列表。 */
function groupMembers(groupId: string): string[] {
  return (db.prepare('SELECT user_id FROM group_members WHERE group_id=?').all(groupId) as
    Array<{ user_id: string }>).map((r) => r.user_id)
}

/** 统计行数（用于"目标侧零变化"断言）。 */
function count(sql: string, ...args: unknown[]): number {
  return (db.prepare(sql).get(...(args as never[])) as { c: number }).c
}

beforeEach(() => {
  seedTestData()
  addUser('u_alice', 'Alice')
  addUser('u_bob', 'Bob')
})

/* ═══════════════════ 1. 无 token ⇒ 401（逐端点） ═══════════════════ */

describe('P0-2 · community 无 token ⇒ 401', () => {
  const CASES: Array<{ method: 'get' | 'post'; path: string; label: string }> = [
    { method: 'post', path: '/api/community/location',              label: '上报位置（他人 GPS，Top1）' },
    { method: 'get',  path: '/api/community/nearby',                label: '附近的人（枚举他人实时 GPS，Top2）' },
    { method: 'get',  path: '/api/community/groups',                label: '群组列表' },
    { method: 'post', path: '/api/community/groups',                label: '创建群组' },
    { method: 'post', path: '/api/community/groups/grp_1/join',     label: '加入群组' },
    { method: 'get',  path: '/api/community/groups/grp_1/messages', label: '群聊消息列表' },
    { method: 'post', path: '/api/community/groups/grp_1/messages', label: '发群聊消息' },
  ]

  it.each(CASES)('$label ⇒ 401（$path）', async ({ method, path }) => {
    const res = await request(server)[method](path)
    expect(res.status).toBe(401)
  })

  it('无效 token ⇒ 401（不会被当作已登录放行）', async () => {
    const res = await request(server)
      .get('/api/community/nearby')
      .query({ lat: BASE_LAT, lng: BASE_LNG })
      .set('Authorization', 'Bearer not-a-real-jwt')
    expect(res.status).toBe(401)
  })
})

/* ═══════════════════ 2. POST /location：GPS 归属不可伪造 ═══════════════════ */

describe('P0-2 · POST /location：位置与移动 AED 都只绑定调用者本人', () => {
  beforeEach(() => {
    // Bob 名下有一台移动 AED，坐标离得很远；Alice 自己也有一台
    addMobileAed('aed_m_bob', 'u_bob', 39.9, 116.4)
    addMobileAed('aed_m_alice', 'u_alice', 31.2, 121.5)
  })

  it('① 持 Alice 的 token 却 body.userId=Bob ⇒ 位置记在 Alice 名下，Bob 侧零变化', async () => {
    const res = await request(server)
      .post('/api/community/location')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', userName: 'Bob', lat: 11.11, lng: 22.22 })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    // ★ Alice 侧：坐标落在调用者本人名下
    expect(locationOf('u_alice')).toEqual({ lat: 11.11, lng: 22.22 })
    // ★ Bob 侧：一行都没多（位置没被伪造到他名下）
    expect(count('SELECT COUNT(*) AS c FROM volunteer_locations WHERE user_id=?', 'u_bob')).toBe(0)
  })

  it('② ★ 同一请求不得改到 Bob 名下移动 AED 的坐标（改了等于把求救者导向错误地点）', async () => {
    const before = aedCoord('aed_m_bob')
    expect(before).toEqual({ lat: 39.9, lng: 116.4 })

    const res = await request(server)
      .post('/api/community/location')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', lat: 11.11, lng: 22.22 })
    expect(res.status).toBe(200)

    // ★ 受害者侧坐标一字未变
    expect(aedCoord('aed_m_bob')).toEqual({ lat: 39.9, lng: 116.4 })
  })

  it('③ 能力保留：正常上报会同步**自己**名下移动 AED 的坐标', async () => {
    const res = await request(server)
      .post('/api/community/location')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userName: 'Alice', lat: 11.11, lng: 22.22 })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    expect(locationOf('u_alice')).toEqual({ lat: 11.11, lng: 22.22 })
    expect(aedCoord('aed_m_alice')).toEqual({ lat: 11.11, lng: 22.22 })
    // 不影响**固定** AED（`is_mobile=0`，如 seed 的 aed_001）
    expect(aedCoord('aed_001')).toEqual({ lat: 22.517, lng: 113.947 })
  })

  it('④ 重复上报 ⇒ 仍是同一条记录（`INSERT OR REPLACE` 语义未回退）', async () => {
    await request(server)
      .post('/api/community/location')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ lat: 11.11, lng: 22.22 })
    await request(server)
      .post('/api/community/location')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ lat: 33.33, lng: 44.44 })

    expect(count('SELECT COUNT(*) AS c FROM volunteer_locations WHERE user_id=?', 'u_alice')).toBe(1)
    expect(locationOf('u_alice')).toEqual({ lat: 33.33, lng: 44.44 })
  })

  it('⑤ 缺 lat/lng ⇒ 业务错误（code=-1），且不产生任何脏数据', async () => {
    const res = await request(server)
      .post('/api/community/location')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_alice' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(-1)
    expect(count('SELECT COUNT(*) AS c FROM volunteer_locations')).toBe(0)
  })
})

/* ═══════════════════ 3. GET /nearby：不再退化为「全表坐标」 ═══════════════════ */

describe('P0-2 · GET /nearby：radius 钳制 + 坐标校验 + 24h 新鲜度', () => {
  /** 打一次 /nearby。 */
  function nearby(query: Record<string, unknown>, userId = 'u_alice') {
    return request(server)
      .get('/api/community/nearby')
      .query(query as never)
      .set('Authorization', `Bearer ${userToken(userId)}`)
  }

  beforeEach(() => {
    addLocation('u_near', NEAR_LAT, NEAR_LNG)      // 距基准点 ~30m
    addLocation('u_far', FAR_LAT, FAR_LNG)         // 距基准点 ~1000km
  })

  const BASE_QUERY = { lat: BASE_LAT, lng: BASE_LNG }

  it('① 超大 radius（1e7 m）⇒ 被钳到 10000m：超远的那位**不会**出现在结果里', async () => {
    const res = await nearby({ ...BASE_QUERY, radius: 10_000_000 })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const ids: string[] = (res.body.data as Array<{ userId: string }>).map((v) => v.userId)
    expect(ids).toContain('u_near')   // 近的还在 ⇒ 不是把功能钳死了
    expect(ids).not.toContain('u_far') // ★ 远的被排除 ⇒ 没有一次拉回全表
  })

  it('② 超大 radius 的实际效果等价于 radius=10000（与显式传上限的结果一致）', async () => {
    const huge = await nearby({ ...BASE_QUERY, radius: 999_999_999 })
    const capped = await nearby({ ...BASE_QUERY, radius: 10_000 })
    const idsOf = (r: { body: { data: Array<{ userId: string }> } }) =>
      r.body.data.map((v) => v.userId).sort()
    expect(idsOf(huge as never)).toEqual(idsOf(capped as never))
  })

  it('③ 过小 radius（1m）⇒ 被抬到下限 100m：就在脚边的那位仍可见', async () => {
    const res = await nearby({ ...BASE_QUERY, radius: 1 })
    expect(res.status).toBe(200)
    const ids: string[] = (res.body.data as Array<{ userId: string }>).map((v) => v.userId)
    expect(ids).toContain('u_near')
  })

  it('④ radius 非数字（abc / 空串 / 缺失）⇒ 回落缺省 5000m，仍是正常列表', async () => {
    for (const radius of ['abc', '', undefined]) {
      const res = await nearby({ ...BASE_QUERY, radius })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(Array.isArray(res.body.data)).toBe(true)
    }
  })

  it('⑤ lat/lng 非法 ⇒ 400 参数错误（不再是"静默取 0" ⇒ 变成以 0°,0° 为中心的超大矩形）', async () => {
    const badQueries: Array<Record<string, unknown>> = [
      { lat: 'abc', lng: BASE_LNG },
      { lat: BASE_LAT, lng: 'abc' },
      { lat: BASE_LAT, lng: '999' },   // 越界经度
      { lat: '91', lng: BASE_LNG },    // 越界纬度
      {},                               // 两者都缺
    ]
    for (const q of badQueries) {
      const res = await nearby(q)
      expect(res.status).toBe(400)
      expect(res.body.code).toBe(-1)
    }
  })

  it('⑥ 合法坐标 + 合法 radius ⇒ 正常返回（能力保留）', async () => {
    const res = await nearby({ ...BASE_QUERY, radius: 5000 })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    const first = (res.body.data as Array<Record<string, unknown>>)[0]
    // 返回结构未被改坏（前端依赖这些字段）
    expect(first).toHaveProperty('userId')
    expect(first).toHaveProperty('userName')
    expect(first).toHaveProperty('tier')
    expect(first).toHaveProperty('rescueCount')
    expect(first).toHaveProperty('lat')
    expect(first).toHaveProperty('lng')
  })

  it('⑦ ★ 陈旧 GPS（48h 前）不再暴露；24h 内刷新过的仍可见', async () => {
    addLocation('u_stale', NEAR_LAT, NEAR_LNG, 48)  // 48 小时前更新
    addLocation('u_fresh', NEAR_LAT, NEAR_LNG, 2)   // 2 小时前更新

    const res = await nearby({ ...BASE_QUERY, radius: 5000 })
    expect(res.status).toBe(200)
    const ids: string[] = (res.body.data as Array<{ userId: string }>).map((v) => v.userId)
    expect(ids).toContain('u_fresh')
    expect(ids).not.toContain('u_stale') // ★ 陈旧坐标被滤掉
  })

  it('⑧ 调用者本人也出现在结果里（前端负责把自己滤掉，后端不擅自剔除）', async () => {
    addLocation('u_alice', BASE_LAT, BASE_LNG)
    const res = await nearby({ ...BASE_QUERY, radius: 5000 })
    const ids: string[] = (res.body.data as Array<{ userId: string }>).map((v) => v.userId)
    expect(ids).toContain('u_alice')
  })
})

/* ═══════════════════ 4. 群组：创建者/成员身份不可伪造 ═══════════════════ */

describe('P0-2 · 群组：身份一律 token 派生', () => {
  it('① GET /groups：已登录 ⇒ 200 列表（能力保留）', async () => {
    addGroup('grp_1', '深圳湾急救小队', 'u_bob')
    const res = await request(server)
      .get('/api/community/groups')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    const ids: string[] = (res.body.data as Array<{ id: string }>).map((g) => g.id)
    expect(ids).toContain('grp_1')
  })

  it('② POST /groups：body 传 createdBy=Bob ⇒ 创建者仍是调用者 Alice，且 creator 自动入群', async () => {
    const res = await request(server)
      .post('/api/community/groups')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ name: '冒名群组', description: 'd', createdBy: 'u_bob', createdByName: 'Bob' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const gid = res.body.data.id as string
    const row = db.prepare('SELECT created_by FROM volunteer_groups WHERE id=?').get(gid) as
      { created_by: string }
    expect(row.created_by).toBe('u_alice')
    // ★ 自动入群的也是 Alice，不是 Bob
    expect(groupMembers(gid)).toEqual(['u_alice'])
    expect(count('SELECT COUNT(*) AS c FROM group_members WHERE user_id=?', 'u_bob')).toBe(0)
  })

  it('③ POST /groups/:id/join：body 传 userId=Bob ⇒ 入群的是 Alice（Bob 侧零变化）', async () => {
    addGroup('grp_1', '某群', 'u_alice')
    const res = await request(server)
      .post('/api/community/groups/grp_1/join')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', userName: 'Bob' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    expect(groupMembers('grp_1')).toEqual(['u_alice'])
    expect(count('SELECT COUNT(*) AS c FROM group_members WHERE user_id=?', 'u_bob')).toBe(0)
  })

  it('④ 缺 name ⇒ 业务错误，群组未创建', async () => {
    const res = await request(server)
      .post('/api/community/groups')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({})
    expect(res.body.code).toBe(-1)
    expect(count('SELECT COUNT(*) AS c FROM volunteer_groups')).toBe(0)
  })
})

/* ═══════════════════ 5. 群聊消息：非成员读写 ⇒ 403 ═══════════════════ */

describe('P0-2 · 群聊消息必须限本群成员', () => {
  /** 群成员 Alice；非成员 Carol。 */
  beforeEach(() => {
    addUser('u_carol', 'Carol')
    addGroup('grp_1', '急救小队', 'u_alice')
    addGroupMember('grp_1', 'u_alice')
    addGroupMessage('gmsg_1', 'grp_1', 'u_alice', '群内正文：明早八点集合')
  })

  it('① 非成员 GET 群消息 ⇒ 403，且拿不到任何正文', async () => {
    const res = await request(server)
      .get('/api/community/groups/grp_1/messages')
      .set('Authorization', `Bearer ${userToken('u_carol')}`)
    expect(res.status).toBe(403)

    const text = JSON.stringify(res.body)
    expect(text).not.toContain('明早八点集合')
    expect(res.body.data).toBeUndefined()
  })

  it('② 非成员 POST 群消息 ⇒ 403，且**消息未落库**（不是只返回一个错码）', async () => {
    const res = await request(server)
      .post('/api/community/groups/grp_1/messages')
      .set('Authorization', `Bearer ${userToken('u_carol')}`)
      .send({ userName: 'Carol', content: '非法灌入' })
    expect(res.status).toBe(403)
    expect(count('SELECT COUNT(*) AS c FROM group_messages WHERE content=?', '非法灌入')).toBe(0)
    expect(count('SELECT COUNT(*) AS c FROM group_messages')).toBe(1)
  })

  it('③ 成员 GET ⇒ 200 且能读到本群正文（能力保留）', async () => {
    const res = await request(server)
      .get('/api/community/groups/grp_1/messages')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect((res.body.data as Array<{ id: string }>).map((m) => m.id)).toEqual(['gmsg_1'])
  })

  it('④ 成员 POST ⇒ 200，且即使 body 传 userId=Bob，落库仍是调用者', async () => {
    const res = await request(server)
      .post('/api/community/groups/grp_1/messages')
      .set('Authorization', `Bearer ${userToken('u_alice')}`)
      .send({ userId: 'u_bob', userName: 'Bob', content: '冒名发言' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)

    const row = db.prepare('SELECT user_id FROM group_messages WHERE content=?').get('冒名发言') as
      { user_id: string }
    expect(row.user_id).toBe('u_alice')
  })

  it('⑤ 非成员访问**不存在**的群 id ⇒ 403（不泄漏"该 id 是否存在"）', async () => {
    const read = await request(server)
      .get('/api/community/groups/grp_ghost/messages')
      .set('Authorization', `Bearer ${userToken('u_carol')}`)
    expect(read.status).toBe(403)

    const write = await request(server)
      .post('/api/community/groups/grp_ghost/messages')
      .set('Authorization', `Bearer ${userToken('u_carol')}`)
      .send({ content: 'x' })
    expect(write.status).toBe(403)
  })

  it('⑥ 加入之后才具备读写权限（写入路径不与读取路径分叉）', async () => {
    await request(server)
      .post('/api/community/groups/grp_1/join')
      .set('Authorization', `Bearer ${userToken('u_carol')}`)
      .send({ userName: 'Carol' })

    const read = await request(server)
      .get('/api/community/groups/grp_1/messages')
      .set('Authorization', `Bearer ${userToken('u_carol')}`)
    expect(read.status).toBe(200)
    const texts: string = JSON.stringify(read.body.data)
    expect(texts).toContain('明早八点集合')

    const write = await request(server)
      .post('/api/community/groups/grp_1/messages')
      .set('Authorization', `Bearer ${userToken('u_carol')}`)
      .send({ userName: 'Carol', content: '新成员报到' })
    expect(write.status).toBe(200)
    expect(count('SELECT COUNT(*) AS c FROM group_messages WHERE user_id=?', 'u_carol')).toBe(1)
  })
})
