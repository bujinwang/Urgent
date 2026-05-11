import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('AED Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/aed/nearby', () => {
    it('returns nearby AED list', async () => {
      const res = await request(app).get('/api/aed/nearby')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].name).toBeTruthy()
      expect(res.body.data[0].distance).toBeGreaterThanOrEqual(0)
    })

    it('accepts lat/lng query params', async () => {
      const res = await request(app).get('/api/aed/nearby?lat=22.5&lng=113.9')
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })
  })

  describe('GET /api/aed/:id', () => {
    it('returns AED by id', async () => {
      const res = await request(app).get('/api/aed/aed_001')
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe('aed_001')
    })

    it('returns error for unknown id', async () => {
      const res = await request(app).get('/api/aed/nonexistent')
      expect(res.body.code).toBe(-1)
    })
  })
})
