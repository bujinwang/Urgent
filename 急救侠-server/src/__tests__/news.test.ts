import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('News Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/news/list', () => {
    it('returns news list', async () => {
      const res = await request(app).get('/api/news/list')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].title).toBeTruthy()
    })
  })

  describe('GET /api/news/category/:cat', () => {
    it('filters by category', async () => {
      const res = await request(app).get('/api/news/category/recommend')
      expect(res.status).toBe(200)
      res.body.data.forEach((n: any) => {
        expect(n.category).toBe('recommend')
      })
    })
  })

  describe('GET /api/news/:id', () => {
    it('returns news by id', async () => {
      const res = await request(app).get('/api/news/n001')
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe('n001')
    })

    it('returns error for unknown id', async () => {
      const res = await request(app).get('/api/news/zzz')
      expect(res.body.code).toBe(-1)
    })
  })
})
