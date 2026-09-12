/**
 * 责任人号码解析（**现取现用，不落快照**）。
 *
 * 供 `routes/aed.ts`（通知责任人）与 `services/smsReportService.ts`（状态报告触发语音）共用，
 * 保证两处**同一口径**：`users.phone` 优先，为空则回落设备级 `aed_devices.custodian_phone`。
 *
 * 回调 payload 里携带的号码**一律不采信**，只从本库按 `custodian_user_id` 重新解析（防伪造回调）。
 */

import { get } from '../db'

/** 解析责任人号码；两处都为空则返回 `''`。 */
export function resolveCustodianPhone(
  userId: string,
  device: { custodian_phone: string }
): string {
  const u = get<{ phone: string }>('SELECT phone FROM users WHERE id = ?', userId)
  const p = (u?.phone || '').trim()
  if (p) return p
  return (device.custodian_phone || '').trim()
}
