/**
 * 志愿服务时长 —— CSV 导出（F4 T03 / P0-5 数据契约）。
 *
 * 设计约定（照 `utils/govExport.ts` 的既有取向，**务必遵守**）：
 * - **零新增依赖**：CSV 手写（RFC 4180）。
 * - ★ **复用** `sanitizeCell` / `csvEscape`（`@/utils/govExport`），**不复制** —— 复用其
 *   **顺序**：先 `sanitizeCell`（防公式注入）**再** `csvEscape`（RFC 4180 转义），
 *   保证 `'` 前缀落在引号**内**。
 * - 整串以 UTF-8 **BOM(`\uFEFF`)** 开头（否则 Excel 打开中文乱码），行尾统一 `\r\n`。
 * - `null` 一律空串、**绝不 0 兜底**（与看板导出同一取向）。
 *
 * ⚠️ **措辞（用户已拍板）**：标题固定「**志愿服务记录证明（急救侠平台出具）**」；
 * 声明固定「**本证明由平台出具，非实名认证**」——**不得**出现「符合国家标准 / 国标 / 官方」等措辞（§7）。
 * 姓名来源是用户的**自填昵称**（非实名），可能含公式注入字符 ⇒ 必经 `sanitizeCell`。
 */

import { sanitizeCell, csvEscape } from '@/utils/govExport'
import type { ServiceHoursBreakdownItem, ServiceHoursItem } from '@/api/serviceHours'

/** 导出物标题（D8 统一措辞）。 */
export const SERVICE_HOURS_TITLE = '志愿服务记录证明（急救侠平台出具）'

/** 导出物声明（Q2：平台出具、非实名认证）。 */
export const SERVICE_HOURS_DISCLAIMER = '本证明由平台出具，非实名认证'

export interface ServiceHoursExportInput {
  /** 志愿者姓名（自填昵称；可能含 `=`/`+`/`-`/`@` 等注入字符）。 */
  name: string
  totalMinutes: number
  breakdown: ServiceHoursBreakdownItem[]
  items: ServiceHoursItem[]
  /** 生成时刻（供测试固定）；默认 `Date.now()`。 */
  generatedAt?: number
}

/** 两位补零。 */
function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** `YYYY-MM-DD HH:mm:ss`（**本地时间**、手写补零、不依赖 locale，照 `govExport.ts`）。 */
export function formatDateTimeMs(ms: number): string {
  const dt = new Date(ms)
  return (
    `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())} ` +
    `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`
  )
}

/** `activity_type` → 中文展示名；**未收录类型回落原始值**（数据驱动，不写死分项数）。 */
const ACTIVITY_LABELS: Record<string, string> = {
  rescue_task: '救援任务',
  drill: '演练',
  training: '培训',
  aed_checkin: 'AED 巡检',
  manual: '人工登记',
}
export function activityLabel(activityType: string): string {
  return ACTIVITY_LABELS[activityType] || activityType
}

/** 单元格数组 → 一行 CSV（每格先 `sanitizeCell` 防注入，再 `csvEscape`）。 */
function toLine(cells: string[]): string {
  return cells.map((c) => csvEscape(sanitizeCell(c))).join(',')
}

/**
 * 「我的服务时长」数据 → CSV 文本。
 *
 * 结构：标题行 → 元信息（姓名/生成时间/累计分钟）→ 分项表 → 明细表 → 声明行。
 */
export function serviceHoursToCsv(input: ServiceHoursExportInput): string {
  const generated = formatDateTimeMs(input.generatedAt ?? Date.now())

  const lines: string[] = [
    toLine([SERVICE_HOURS_TITLE]),
    toLine(['姓名', input.name]),
    toLine(['生成时间', generated]),
    toLine(['累计服务时长（分钟）', String(input.totalMinutes)]),
    '', // 段间空行
    toLine(['分项', '时长（分钟）', '次数']),
  ]

  for (const b of input.breakdown) {
    lines.push(toLine([activityLabel(b.activityType), String(b.minutes), String(b.count)]))
  }

  lines.push('') // 段间空行
  lines.push(toLine(['服务日期', '类型', '时长（分钟）']))
  for (const it of input.items) {
    lines.push(toLine([formatDateTimeMs(it.startedAtMs), activityLabel(it.activityType), String(it.durationMin)]))
  }

  lines.push('') // 段间空行
  lines.push(toLine([SERVICE_HOURS_DISCLAIMER]))

  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

/** 导出文件名：`service-hours-YYYYMMDD.csv`（纯 ASCII，避免跨端文件名问题）。`now` 供测试固定日期。 */
export function serviceHoursCsvFilename(now: number = Date.now()): string {
  const dt = new Date(now)
  const y = dt.getFullYear()
  const m = pad2(dt.getMonth() + 1)
  const day = pad2(dt.getDate())
  return `service-hours-${y}${m}${day}.csv`
}
