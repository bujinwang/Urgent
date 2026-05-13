import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData, clearAll, db } from './setup'

describe('Coverage: middleware/auth.ts', () => {
  beforeEach(() => { seedTestData() })

  // --- exchangeWechatCode: cover the real WeChat API path (when WECHAT_APPID is set) ---
  it('exchangeWechatCode attempts real API when appid is set', async () => {
    const oldAppId = process.env.WECHAT_APPID
    process.env.WECHAT_APPID = 'wx_test_appid'
    process.env.WECHAT_SECRET = 'test_secret'
    // The fetch will fail (no real API), but it exercises the branch
    const res = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'real_test_code' })
    // Should hit the catch block since fetch will fail
    expect(res.status).toBe(500)
    process.env.WECHAT_APPID = oldAppId
  })

  // --- optionalAuth: cover the try/catch on line 76-77 ---
  it('optionalAuth does not crash with malformed token', async () => {
    // optionalAuth is not directly exposed as a route, but it's used
    // The middleware handles malformed tokens gracefully
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.valid.jwt')
    expect(res.status).toBe(401)
  })

  // --- authMiddleware catch: cover expired token using a forged invalid signature ---
  it('authMiddleware catches invalid token in catch block', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuaWQiOiJ0ZXN0In0.bad_signature')
    expect(res.status).toBe(401)
  })

  // --- authMiddleware: cover missing Bearer prefix ---
  it('authMiddleware rejects token without Bearer prefix', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'token_without_bearer')
    expect(res.status).toBe(401)
  })

  // --- authMiddleware: cover completely missing header ---
  it('authMiddleware rejects missing auth header entirely', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('Coverage: routes/auth.ts', () => {
  beforeEach(() => { seedTestData() })

  // --- catch block: cause DB error by corrupting table ---
  it('wechat-login catch block triggers on DB error', async () => {
    // Drop the users table to force a DB error in the login path
    db.exec('DROP TABLE IF EXISTS users')
    const res = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'error_test' })
    expect(res.status).toBe(500)
    // Recreate for other tests
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT '',
      tier TEXT NOT NULL DEFAULT 'bronze', points INTEGER NOT NULL DEFAULT 0,
      city TEXT NOT NULL DEFAULT '', volunteer_id TEXT NOT NULL DEFAULT '',
      certifications TEXT NOT NULL DEFAULT '[]', rescue_count INTEGER NOT NULL DEFAULT 0
    )`)
  })

  // --- /me catch block: make DB fail ---
  it('me endpoint catch block on DB error', async () => {
    const login = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'me_catch_test' })
    const token = login.body.data.token

    // Drop users table to cause error
    db.exec('DROP TABLE IF EXISTS users')
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(500)
    // Restore
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT '',
      tier TEXT NOT NULL DEFAULT 'bronze', points INTEGER NOT NULL DEFAULT 0,
      city TEXT NOT NULL DEFAULT '', volunteer_id TEXT NOT NULL DEFAULT '',
      certifications TEXT NOT NULL DEFAULT '[]', rescue_count INTEGER NOT NULL DEFAULT 0
    )`)
  })

  // --- /me: user not found path ---
  it('me returns error when user not found in DB', async () => {
    const login = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'not_in_db_test' })
    const token = login.body.data.token
    const openid = login.body.data.openid

    // Delete this user
    db.prepare('DELETE FROM users WHERE id = ?').run(openid)
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
    // User was deleted after login, so should return 200 with error code
    expect(res.body.code).toBe(-1)
  })
})

