import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, userToken } from './setup'

/**
 * Low-coverage route files: add 1–2 happy-path tests per file
 * to raise statement coverage above the 35% threshold.
 */

describe('Low-coverage: community routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/community/groups returns list', async () => {
    const res = await request(server).get('/api/community/groups')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Low-coverage: volunteer routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/volunteer/rankings returns list', async () => {
    const res = await request(server).get('/api/volunteer/rankings')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /api/volunteer/coaches returns list', async () => {
    const res = await request(server).get('/api/volunteer/coaches')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Low-coverage: drill routes', () => {
  beforeEach(() => { seedTestData() })

  it('POST /api/drill/events creates a drill', async () => {
    // ★ P0-1：organizerId 不再取自 body（可伪造），组织者恒为 **token 身份**（此处 user_001）。
    const res = await request(server)
      .post('/api/drill/events')
      .set('Authorization', `Bearer ${userToken('user_001')}`)
      .send({ title: 'Test Drill', date: '2025-06-01' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })
})

describe('Low-coverage: trail routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/trail/hikers returns list', async () => {
    const res = await request(server).get('/api/trail/hikers')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Low-coverage: public routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/public/verify/:id returns error for unknown ID', async () => {
    const res = await request(server).get('/api/public/verify/nonexistent')
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(-1)
  })
})

describe('Low-coverage: replay routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/replay returns list', async () => {
    const res = await request(server).get('/api/replay')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Low-coverage: rescue routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/rescue/mobilizations returns list', async () => {
    // ★ P0-1：rescue 全文件端点均已挂 authMiddleware，需带合法 token。
    const res = await request(server)
      .get('/api/rescue/mobilizations')
      .set('Authorization', `Bearer ${userToken('user_001')}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Low-coverage: video routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/video/recommend returns paginated result', async () => {
    const res = await request(server).get('/api/video/recommend')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('items')
    expect(Array.isArray(res.body.data.items)).toBe(true)
  })
})

describe('Low-coverage: wildlife routes', () => {
  beforeEach(() => { seedTestData() })

  it('POST /api/wildlife/report rejects non-wildlife user', async () => {
    const res = await request(server)
      .post('/api/wildlife/report')
      .send({ userId: 'user_001', species: 'test' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(-1)
  })
})

describe('Input validation (Zod)', () => {
  beforeEach(() => { seedTestData() })

  it('push/register rejects missing templateId', async () => {
    const login = await request(server)
      .post('/api/auth/wechat-login')
      .send({ code: 'val_push' })
    const token = login.body.data.token

    const res = await request(server)
      .post('/api/push/register')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe(-1)
    expect(res.body.errors).toBeDefined()
  })

  it('auth/register rejects missing phone', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ password: '123456' })
    expect(res.status).toBe(400)
    expect(res.body.errors).toBeDefined()
  })

  it('auth/register accepts valid input', async () => {
    const res = await request(server)
      .post('/api/auth/register')
      .send({ phone: '13800138001', password: 'pass123' })
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
  })
})

describe('Coverage boost: org routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/org/:id returns error for unknown org', async () => {
    const res = await request(server).get('/api/org/nonexistent')
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(-1)
  })

  it('GET /api/org/:id/members returns empty array', async () => {
    const res = await request(server).get('/api/org/nonexistent/members')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/org/:id/certificates returns empty array', async () => {
    const res = await request(server).get('/api/org/nonexistent/certificates')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Coverage boost: wildlife routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/wildlife/reports returns list', async () => {
    const res = await request(server).get('/api/wildlife/reports')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/wildlife/rescue returns list', async () => {
    const res = await request(server).get('/api/wildlife/rescue')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})

describe('Coverage boost: drill routes', () => {
  beforeEach(() => { seedTestData() })

  it('GET /api/drill/events returns list', async () => {
    const res = await request(server).get('/api/drill/events')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET /api/drill/organizers returns list', async () => {
    const res = await request(server).get('/api/drill/organizers')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })
})
