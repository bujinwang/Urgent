/**
 * 政府监管看板 —— CSV / PDF 导出（P2-8，纯前端）
 *
 * 设计约定（务必遵守）：
 * - 后端 `GET /api/gov/dashboard` 已返回**完整、按查看者范围裁剪、零 PII** 的聚合数据，
 *   前端 `useGovStore().dashboard` 已持有它 ⇒ 导出**全部在前端完成**，不新增任何后端路由。
 * - **零新增依赖**：CSV 手写（RFC 4180），PDF 走 H5 `window.print()`（另存为 PDF），
 *   不引入 papaparse / jspdf / file-saver 等库。
 * - 与看板渲染的「不变量」一致：**null 一律导出为空串，绝不做 0 兜底**
 *   （冷启动 / 覆盖率缺口时不显示 0，避免误导）。
 */

import type { GovDashboard } from '@/api/gov'

/** 未分区占位常量（与后端 district 归一化约定一致）。 */
const UNASSIGNED = '__UNASSIGNED__'

/** 区域名展示：`__UNASSIGNED__` → 「未分区」，其余原样。 */
function districtLabel(name: string): string {
  return name === UNASSIGNED ? '未分区' : name
}

/**
 * RFC 4180 单元格转义：字段含 `,` / `"` / CR / LF 时用 `"` 包裹并把内部 `"` 双写；
 * 否则原样返回。
 */
export function csvEscape(v: string): string {
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

/** 比率 → 百分数文本（默认 1 位小数）；`null` → 空串（绝不放 0）。 */
export function pctOrEmpty(v: number | null, digits = 1): string {
  return v === null ? '' : (v * 100).toFixed(digits)
}

/** 数值 → 文本；`null` → 空串。 */
export function numOrEmpty(v: number | null): string {
  return v === null ? '' : String(v)
}

/** 毫秒 → 秒文本（默认 1 位小数）；`null` → 空串。 */
export function secsOrEmpty(ms: number | null, digits = 1): string {
  return ms === null ? '' : (ms / 1000).toFixed(digits)
}

/** 单元格数组 → 一行 CSV（每一格都过 `csvEscape`）。 */
function toLine(cells: string[]): string {
  return cells.map(csvEscape).join(',')
}

/**
 * 看板数据 → CSV 文本。
 *
 * 格式：整串以 UTF-8 BOM(`\uFEFF`) 开头（否则 Excel 打开中文乱码），行尾统一 `\r\n`；
 * 共三段（元信息 / 总览指标 / 区域明细），段间空一行。
 */
export function dashboardToCsv(d: GovDashboard): string {
  const region = d.meta.district ? districtLabel(d.meta.district) : '全部区域'
  const generated = new Date(d.meta.generatedAt).toLocaleString()
  const gaps = (d.meta.dataGaps || []).join('; ')

  const lines: string[] = [
    // ---- 段 1：元信息 ----
    toLine(['项目', '值']),
    toLine(['统计窗口', `最近${d.meta.windowDays}天`]),
    toLine(['区域', region]),
    toLine(['生成时间', generated]),
    toLine(['数据缺口', gaps]),
    '', // 段间空行
    // ---- 段 2：总览指标（顺序固定）----
    toLine(['指标', '数值']),
    toLine(['响应 P95(秒)', secsOrEmpty(d.responseTime.p95Ms)]),
    toLine(['SLA 达标率(%)', pctOrEmpty(d.responseTime.slaRate)]),
    toLine(['责任人无响应率(%)', pctOrEmpty(d.responseTime.noResponseRate)]),
    toLine(['在线志愿者(人)', numOrEmpty(d.people.onlineVolunteers)]),
    toLine(['持证志愿者(人)', numOrEmpty(d.people.certifiedVolunteers)]),
    toLine(['AED 总数(台)', numOrEmpty(d.aed.total)]),
    toLine(['AED 可用(台)', numOrEmpty(d.aed.available)]),
    toLine(['AED 可用率(%)', pctOrEmpty(d.aed.availabilityRate)]),
    toLine(['AED 取用次数', numOrEmpty(d.aed.pickups)]),
    toLine(['AED 未归还', numOrEmpty(d.aed.activePickups)]),
    toLine(['任务总数', numOrEmpty(d.tasks.total)]),
    toLine(['任务已完成', numOrEmpty(d.tasks.completed)]),
    toLine(['任务完成率(%)', pctOrEmpty(d.tasks.completionRate)]),
    toLine(['救援记录', numOrEmpty(d.rescue.records)]),
    toLine(['救援案例', numOrEmpty(d.rescue.cases)]),
    toLine(['机构数', numOrEmpty(d.people.organizations)]),
    toLine(['机构成员', numOrEmpty(d.people.orgMembers)]),
    '', // 段间空行
    // ---- 段 3：区域明细（仅区级聚合）----
    // 末列「取用次数」在 GovDistrictRow 中不存在 ⇒ 按约定去掉。
    toLine(['区域', 'AED数', '可用率(%)', '每万人覆盖率', 'P95(秒)', 'SLA达标率(%)', '告警数', '任务数', '完成率(%)']),
  ]

  for (const r of d.districts) {
    lines.push(
      toLine([
        districtLabel(r.district),
        numOrEmpty(r.aedCount),
        pctOrEmpty(r.aedAvailableRate),
        numOrEmpty(r.coveragePer10k),
        secsOrEmpty(r.responseP95Ms),
        pctOrEmpty(r.slaRate),
        numOrEmpty(r.alertTotal),
        numOrEmpty(r.taskCount),
        pctOrEmpty(r.taskCompletionRate),
      ])
    )
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

/**
 * 导出文件名：`gov-dashboard-YYYYMMDD.csv`（纯 ASCII，避免跨端文件名问题）。
 * `now` 便于单测固定日期；`_d` 仅为调用方语义完整保留。
 */
export function govCsvFilename(_d: GovDashboard, now: number = Date.now()): string {
  const dt = new Date(now)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `gov-dashboard-${y}${m}${day}.csv`
}

/**
 * 触发文本下载（副作用）。
 * - H5：`Blob` + `URL.createObjectURL` + 动态 `<a download>` 点击后 `revokeObjectURL`。
 * - 非 H5（小程序/App）：退化为 toast 提示（宿主无文件下载能力）。
 */
export function downloadText(filename: string, text: string, mime: string): void {
  // #ifdef H5
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在浏览器中导出', icon: 'none' })
  // #endif
}

/**
 * 打印当前看板（副作用）：H5 调 `window.print()`（用户可在打印对话框「另存为 PDF」）；
 * 非 H5 退化为 toast。打印样式由 dashboard.vue 的 `@media print` 提供（强制浅色、隐藏工具栏）。
 */
export function printGovDashboard(): void {
  // #ifdef H5
  window.print()
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请在浏览器中导出', icon: 'none' })
  // #endif
}
