import { WECHAT_APPID, WECHAT_SECRET } from '../config'
import db, { all } from '../db'

/**
 * 微信订阅消息模板 id。
 * 真实 id 需在小程序后台申请后替换（`aedCustodianRequest` 为本次新增模板）。
 */
export const PUSH_TEMPLATES = {
  newMission: 'tpl_new_mission',        // 新救援任务提醒
  taskUpdate: 'tpl_task_update',        // 任务状态变更
  drillReminder: 'tpl_drill_reminder',  // 演习提醒
  aedMaintenance: 'tpl_aed_maint',      // AED 维护提醒
  aedCustodianRequest: 'tpl_aed_custodian_request', // ★ AED 责任人求助
} as const

export interface SendResult {
  ok: boolean
  reason?: 'no_subscription' | 'send_failed' | 'exception'
  errcode?: number
}

interface TokenResponse {
  access_token?: string
  errcode?: number
  errmsg?: string
}

interface SendResponse {
  errcode?: number
  errmsg?: string
}

interface PushSubscriptionLite {
  id: string
  user_id: string
  template_id: string
}

/** Get WeChat access_token (dev mock when no credentials configured). */
export async function getWechatAccessToken(): Promise<string> {
  if (!WECHAT_APPID || !WECHAT_SECRET) {
    console.log('[Push] 开发模式：模拟 access_token')
    return 'dev_access_token_' + Date.now()
  }
  const res = await fetch(
    `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WECHAT_APPID}&secret=${WECHAT_SECRET}`
  )
  const data = (await res.json()) as TokenResponse
  if (data.errcode) {
    throw new Error(`获取 access_token 失败: ${data.errmsg} (${data.errcode})`)
  }
  return data.access_token || ''
}

/**
 * 向**指定 user_id** 定向发送一条微信订阅消息。
 *
 * 与 `POST /api/push/send` 的「群发全部 accepted 订阅」不同：本函数只针对单个用户、
 * 单个模板发送，供「AED 责任人求助」等定向场景复用。
 *
 * @returns
 * - `{ ok:true }` 至少一条订阅发送成功
 * - `{ ok:false, reason:'no_subscription' }` 该用户无有效订阅（P1 短信降级点）
 * - `{ ok:false, reason:'send_failed', errcode }` 有订阅但全部发送失败
 * - `{ ok:false, reason:'exception' }` 发送过程抛异常
 */
export async function sendPushToUser(
  userId: string,
  opts: { templateId: string; page?: string; data: Record<string, { value: string }> }
): Promise<SendResult> {
  try {
    const subs = all<PushSubscriptionLite>(
      'SELECT id, user_id, template_id FROM push_subscriptions WHERE user_id=? AND template_id=? AND accepted=1',
      userId,
      opts.templateId
    )

    if (subs.length === 0) {
      return { ok: false, reason: 'no_subscription' }
    }

    const accessToken = await getWechatAccessToken()
    let sent = 0
    let lastErrcode: number | undefined
    let hadException = false

    for (const sub of subs) {
      try {
        const body = {
          touser: sub.user_id,
          template_id: sub.template_id,
          page: opts.page || 'pages/aed/index',
          data: opts.data,
          miniprogram_state: 'formal',
        }

        // Dev mode: mock send (token 以 dev_ 开头)
        if (accessToken.startsWith('dev_')) {
          console.log(`[Push] 开发模式：模拟定向发送至 ${sub.user_id}, template=${sub.template_id}`)
          sent++
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
        const result = (await wechatRes.json()) as SendResponse
        if (result.errcode === 0) {
          sent++
        } else {
          lastErrcode = result.errcode
          console.error(`[Push] 定向发送失败: userId=${sub.user_id}, errcode=${result.errcode}, errmsg=${result.errmsg}`)
          // 用户拒收 / 无效订阅 → 置 accepted=0
          if (result.errcode === 43101 || result.errcode === 40003) {
            db.prepare('UPDATE push_subscriptions SET accepted=0 WHERE id=?').run(sub.id)
          }
        }
      } catch (err) {
        hadException = true
        console.error(`[Push] 定向发送异常: userId=${sub.user_id}, error=${(err as Error).message}`)
      }
    }

    if (sent > 0) return { ok: true }
    return { ok: false, reason: hadException ? 'exception' : 'send_failed', errcode: lastErrcode }
  } catch (err) {
    console.error(`[Push] sendPushToUser 异常: ${(err as Error).message}`)
    return { ok: false, reason: 'exception' }
  }
}
