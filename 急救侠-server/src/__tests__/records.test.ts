import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData } from './setup'

describe('Records Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/records/list', () => {
    it('returns rescue records', async () => {
      const res = await request(server).get('/api/records/list')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].type).toBeTruthy()
    })
  })

  describe('GET /api/records/:id', () => {
    it('returns a single record（结构与列表项一致）', async () => {
      const res = await request(server).get('/api/records/rec_001')
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
      expect(res.body.data.id).toBe('rec_001')
      expect(res.body.data.role).toBeTruthy()
      expect(Array.isArray(res.body.data.squad)).toBe(true)
    })

    it('404 + 语义明确错误 when not found', async () => {
      const res = await request(server).get('/api/records/nope')
      expect(res.status).toBe(404)
      expect(res.body.message).toContain('不存在')
    })
  })
})
