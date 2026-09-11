/**
 * AED 责任人联动 — 会话状态 store。
 *
 * 收敛两处状态，避免页面堆积逻辑：
 * 1) 急救者侧：当前求助 alertId / status / 截止时间 / 轮询句柄；
 * 2) 责任人侧：待处理求助（收件箱）。
 *
 * 文案纪律：全流程语义为「确认授权」，禁止「已远程开锁」。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  notifyCustodian, confirmAuthorization, fetchCustodianAlert, fetchPendingAlerts, revokeConsent,
} from '@/api/aed-custodian'
import type { CustodianAlert, NotifyResult, ActionResult } from '@/api/aed-custodian'
import type { FullResponse } from '@/api/index'

const POLL_INTERVAL_MS = 3000
const TERMINAL_STATUSES: Array<CustodianAlert['status']> = ['acknowledged', 'rejected', 'expired']

export const useCustodianAlertStore = defineStore('custodian-alert', () => {
  // —— 急救者会话态 ——
  const activeAedId = ref('')
  const activeAlertId = ref('')
  const status = ref<CustodianAlert['status'] | ''>('')
  const slaDeadlineMs = ref(0)
  const unlockCommandStatus = ref('')
  const unlockAction = ref('')
  const consentGranted = ref(false)
  const deliveryState = ref('')
  const custodianName = ref('')
  const custodianRole = ref('')
  const lastErrorCode = ref(0)
  const notifying = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  // —— 责任人收件箱态 ——
  const pending = ref<CustodianAlert[]>([])
  const inboxLoading = ref(false)

  function stopPolling(): void {
    if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null }
  }

  function resetSession(): void {
    stopPolling()
    activeAedId.value = ''
    activeAlertId.value = ''
    status.value = ''
    slaDeadlineMs.value = 0
    unlockCommandStatus.value = ''
    unlockAction.value = ''
    consentGranted.value = false
    deliveryState.value = ''
    custodianName.value = ''
    custodianRole.value = ''
    lastErrorCode.value = 0
  }

  function applyAlert(alert: CustodianAlert): void {
    status.value = alert.status
    slaDeadlineMs.value = alert.slaDeadlineMs
    unlockCommandStatus.value = alert.unlockCommandStatus
    unlockAction.value = alert.unlockAction
    consentGranted.value = alert.consentGranted
    deliveryState.value = alert.deliveryState
    custodianName.value = alert.custodianName
    custodianRole.value = alert.custodianRole
  }

  /** 通知责任人（调用方需先取得 PIPL 同意）。 */
  async function notify(aedId: string, consentVersion = 'v1'): Promise<FullResponse<NotifyResult>> {
    notifying.value = true
    const res = await notifyCustodian(aedId, { consentGranted: true, consentVersion })
    notifying.value = false
    lastErrorCode.value = res.code
    if (res.code === 0 && res.data) {
      activeAedId.value = aedId
      activeAlertId.value = res.data.alertId
      status.value = res.data.status as CustodianAlert['status']
      slaDeadlineMs.value = res.data.slaDeadlineMs
      unlockCommandStatus.value = res.data.commandStatus
      consentGranted.value = res.data.consentGranted
      deliveryState.value = res.data.deliveryState
      custodianName.value = res.data.custodian.name
      custodianRole.value = res.data.custodian.role
    }
    return res
  }

  /** 启动状态轮询（每 3s），终态或超时后自动停止。 */
  function startPolling(onUpdate?: (alert: CustodianAlert) => void): void {
    stopPolling()
    if (!activeAedId.value || !activeAlertId.value) return
    const tick = async () => {
      try {
        const alert = await fetchCustodianAlert(activeAedId.value, activeAlertId.value)
        applyAlert(alert)
        if (onUpdate) onUpdate(alert)
        if (TERMINAL_STATUSES.includes(alert.status)) stopPolling()
      } catch { /* 网络抖动：下一轮重试 */ }
    }
    pollTimer = setInterval(tick, POLL_INTERVAL_MS)
    void tick()
  }

  /** 责任人：确认授权 / 拒绝。 */
  async function respond(
    aedId: string,
    alertId: string,
    action: 'authorize' | 'deny'
  ): Promise<FullResponse<ActionResult>> {
    return confirmAuthorization(aedId, { alertId, action })
  }

  /** 急救者：撤回信息共享同意（PIPL）。 */
  async function revoke(aedId: string, alertId: string, reason?: string): Promise<boolean> {
    try {
      const r = await revokeConsent(aedId, alertId, reason)
      if (r && r.consentGranted === false) {
        consentGranted.value = false
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /** 责任人：加载待处理求助收件箱。 */
  async function loadInbox(): Promise<void> {
    inboxLoading.value = true
    try {
      const list = await fetchPendingAlerts()
      pending.value = Array.isArray(list) ? list : []
    } catch {
      pending.value = []
    }
    inboxLoading.value = false
  }

  return {
    activeAedId, activeAlertId, status, slaDeadlineMs, unlockCommandStatus, unlockAction,
    consentGranted, deliveryState, custodianName, custodianRole, lastErrorCode, notifying,
    pending, inboxLoading,
    resetSession, notify, startPolling, stopPolling, applyAlert, respond, revoke, loadInbox,
  }
})
