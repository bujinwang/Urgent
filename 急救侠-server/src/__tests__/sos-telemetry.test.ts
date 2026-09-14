import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { server, db, userToken } from './setup'
import {
  countSosEvents, purgeSosEvents, retentionCutoffMs, SOS_RETENTION_DAYS,
} from '../services/sosTelemetry'

/**
 * F3 SOS 服务端埋点 —— 端点行为与表结构不变式。
 *
 * 设计依据：`deliverables/software-company/sos-telemetry-design.md`（§9 测试计划 T1–T5、T8–T9）。
 * 真实挂载的限流覆盖在 `trust-proxy.test.ts`（复用其 `loadRealApp` 基建，避免重复造 harness）。
 */

interface SosRow {
  id: string
  client_event_id: string
  user_id: string | null
  is_drill: number
  client_platform: string
  created_at_ms: number
  created_at: string
}

function rows(): SosRow[] {
  return db.prepare('SELECT * FROM sos_events ORDER BY created_at_ms ASC').all() as SosRow[]
}

/** 直插一行（用于跨越保留期的用例，无法通过端点造时间）。 */
function insertRow(over: Partial<SosRow> & { id: string; client_event_id: string }): void {
  db.prepare(
    'INSERT INTO sos_events (id, client_event_id, user_id, is_drill, client_platform, created_at_ms) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    over.id, over.client_event_id, over.user_id ?? null, over.is_drill ?? 0,
    over.client_platform ?? '', over.created_at_ms ?? Date.now()
  )
}

describe('T4 sos_events 表结构：D1「不采位置」是结构性承诺', () => {
  it('★ 表中不存在任何位置类列（加一列 lat 即应让本用例变红）', () => {
    const cols = (db.prepare('PRAGMA table_info(sos_events)').all() as Array<{ name: string }>)
      .map(c => c.name.toLowerCase())
    expect(cols.length).toBeGreaterThan(0)
    // 按 `_` 切词后精确比对，**不能用子串匹配**：`client_platform` 含 "lat" 会被误伤。
    const tokens = cols.flatMap(n => n.split(/[^a-z0-9]+/))
    const FORBIDDEN = [
      'lat', 'lng', 'lon', 'latitude', 'longitude', 'location', 'loc',
      'geo', 'geohash', 'geojson', 'coord', 'coords', 'coordinate',
      'address', 'gps', 'district', 'position',
    ]
    // 列不存在 ⇒ 任何后续代码都写不进来（D1 的结构性承诺）。
    expect(tokens.filter(t => FORBIDDEN.includes(t))).toEqual([])
  })

  it('created_at_ms 必须落值且为合理毫秒时间戳（范围查询依赖它，不可退化为 0/NULL）', async () => {
    const before = Date.now()
    await request(server).post('/api/public/sos-event').send({ clientEventId: 'ts-1' })
    const after = Date.now()
    const r = rows()[0]
    expect(r.created_at_ms).toBeGreaterThanOrEqual(before)
    expect(r.created_at_ms).toBeLessThanOrEqual(after)
    expect(r.created_at).toBeTruthy()
  })
})

describe('T1/T2 身份：只从 token 派生，绝不读请求体', () => {
  it('T1 匿名（无 token）可上报成功，落库 user_id IS NULL', async () => {
    const res = await request(server)
      .post('/api/public/sos-event')
      .send({ clientEventId: 'evt-anon-1', isDrill: false, platform: 'h5' })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    const r = rows()
    expect(r.length).toBe(1)
    expect(r[0].user_id).toBeNull()
    expect(r[0].client_event_id).toBe('evt-anon-1')
    expect(r[0].client_platform).toBe('h5')
  })

  it('T2 带有效 token ⇒ user_id = token 身份；body 里的 userId 被忽略', async () => {
    const res = await request(server)
      .post('/api/public/sos-event')
      .set('Authorization', `Bearer ${userToken('user_001')}`)
      .send({ clientEventId: 'evt-tok-1', userId: 'victim_account' })

    expect(res.status).toBe(200)
    expect(rows()[0].user_id).toBe('user_001')
  })

  it('★ T2b 无 token 但 body 传 userId ⇒ 仍为 NULL（否则可把伪造 SOS 记到他人名下）', async () => {
    await request(server)
      .post('/api/public/sos-event')
      .send({ clientEventId: 'evt-forge', userId: 'victim_account' })

    expect(rows()[0].user_id).toBeNull()
  })

  it('无效 / 过期 token ⇒ 不报错，降级为匿名（埋点绝不因鉴权失败而打断急救）', async () => {
    const res = await request(server)
      .post('/api/public/sos-event')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ clientEventId: 'evt-badtok' })

    expect(res.status).toBe(200)
    expect(rows()[0].user_id).toBeNull()
  })
})

