import { Router } from 'express'
import { success, error } from '../types'

export const mediaAlertRouter = Router()

mediaAlertRouter.post('/upload', (req, res) => {
  try {
    const { imageCount, videoDuration } = req.body
    const uploadId = 'upload_' + Date.now()
    res.json(success({
      uploadId, status: 'success',
      imageCount: imageCount || 0,
      videoDuration: videoDuration || 0,
      message: '现场图片/视频已发送至 120 急救中心',
    }))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

mediaAlertRouter.get('/status/:uploadId', (req, res) => {
  res.json(success({ uploadId: req.params.uploadId, status: 'success' }))
})
