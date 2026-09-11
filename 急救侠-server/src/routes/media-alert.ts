import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { success, error } from '../types'

export const mediaAlertRouter = Router()

// 落盘目录：public/uploads/media（与 /uploads 静态服务一致）
const MEDIA_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'media')

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']
const VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp']
const ALLOWED_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS]

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true })
    cb(null, MEDIA_DIR)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin'
    cb(null, `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${ext}`)
  },
})

// 大小 / 类型白名单（P0 安全备注：补齐上传校验）
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ALLOWED_EXTS.includes(ext)) return cb(null, true)
    cb(new Error('不支持的文件类型: ' + ext))
  },
})

interface UploadedMedia {
  url: string
  type: 'image' | 'video'
  size: number
}

/**
 * POST /api/media-alert/upload — 现场媒体上传（multipart，二进制落盘）。
 *
 * 只增不改：保留既有 `uploadId/status/imageCount/videoDuration/message` 字段，
 * 新增 `url`（首个文件）与 `urls`（全部文件，含落盘后可访问 URL）。
 */
mediaAlertRouter.post('/upload', (req, res) => {
  upload.any()(req, res, (err: unknown) => {
    if (err) return res.status(400).json(error(err instanceof Error ? err.message : '上传失败'))
    try {
      const rawFiles = req.files
      const files = Array.isArray(rawFiles) ? rawFiles : []
      const urls: UploadedMedia[] = files.map((f) => ({
        url: `/uploads/media/${f.filename}`,
        type: (f.mimetype || '').startsWith('video') ? 'video' : 'image',
        size: f.size,
      }))

      const body = (req.body || {}) as Record<string, string | undefined>
      // 严格「只增不改」：imageCount / videoDuration / message 保持既有语义与文案不变；
      // 实际上传数量与落盘 URL 通过新增字段 uploadedCount / url / urls 表达。
      const imageCount = Number(body.imageCount) || 0
      const videoDuration = Number(body.videoDuration) || 0
      const uploadId = 'upload_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)

      res.json(success({
        uploadId,
        status: 'success',
        imageCount,
        videoDuration,
        url: urls[0] ? urls[0].url : '',
        urls,
        uploadedCount: urls.length,
        message: '现场图片/视频已发送至 120 急救中心',
      }))
    } catch (e: unknown) {
      res.status(500).json(error(e instanceof Error ? e.message : '服务器错误'))
    }
  })
})

mediaAlertRouter.get('/status/:uploadId', (req, res) => {
  res.json(success({ uploadId: req.params.uploadId, status: 'success' }))
})
