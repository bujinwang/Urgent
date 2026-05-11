import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('Records Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/records/list', () => {
    it('returns rescue records', async () => {
      const res = await request(app).get('/api/records/list')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].type).toBeTruthy()
    })
  })
})
