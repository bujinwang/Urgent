import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import { app, seedTestData } from './setup'

// 本次测试落盘的文件，结束后清理，避免累积
const MEDIA_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'media')
const createdFiles: string[] = []

afterAll(() => {
  for (const p of createdFiles) {
    try { fs.unlinkSync(p) } catch { /* 忽略已不存在 */ }
  }
})

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
      // 新增字段表达实际上传数量；既有 imageCount 语义不变（仅取请求体）
      expect(res.body.data.uploadedCount).toBe(1)
      expect(res.body.data.imageCount).toBe(0)
      // 记录落盘文件，afterAll 清理
      createdFiles.push(path.join(MEDIA_DIR, path.basename(res.body.data.url)))
    })

    it('既有字段与文案保持不变（严格只增不改）', async () => {
      const res = await request(app)
        .post('/api/media-alert/upload')
        .send({ imageCount: 2, videoDuration: 8 })
      expect(res.body.data.imageCount).toBe(2)
      expect(res.body.data.videoDuration).toBe(8)
      expect(res.body.data.message).toBe('现场图片/视频已发送至 120 急救中心')
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
