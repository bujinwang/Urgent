import { Router } from 'express'
import { success, error } from '../types'
import { authMiddleware } from '../middleware/auth'

export const pushRouter = Router()

/** 注册推送 token（小程序 formId / 订阅结果） */
pushRouter.post('/register', authMiddleware, (req, res) => {
  try {
    const { templateId, accepted } = req.body
    // TODO: 存储 token/push 信息到数据库
    console.log(`[Push] 用户订阅: templateId=${templateId}, accepted=${accepted}`)
    res.json(success(null, '推送注册成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/** 发送测试推送（管理员用） */
pushRouter.post('/send', authMiddleware, (_req, res) => {
  // TODO: 调用微信订阅消息发送 API
  res.json(success(null, '推送已发送'))
})
