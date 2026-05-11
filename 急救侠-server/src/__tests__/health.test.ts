import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('GET /api/health', () => {
  beforeEach(() => { seedTestData() })

  it('returns status ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(0)
    expect(res.body.message).toContain('急救侠')
  })
})
