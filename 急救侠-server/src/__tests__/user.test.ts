import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('User Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/user/profile', () => {
    it('returns user profile', async () => {
      const res = await request(app).get('/api/user/profile')
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data.name).toBe('陆远')
      expect(res.body.data.tier).toBe('gold')
      expect(res.body.data.points).toBe(2340)
    })
  })

  describe('GET /api/user/stats', () => {
    it('returns platform stats', async () => {
      const res = await request(app).get('/api/user/stats')
      expect(res.status).toBe(200)
      expect(res.body.data.certifiedRescuers).toBe(12847)
      expect(res.body.data.networkedAeds).toBe(3256)
      expect(res.body.data.monthlyRescues).toBe(89)
    })
  })

  describe('POST /api/user/points', () => {
    it('awards points and updates tier', async () => {
      const res = await request(app)
        .post('/api/user/points')
        .send({ amount: 200, reason: '测试奖励' })
      expect(res.status).toBe(200)
      expect(res.body.data.points).toBe(2540)
      expect(res.body.data.tier).toBe('gold') // still gold, need 2500 for gold
    })

    it('upgrades tier when threshold reached', async () => {
      const res = await request(app)
        .post('/api/user/points')
        .send({ amount: 3000, reason: '大量奖励' })
      expect(res.body.data.points).toBe(5340)
      expect(res.body.data.tier).toBe('diamond')
    })
  })
})