describe('T3 is_drill 归一化：必须严格白名单，不可用 !!', () => {
  it('★ 字符串假值 "false"/"0" 绝不能被判为演习（否则真实 SOS 会从反滥用计数中静默消失）', async () => {
    const cases: Array<[unknown, number]> = [
      [true, 1], [1, 1], ['1', 1], ['true', 1],
      ['false', 0], ['0', 0], [0, 0], [null, 0], [undefined, 0], ['yes', 0], ['', 0],
    ]
    for (let i = 0; i < cases.length; i++) {
      await request(server)
        .post('/api/public/sos-event')
        .send({ clientEventId: `drill-${i}`, isDrill: cases[i][0] })
    }
    const r = rows()
    for (let i = 0; i < cases.length; i++) {
      const [input, want] = cases[i]
      const row = r.find(x => x.client_event_id === `drill-${i}`)
      expect(row, `clientEventId=drill-${i} 应已落库`).toBeTruthy()
      expect(row!.is_drill, `isDrill=${JSON.stringify(input)} 应落为 ${want}`).toBe(want)
    }
  })
})

describe('T5 幂等与降级：绝不因格式问题丢弃一条 SOS 记录', () => {
  it('同一 client_event_id 重复提交 ⇒ 仅 1 行，第二次 duplicate=true', async () => {
    const first = await request(server).post('/api/public/sos-event').send({ clientEventId: 'dup-1' })
    const second = await request(server).post('/api/public/sos-event').send({ clientEventId: 'dup-1' })

    expect(first.body.data.duplicate).toBe(false)
    expect(second.body.data.duplicate).toBe(true)
    expect(rows().length).toBe(1)
  })

  it('缺省 / 超长 / 非字符串 clientEventId ⇒ 服务端生成且仍落库（不拒绝）', async () => {
    await request(server).post('/api/public/sos-event').send({})
    await request(server).post('/api/public/sos-event').send({ clientEventId: 'x'.repeat(500) })
    await request(server).post('/api/public/sos-event').send({ clientEventId: 12345 })

    const r = rows()
    expect(r.length).toBe(3)
    for (const row of r) {
      expect(row.client_event_id.length).toBeGreaterThan(0)
      expect(row.client_event_id.length).toBeLessThanOrEqual(64)
    }
    expect(new Set(r.map(x => x.client_event_id)).size).toBe(3)
  })

  it('平台字段超长被截断（防止无界字符串入库）', async () => {
    await request(server)
      .post('/api/public/sos-event')
      .send({ clientEventId: 'plat-1', platform: 'p'.repeat(500) })
    expect(rows()[0].client_platform.length).toBeLessThanOrEqual(32)
  })
})

describe('T8/T9 统计与保留期（生产路径，非测试自造 SQL）', () => {
  it('★ T8 演习污染率恒为 0：is_drill=1 绝不出现在「真实」计数中', async () => {
    await request(server).post('/api/public/sos-event')
      .set('Authorization', `Bearer ${userToken('u_a')}`)
      .send({ clientEventId: 'r1', isDrill: false })
    await request(server).post('/api/public/sos-event')
      .set('Authorization', `Bearer ${userToken('u_a')}`)
      .send({ clientEventId: 'd1', isDrill: true })
    await request(server).post('/api/public/sos-event')
      .set('Authorization', `Bearer ${userToken('u_a')}`)
      .send({ clientEventId: 'd2', isDrill: true })
    await request(server).post('/api/public/sos-event').send({ clientEventId: 'anon1' })

    // ⚠️ 匿名那一条也是**真实触发**（D2：无需注册也能呼救）⇒ real = r1 + anon1 = 2
    const all = countSosEvents()
    expect(all.real).toBe(2)
    expect(all.drill).toBe(2)
    expect(all.total).toBe(4) // u_a 的 3 条（1 真实 + 2 演习）+ 1 条匿名真实

    // 按账号过滤：真实数必须排除演习
    const ua = countSosEvents({ userId: 'u_a' })
    expect(ua.real).toBe(1)
    expect(ua.drill).toBe(2)
    expect(ua.total).toBe(3)

    // 只看匿名（user_id IS NULL）
    const anon = countSosEvents({ userId: null })
    expect(anon.real).toBe(1)
    expect(anon.total).toBe(1)
  })

  it('sinceMs 过滤走 created_at_ms 整数列（不依赖 strftime）', async () => {
    const old = Date.now() - 10 * 24 * 60 * 60 * 1000
    insertRow({ id: 'old-1', client_event_id: 'old-1', created_at_ms: old })
    await request(server).post('/api/public/sos-event').send({ clientEventId: 'new-1' })

    expect(countSosEvents().total).toBe(2)
    expect(countSosEvents({ sinceMs: retentionCutoffMs(1) }).total).toBe(1)
  })

  it('★ T9 purge：dry-run 只报数不删；真删按保留期生效', async () => {
    const ancient = Date.now() - 100 * 24 * 60 * 60 * 1000
    insertRow({ id: 'a-1', client_event_id: 'a-1', created_at_ms: ancient })
    insertRow({ id: 'a-2', client_event_id: 'a-2', created_at_ms: ancient })
    await request(server).post('/api/public/sos-event').send({ clientEventId: 'fresh-1' })

    const cutoff = retentionCutoffMs(SOS_RETENTION_DAYS)
    expect(purgeSosEvents(cutoff, true)).toBe(2)
    expect(rows().length).toBe(3) // dry-run 未删

    expect(purgeSosEvents(cutoff)).toBe(2)
    expect(rows().length).toBe(1)
    expect(rows()[0].client_event_id).toBe('fresh-1')
  })
})
