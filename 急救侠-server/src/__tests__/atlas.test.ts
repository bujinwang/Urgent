import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('Atlas Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/atlas/cards', () => {
    it('returns atlas cards', async () => {
      const res = await request(app).get('/api/atlas/cards')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].steps).toBeInstanceOf(Array)
    })
  })
})
