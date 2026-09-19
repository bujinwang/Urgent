/**
 * AED 状态 → 文案 / 语义色 的**唯一权威映射**（PRD D5）。
 *
 * ⚠️ 旧 `pages/aed/index.vue` 的 `statusLabel` 只特判 `available`，其余（含 `in_use`）一律显示"维护中"
 * ⇒ `in_use` **渲染不出**（PRD §1.2 已记的 bug）。本模块抽出唯一映射，detail 页与地图共用，
 * 显式覆盖三值，杜绝该缺口。
 *
 * 文案走 i18n（`aed.status.*`），运行时取值 ⇒ 随语言切换；fallback 为 zh-CN，绝不显示裸 key。
 */

import { i18n } from '@/i18n'
import type { AedDevice } from '@/api/aed'

export type AedStatus = AedDevice['status'] // 'available' | 'in_use' | 'maintenance'

/** 状态 → i18n key（三值封闭集，缺省回落 maintenance 文案）。 */
const STATUS_KEYS: Record<AedStatus, string> = {
  available: 'aed.status.available',
  in_use: 'aed.status.inUse',
  maintenance: 'aed.status.maintenance',
}

/** 状态 → 语义色（地图 pin / 徽章配色），与 label 同源。 */
export type AedTone = 'green' | 'amber' | 'red'

export function aedStatusLabel(status: AedStatus): string {
  const key = STATUS_KEYS[status] ?? 'aed.status.maintenance'
  // 运行时取译，确保随当前语言；vue-i18n 缺 key 时回落 fallbackLocale(zh-CN)。
  return i18n.global.t(key)
}

export function aedStatusTone(status: AedStatus): AedTone {
  if (status === 'available') return 'green'
  if (status === 'in_use') return 'amber'
  return 'red' // maintenance
}
