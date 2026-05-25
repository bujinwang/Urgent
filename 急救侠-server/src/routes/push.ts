import { Router } from 'express'
import { success, error } from '../types'
import { authMiddleware, AuthPayload } from '../middleware/auth'
import { WECHAT_APPID, WECHAT_SECRET } from '../config'
import db from '../db'

export const pushRouter = Router()

/** Get WeChat access_token (dev mock when no credentials configured) */
async function getWechatAccessToken(): Promise<string> {
  if (!WECHAT_APPID || !WECHAT_SECRET) {
    console.log('[Push] 开发模式：模拟 access_token')
    return 'dev_access_token_' + Date.now()
  }
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}`
  )
  const data: any = await res.json()
  if (data.errcode) {
    throw new Error(`获取 access_token 失败: ${data.errmsg} (${data.errcode})`)
  }
  return data.access_token
}

/** 注册推送订阅（小程序 templateId / 订阅结果） */
pushRouter.post('/register', authMiddleware, (req, res) => {
  try {
    const auth = (req as any).auth as AuthPayload
    const { templateId, accepted } = req.body

    const userId = auth.userId || auth.openid
    const tid = templateId || ''
    const acc = accepted !== undefined ? (accepted ? 1 : 0) : 1

    // Upsert: update if same user + template already exists
    const existing = db
      .prepare('SELECT id FROM push_subscriptions WHERE user_id=? AND template_id=?')
      .get(userId, tid) as { id: string } | undefined

    if (existing) {
      db.prepare('UPDATE push_subscriptions SET accepted=? WHERE user_id=? AND template_id=?').run(acc, userId, tid)
    } else {
      const id = 'ps_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      db.prepare('INSERT INTO push_subscriptions (id, user_id, template_id, accepted) VALUES (?,?,?,?)').run(id, userId, tid, acc)
    }

    console.log(`[Push] 用户订阅: userId=${userId}, templateId=${tid}, accepted=${acc}`)
    res.json(success(null, '推送注册成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/** 发送推送通知（管理员用）—— 向所有已订阅用户发送微信订阅消息 */
pushRouter.post('/send', authMiddleware, async (req, res) => {
  try {
    const auth = (req as any).auth as AuthPayload
    const userId = auth.userId || auth.openid

    // 验证管理员权限（is_leader = 1）
    const user = db.prepare('SELECT is_leader FROM users WHERE id = ?').get(userId) as { is_leader: number } | undefined
    if (!user || !user.is_leader) {
      return res.status(403).json(error('仅管理员可执行此操作'))
    }

    const subscriptions = db
      .prepare('SELECT * FROM push_subscriptions WHERE accepted=1')
      .all() as Array<{ id: string; user_id: string; template_id: string }>

    if (subscriptions.length === 0) {
      console.log('[Push] 无活跃订阅')
      return res.json(success({ sent: 0, total: 0 }, '无活跃订阅，无推送发送'))
    }

    const accessToken = await getWechatAccessToken()
    let sentCount = 0

    for (const sub of subscriptions) {
      try {
        const body = {
          touser: sub.user_id,
          template_id: sub.template_id,
          page: 'pages/index/index',
          data: {
            thing1: { value: '急救侠提醒' },
            thing2: { value: '您有一条新的急救任务' },
          },
          miniprogram_state: 'formal',
        }

        // Dev mode: mock send
        if (accessToken.startsWith('dev_')) {
          console.log(`[Push] 开发模式：模拟发送至 ${sub.user_id}, template=${sub.template_id}`)
          sentCount++
          continue
        }

        const wechatRes = await fetch(
          `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        )
        const result: any = await wechatRes.json()
        if (result.errcode === 0) {
          sentCount++
        } else {
          console.error(`[Push] 发送失败: userId=${sub.user_id}, errcode=${result.errcode}, errmsg=${result.errmsg}`)
          // Deactivate subscription on rejections (user unsubscribed / invalid)
          if (result.errcode === 43101 || result.errcode === 40003) {
            db.prepare('UPDATE push_subscriptions SET accepted=0 WHERE id=?').run(sub.id)
          }
        }
      } catch (err: any) {
        console.error(`[Push] 发送异常: userId=${sub.user_id}, error=${err.message}`)
      }
    }

    res.json(
      success(
        { sent: sentCount, total: subscriptions.length },
        `推送已发送：${sentCount}/${subscriptions.length}`
      )
    )
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
