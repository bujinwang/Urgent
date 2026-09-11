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

    it('multipart 上传：二进制落盘并返回可访问 URL', async () => {
      const res = await request(app)
        .post('/api/media-alert/upload')
        .attach('file', Buffer.from('fake-image-bytes'), { filename: 'scene.jpg', contentType: 'image/jpeg' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('success')
      expect(res.body.data.url).toMatch(/^\/uploads\/media\//)
      expect(res.body.data.urls).toHaveLength(1)
      expect(res.body.data.urls[0].type).toBe('image')
      expect(res.body.data.imageCount).toBe(1)
    })

    it('类型白名单：拒绝不在白名单的扩展名', async () => {
      const res = await request(app)
        .post('/api/media-alert/upload')
        .attach('file', Buffer.from('x'), { filename: 'evil.exe', contentType: 'application/octet-stream' })
      expect(res.status).toBe(400)
      expect(res.body.message).toContain('不支持')
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
