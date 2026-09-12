/**
 * AED 责任人联动 API — 通知责任人 / 确认授权（unlock）/ 状态回读 / 收件箱 / 撤回同意。
 *
 * 语义：责任人「**确认授权**」，不做物理开锁；UI 文案统一「确认授权」。
 * 时间戳均为 UTC epoch 毫秒，展示层自行转本地时区。
 */

import { request, requestFull } from './index'
import type { FullResponse } from './index'

/** 与后端 `AlertCode` 对齐的业务错误码（与 HTTP 200 一并返回）。 */
export const AlertCode = {
  NO_CUSTODIAN: 4001,       // 设备无责任人（不阻断急救）
  ALERT_NOT_FOUND: 4002,
  NOT_CUSTODIAN: 4003,      // 调用者非该设备责任人
  ALREADY_RESPONDED: 4004,  // 已被他人确认 / 动作不同
  ALERT_EXPIRED: 4005,
  CONSENT_REQUIRED: 4006,   // 未同意 PIPL
  DEVICE_NOT_FOUND: 4007,
  PICKUP_NOT_FOUND: 4008,
  RATE_LIMITED: 4009,       // 反滥用：冷却中 / 频次超限
} as const

export interface CustodianAlert {
  id: string
  aedId: string
  pickupId: string
  status: 'pending' | 'sent' | 'acknowledged' | 'rejected' | 'expired' | 'unreachable'
  channel: string
  requesterUserId: string
  requesterUserName: string
  custodianUserId: string
  custodianName: string
  custodianRole: string
  notifyTimeMs: number
  firstSentTimeMs: number | null
  respondedTimeMs: number | null
  slaDeadlineMs: number
  responseLatencyMs: number | null
  slaMet: boolean | null
  unlockAction: 'none' | 'authorize' | 'deny'
  unlockCommandStatus: 'not_issued' | 'issued' | 'acked'
  deliveryState: string
  consentGranted: boolean
  createdAt: number
  updatedAt: number
}

export interface NotifyResult {
  alertId: string
  status: string
  channel: string
  custodian: { name: string; role: string }
  notifyTimeMs: number
  slaDeadlineMs: number
  commandStatus: string
  consentGranted: boolean
  deliveryState: string
}

export interface ActionResult {
  alertId: string
  status: string
  unlockAction: string
  commandStatus: string
  unlockToken?: string
  respondedTimeMs: number
  responseLatencyMs: number
  slaMet: boolean
  idempotent?: boolean
}

export interface NotifyBody {
  pickupId?: string
  missionId?: string
  notes?: string
  consentGranted: boolean
  consentVersion?: string
}

export interface ActionBody {
  alertId: string
  action: 'authorize' | 'deny'
  notes?: string
}

/** 通知责任人（需 `consentGranted:true`）。返回完整响应体以便按 `AlertCode` 分支。 */
export function notifyCustodian(aedId: string, body: NotifyBody): Promise<FullResponse<NotifyResult>> {
  return requestFull<NotifyResult>({
    url: `/aed/${aedId}/notify-custodian`,
    method: 'POST',
    data: { ...body },
  })
}

/** 责任人「确认授权」或「拒绝」（confirm 映射为 action='authorize'）。 */
export function confirmAuthorization(aedId: string, body: ActionBody): Promise<FullResponse<ActionResult>> {
  return requestFull<ActionResult>({
    url: `/aed/${aedId}/unlock`,
    method: 'POST',
    data: { ...body },
  })
}

/** 状态回读（急救者端轮询用）。 */
export function fetchCustodianAlert(aedId: string, alertId: string): Promise<CustodianAlert> {
  return request<CustodianAlert>({ url: `/aed/${aedId}/custodian-alerts/${alertId}` })
}

/** 责任人待处理求助收件箱。 */
export function fetchPendingAlerts(): Promise<CustodianAlert[]> {
  return request<CustodianAlert[]>({ url: '/aed/custodian-alerts/pending' })
}

/** 撤回信息共享同意（PIPL）。 */
export function revokeConsent(
  aedId: string,
  alertId: string,
  reason?: string
): Promise<{ alertId: string; consentGranted: boolean; revokedAtMs: number }> {
  return request({
    url: `/aed/${aedId}/custodian-alerts/${alertId}/revoke-consent`,
    method: 'POST',
    data: { reason },
  })
}
