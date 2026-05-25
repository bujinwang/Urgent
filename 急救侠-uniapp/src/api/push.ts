/**
 * 推送订阅 API
 */

import { request } from './index'

export interface PushSubscription {
  id: string
  templateId: string
  accepted: boolean
  createdAt: string
}

/** 注册推送订阅（小程序模板消息/订阅消息） */
export async function registerPushSubscription(
  templateId: string,
  accepted: boolean
): Promise<void> {
  return request({
    url: '/push/register',
    method: 'POST',
    data: { templateId, accepted },
  })
}

/** WeChat 小程序：请求用户订阅消息并提交 */
export async function requestAndRegister(
  tmplIds: string[]
): Promise<string[]> {
  // #ifdef MP-WEIXIN
  try {
    const res = await uni.requestSubscribeMessage({
      tmplIds,
    } as any) as any
    const subscribed: string[] = []

    for (const id of tmplIds) {
      const result = res[id as any] as string
      const accepted = result === 'accept'
      // 无论 accept/reject 都上报，后端记录用户选择
      await registerPushSubscription(id, accepted)
      if (accepted) subscribed.push(id)
    }

    return subscribed
  } catch (e: any) {
    console.warn('[Push] 订阅消息请求失败:', e.errMsg || e.message)
    // 降级：静默上报所有模板为 rejected
    for (const id of tmplIds) {
      await registerPushSubscription(id, false)
    }
    return []
  }
  // #endif

  // #ifndef MP-WEIXIN
  // H5 / App：模拟订阅成功
  for (const id of tmplIds) {
    await registerPushSubscription(id, true)
  }
  return tmplIds
  // #endif
}

/** 预定义的模板 ID（实际需从小程序后台获取） */
export const PUSH_TEMPLATES = {
  newMission: 'tpl_new_mission',       // 新救援任务提醒
  taskUpdate: 'tpl_task_update',       // 任务状态变更
  drillReminder: 'tpl_drill_reminder', // 演习提醒
  aedMaintenance: 'tpl_aed_maint',     // AED 维护提醒
} as const
