import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('Learn Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/learn/courses', () => {
    it('returns course list', async () => {
      const res = await request(app).get('/api/learn/courses')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('POST /api/learn/progress', () => {
    it('updates course progress', async () => {
      const res = await request(app)
        .post('/api/learn/progress')
        .send({ courseId: 'course_001', progress: 0.8 })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data.progress).toBe(0.8)
    })

    it('marks course completed when progress >= 1', async () => {
      const res = await request(app)
        .post('/api/learn/progress')
        .send({ courseId: 'course_001', progress: 1.0 })
      expect(res.body.data.completed).toBe(true)
    })
  })
})
