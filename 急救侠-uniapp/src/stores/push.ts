/**
 * 推送订阅 Store
 *
 * 管理用户对微信订阅消息的订阅状态。
 * 订阅数据在后端持久化，store 只负责前端交互逻辑。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  registerPushSubscription,
  requestAndRegister,
  PUSH_TEMPLATES,
} from '@/api/push'

export interface PushTemplateOption {
  key: string
  label: string
  description: string
  templateId: string
  subscribed: boolean
}

export const usePushStore = defineStore('push', () => {
  const subscribedTemplates = ref<Set<string>>(new Set())

  const isSubscribed = computed(() => subscribedTemplates.value.size > 0)

  /** 所有可订阅的模板 */
  const templateOptions = ref<PushTemplateOption[]>([
    {
      key: 'newMission',
      label: '新救援任务',
      description: '附近有新的急救任务时通知您',
      templateId: PUSH_TEMPLATES.newMission,
      subscribed: false,
    },
    {
      key: 'taskUpdate',
      label: '任务状态变更',
      description: '您参与的任务进度更新时通知',
      templateId: PUSH_TEMPLATES.taskUpdate,
      subscribed: false,
    },
    {
      key: 'drillReminder',
      label: '演习提醒',
      description: '即将开始的急救演习提醒',
      templateId: PUSH_TEMPLATES.drillReminder,
      subscribed: false,
    },
    {
      key: 'aedMaintenance',
      label: 'AED 维护提醒',
      description: '您管理的 AED 设备维护到期提醒',
      templateId: PUSH_TEMPLATES.aedMaintenance,
      subscribed: false,
    },
  ])

  /**
   * 订阅所有推送模板
   * 调用微信订阅消息弹窗，让用户逐条授权
   */
  async function subscribeAll() {
    const tmplIds = templateOptions.value.map((t) => t.templateId)
    const subscribed = await requestAndRegister(tmplIds)

    subscribedTemplates.value = new Set(subscribed)

    // 更新本地状态
    for (const opt of templateOptions.value) {
      opt.subscribed = subscribed.includes(opt.templateId)
    }

    return subscribed
  }

  /**
   * 订阅单个模板
   */
  async function subscribeOne(templateId: string) {
    const accepted = true
    await registerPushSubscription(templateId, accepted)

    subscribedTemplates.value.add(templateId)
    const opt = templateOptions.value.find((t) => t.templateId === templateId)
    if (opt) opt.subscribed = true
  }

  /**
   * 取消订阅单个模板
   */
  async function unsubscribeOne(templateId: string) {
    const accepted = false
    await registerPushSubscription(templateId, accepted)

    subscribedTemplates.value.delete(templateId)
    const opt = templateOptions.value.find((t) => t.templateId === templateId)
    if (opt) opt.subscribed = false
  }

  return {
    subscribedTemplates,
    isSubscribed,
    templateOptions,
    subscribeAll,
    subscribeOne,
    unsubscribeOne,
  }
})
