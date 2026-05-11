import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { app, seedTestData, clearAll } from './setup'

describe('Task Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/task/active', () => {
    it('returns active task', async () => {
      const res = await request(app).get('/api/task/active')
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe('task_001')
      expect(res.body.data.type).toBe('cpr')
    })

    it('returns null when no active task', async () => {
      // Complete the task first
      await request(app)
        .post('/api/task/complete')
        .send({ taskId: 'task_001' })
      const res = await request(app).get('/api/task/active')
      expect(res.body.data).toBeNull()
    })
  })

  describe('GET /api/task/list', () => {
    it('returns task list', async () => {
      const res = await request(app).get('/api/task/list')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('POST /api/task/accept', () => {
    it('accepts a task', async () => {
      const res = await request(app)
        .post('/api/task/accept')
        .send({ taskId: 'task_001' })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })
  })

  describe('POST /api/task/complete', () => {
    it('completes a task', async () => {
      const res = await request(app)
        .post('/api/task/complete')
        .send({ taskId: 'task_001' })
      expect(res.status).toBe(200)

      const active = await request(app).get('/api/task/active')
      expect(active.body.data).toBeNull()
    })
  })
})
