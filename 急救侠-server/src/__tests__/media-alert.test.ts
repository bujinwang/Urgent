import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app, seedTestData } from './setup'

describe('Media Alert Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('POST /api/media-alert/upload', () => {
    it('returns upload result', async () => {
      const res = await request(app)
        .post('/api/media-alert/upload')
        .send({ imageCount: 3, videoDuration: 15 })
      expect(res.status).toBe(200)
      expect(res.body.data.uploadId).toBeTruthy()
      expect(res.body.data.status).toBe('success')
      expect(res.body.data.imageCount).toBe(3)
    })

    it('handles zero files', async () => {
      const res = await request(app)
        .post('/api/media-alert/upload')
        .send({ imageCount: 0 })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('success')
    })
  })

  describe('GET /api/media-alert/status/:uploadId', () => {
    it('returns upload status', async () => {
      const res = await request(app).get('/api/media-alert/status/test_id')
      expect(res.status).toBe(200)
      expect(res.body.data.uploadId).toBe('test_id')
      expect(res.body.data.status).toBe('success')
    })
  })
})
