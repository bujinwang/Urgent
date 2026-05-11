import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('Cases Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/cases/list', () => {
    it('returns case list', async () => {
      const res = await request(app).get('/api/cases/list')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('GET /api/cases/:id', () => {
    it('returns case by id', async () => {
      const res = await request(app).get('/api/cases/case_001')
      expect(res.status).toBe(200)
      expect(res.body.data.title).toContain('心脏骤停')
    })

    it('returns error for unknown id', async () => {
      const res = await request(app).get('/api/cases/zzz')
      expect(res.body.code).toBe(-1)
    })
  })
})