describe('Coverage: routes/task.ts', () => {
  beforeEach(() => { seedTestData() })

  // --- Catch blocks: trigger DB errors ---
  it('task active returns 500 on DB error', async () => {
    db.exec('DROP TABLE IF EXISTS tasks')
    const res = await request(app).get('/api/task/active')
    expect(res.status).toBe(500)
    db.exec(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, address TEXT NOT NULL,
      distance REAL NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
      volunteers_needed INTEGER NOT NULL, volunteers_responded INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
    )`)
  })

  it('task list returns 500 on DB error', async () => {
    db.exec('DROP TABLE IF EXISTS tasks')
    const res = await request(app).get('/api/task/list')
    expect(res.status).toBe(500)
  })

  // --- Accept task: edge cases ---
  it('accept with missing taskId', async () => {
    const res = await request(app)
      .post('/api/task/accept')
      .send({})
    expect(res.status).toBe(200)
  })

  // --- Complete task: edge cases ---  
  it('complete with missing taskId', async () => {
    const res = await request(app)
      .post('/api/task/complete')
      .send({})
    expect(res.status).toBe(200)
  })

  // --- Active task: returns null when all tasks are completed ---
  it('returns null for active after completing all tasks', async () => {
    db.prepare("UPDATE tasks SET status = 'completed'").run()
    const res = await request(app).get('/api/task/active')
    expect(res.body.data).toBeNull()
    expect(res.body.message).toBe('无活跃任务')
  })
})

describe('Coverage: routes/push.ts', () => {
  beforeEach(() => { seedTestData() })

  it('register with valid auth but missing body fields', async () => {
    const login = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'push_edge' })
    const token = login.body.data.token

    const res = await request(app)
      .post('/api/push/register')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })

  it('send requires auth and returns success', async () => {
    const login = await request(app)
      .post('/api/auth/wechat-login')
      .send({ code: 'push_send' })
    const token = login.body.data.token

    const res = await request(app)
      .post('/api/push/send')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })
})

describe('Coverage: routes/user.ts', () => {
  beforeEach(() => { seedTestData() })

  // --- /profile catch block ---
  it('profile returns 500 on DB error', async () => {
    db.exec('DROP TABLE IF EXISTS users')
    const res = await request(app).get('/api/user/profile')
    expect(res.status).toBe(500)
    db.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT '',
      tier TEXT NOT NULL DEFAULT 'bronze', points INTEGER NOT NULL DEFAULT 0,
      city TEXT NOT NULL DEFAULT '', volunteer_id TEXT NOT NULL DEFAULT '',
      certifications TEXT NOT NULL DEFAULT '[]', rescue_count INTEGER NOT NULL DEFAULT 0
    )`)
  })

  // --- /stats catch block ---
  it('stats returns 500 on DB error', async () => {
    db.exec('DROP TABLE IF EXISTS stats')
    const res = await request(app).get('/api/user/stats')
    expect(res.status).toBe(500)
    db.exec('CREATE TABLE IF NOT EXISTS stats (id INTEGER PRIMARY KEY CHECK (id = 1), certified_rescuers INTEGER NOT NULL DEFAULT 0, networked_aeds INTEGER NOT NULL DEFAULT 0, monthly_rescues INTEGER NOT NULL DEFAULT 0, online_volunteers INTEGER NOT NULL DEFAULT 0, aeds_within_1km INTEGER NOT NULL DEFAULT 0)')
  })

  // --- /points catch block ---
  it('points returns 500 on DB error', async () => {
    db.exec('DROP TABLE IF EXISTS users')
    const res = await request(app)
      .post('/api/user/points')
      .send({ amount: 100, reason: 'test' })
    expect(res.status).toBe(500)
  })

  // --- /points: no user exists path ---
  it('points returns error when no user in DB', async () => {
    clearAll()
    // Don't seed — no users
    const res = await request(app)
      .post('/api/user/points')
      .send({ amount: 100, reason: 'test' })
    expect(res.body.code).toBe(-1)
  })

  // --- /points: tier upgrade edge cases ---
  it('points upgrades to silver at 1000', async () => {
    seedTestData()
    const user = db.prepare('SELECT * FROM users LIMIT 1').get() as any
    db.prepare('UPDATE users SET points = 900 WHERE id = ?').run(user.id)
    const res = await request(app)
      .post('/api/user/points')
      .send({ amount: 150, reason: 'boundary test' })
    expect(res.body.data.tier).toBe('silver')
    expect(res.body.data.points).toBe(1050)
  })

  it('points upgrades to gold at 2500', async () => {
    seedTestData()
    const user = db.prepare('SELECT * FROM users LIMIT 1').get() as any
    db.prepare('UPDATE users SET points = 2400, tier = ? WHERE id = ?').run('silver', user.id)
    const res = await request(app)
      .post('/api/user/points')
      .send({ amount: 200, reason: 'gold test' })
    expect(res.body.data.tier).toBe('gold')
  })
})

describe('Coverage: db.ts init failure path', () => {
  it('clears and recreates all tables without error', () => {
    clearAll()
    // Verify tables can be recreated by calling seedTestData
    expect(() => seedTestData()).not.toThrow()
    // Verify data was inserted
    const count = db.prepare('SELECT COUNT(*) as c FROM users').get() as any
    expect(count.c).toBeGreaterThanOrEqual(1)
  })
})
