import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('Volunteer Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/volunteer/rankings', () => {
    it('returns volunteer rankings', async () => {
      const res = await request(app).get('/api/volunteer/rankings')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].name).toBeTruthy()
      expect(res.body.data[0].rank).toBeGreaterThan(0)
    })
  })
})
