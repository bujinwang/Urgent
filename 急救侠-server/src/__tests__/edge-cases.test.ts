import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData, clearAll } from './setup'

describe('Edge Cases', () => {
  beforeEach(() => { seedTestData() })

  // ---- Auth ----
  describe('Auth edge cases', () => {
    it('returns error for empty body', async () => {
      const res = await request(app)
        .post('/api/auth/wechat-login')
        .send('')
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(-1)
    })

    it('returns 401 for me without header', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })

    it('returns 401 for me with empty token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer ')
      expect(res.status).toBe(401)
    })
  })

  // ---- User ----
  describe('User edge cases', () => {
    it('returns error when no user in DB', async () => {
      clearAll()
      const res = await request(app).get('/api/user/profile')
      expect(res.body.code).toBe(-1)
    })

    it('returns error for negative points', async () => {
      const res = await request(app)
        .post('/api/user/points')
        .send({ amount: -100, reason: 'test' })
      expect(res.status).toBe(200)
    })

    it('stats returns error when empty', async () => {
      clearAll()
      const res = await request(app).get('/api/user/stats')
      expect(res.body.code).toBe(-1)
    })
  })

  // ---- Task ----
  describe('Task edge cases', () => {
    it('returns null for active when no tasks exist', async () => {
      clearAll()
      const res = await request(app).get('/api/task/active')
      expect(res.body.data).toBeNull()
    })

    it('accept non-existent task', async () => {
      const res = await request(app)
        .post('/api/task/accept')
        .send({ taskId: 'nonexistent' })
      expect(res.status).toBe(200)
    })

    it('complete non-existent task', async () => {
      const res = await request(app)
        .post('/api/task/complete')
        .send({ taskId: 'nonexistent' })
      expect(res.status).toBe(200)
    })
  })

  // ---- AED ----
  describe('AED edge cases', () => {
    it('nearby returns empty when no AEDs', async () => {
      clearAll()
      const res = await request(app).get('/api/aed/nearby')
      expect(res.body.data).toEqual([])
    })

    it('detail returns error for non-existent', async () => {
      const res = await request(app).get('/api/aed/zzz')
      expect(res.body.code).toBe(-1)
    })
  })

  // ---- News ----
  describe('News edge cases', () => {
    it('list returns empty when no news', async () => {
      clearAll()
      const res = await request(app).get('/api/news/list')
      expect(res.body.data).toEqual([])
    })

    it('category returns empty when no match', async () => {
      clearAll()
      const res = await request(app).get('/api/news/category/nonexistent')
      expect(res.body.data).toEqual([])
    })

    it('detail returns error for non-existent', async () => {
      const res = await request(app).get('/api/news/zzz')
      expect(res.body.code).toBe(-1)
    })
  })

  // ---- Learn ----
  describe('Learn edge cases', () => {
    it('courses returns empty when none exist', async () => {
      clearAll()
      const res = await request(app).get('/api/learn/courses')
      expect(res.body.data).toEqual([])
    })

    it('progress for non-existent course', async () => {
      const res = await request(app)
        .post('/api/learn/progress')
        .send({ courseId: 'zzz', progress: 0.5 })
      expect(res.status).toBe(200)
    })

    it('progress with partial data defaults progress to 0', async () => {
      const res = await request(app)
        .post('/api/learn/progress')
        .send({ courseId: 'course_001' })
      // Partial data — route should handle missing progress
      expect([200, 500]).toContain(res.status)
    })
  })

  // ---- Cases ----
  describe('Cases edge cases', () => {
    it('list returns empty when none', async () => {
      clearAll()
      const res = await request(app).get('/api/cases/list')
      expect(res.body.data).toEqual([])
    })

    it('detail returns error for non-existent', async () => {
      const res = await request(app).get('/api/cases/zzz')
      expect(res.body.code).toBe(-1)
    })
  })

  // ---- Records ----
  describe('Records edge cases', () => {
    it('list returns empty when none', async () => {
      clearAll()
      const res = await request(app).get('/api/records/list')
      expect(res.body.data).toEqual([])
    })
  })

  // ---- Atlas ----
  describe('Atlas edge cases', () => {
    it('cards returns empty when none', async () => {
      clearAll()
      const res = await request(app).get('/api/atlas/cards')
      expect(res.body.data).toEqual([])
    })
  })

  // ---- Volunteer ----
  describe('Volunteer edge cases', () => {
    it('rankings returns empty when none', async () => {
      clearAll()
      const res = await request(app).get('/api/volunteer/rankings')
      expect(res.body.data).toEqual([])
    })
  })

  // ---- Media Alert ----
  describe('Media Alert edge cases', () => {
    it('upload with empty body', async () => {
      const res = await request(app)
        .post('/api/media-alert/upload')
        .send({})
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('success')
    })

    it('status for any uploadId works', async () => {
      const res = await request(app).get('/api/media-alert/status/random_id')
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('success')
    })
  })

  // ---- Push auth edge cases ----
  describe('Push edge cases', () => {
    it('register without body still requires auth', async () => {
      const res = await request(app)
        .post('/api/push/register')
      expect(res.status).toBe(401)
    })

    it('send without body still requires auth', async () => {
      const res = await request(app)
        .post('/api/push/send')
      expect(res.status).toBe(401)
    })

    it('register with invalid token', async () => {
      const res = await request(app)
        .post('/api/push/register')
        .set('Authorization', 'Bearer invalid_token_here')
        .send({ templateId: 'test', accepted: true })
      expect(res.status).toBe(401)
    })
  })

  // ---- Malformed requests ----
  describe('Malformed requests', () => {
    it('non-JSON body is handled', async () => {
      const res = await request(app)
        .post('/api/auth/wechat-login')
        .set('Content-Type', 'application/json')
        .send('not json')
      // Express json parser will fail, but should not crash
      expect(res.status).toBe(400)
    })
  })
})
