/**
 * T03 · 志愿服务时长 CSV 导出测试（设计 §6 T03 / §8 T13·T14 / §7 禁止措辞守卫）。
 */
import { describe, it, expect } from 'vitest'
import {
  serviceHoursToCsv,
  serviceHoursCsvFilename,
  activityLabel,
  SERVICE_HOURS_TITLE,
  SERVICE_HOURS_DISCLAIMER,
} from '@/utils/serviceExport'
import type { ServiceHoursExportInput } from '@/utils/serviceExport'

/** 本地时间 2026-09-17 10:30:00（文件名/时间列都用**本地**补零，测试与本实现口径一致）。 */
const FIXED = new Date(2026, 8, 17, 10, 30, 0).getTime()

/** §7 禁止措辞（任何导出物 / 文案都不得出现）。 */
const FORBIDDEN = ['符合国家标准', '国家标准', '国标', '官方', '政府认可']

function input(over: Partial<ServiceHoursExportInput> = {}): ServiceHoursExportInput {
  return {
    name: '陆远',
    totalMinutes: 75,
    breakdown: [{ activityType: 'rescue_task', minutes: 75, count: 2 }],
    items: [
      {
        id: 'vsl_1', activityType: 'rescue_task', sourceType: 'system', sourceRef: 'task_001',
        startedAtMs: FIXED, endedAtMs: FIXED + 30 * 60000, durationMin: 30, isDrill: false, orgId: '',
      },
    ],
    generatedAt: FIXED,
    ...over,
  }
}

describe('serviceExport · CSV 导出', () => {
  it('文件名 = service-hours-YYYYMMDD.csv', () => {
    expect(serviceHoursCsvFilename(FIXED)).toBe('service-hours-20260917.csv')
    expect(serviceHoursCsvFilename(FIXED)).toMatch(/^service-hours-\d{8}\.csv$/)
  })

  it('★ T13：首字符是 BOM(\\uFEFF)、行尾统一 \\r\\n（无裸 \\n）', () => {
    const csv = serviceHoursToCsv(input())
    expect(csv[0]).toBe('\uFEFF')
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.slice(1).split('\r\n').length).toBeGreaterThan(1)
    expect(/[^\r]\n/.test(csv)).toBe(false) // 所有 \n 都必须紧跟 \r
  })

  it('含固定标题与声明（D8 / Q2 措辞）', () => {
    const csv = serviceHoursToCsv(input())
    expect(csv).toContain(SERVICE_HOURS_TITLE)
    expect(csv).toContain(SERVICE_HOURS_DISCLAIMER)
  })

  it('★ T14：姓名 `=1+1` ⇒ 前置单引号；纯数值 `-1.5` **不被**清洗', () => {
    const csv = serviceHoursToCsv(input({ name: '=1+1', totalMinutes: -1.5 }))
    expect(csv).toContain("'=1+1")
    expect(csv).toContain('累计服务时长（分钟）,-1.5')
  })

  it('公式注入前缀落在引号**内**（sanitize 先于 escape）', () => {
    const csv = serviceHoursToCsv(input({ name: '=a,b' }))
    // sanitize → `'=a,b`；escape（含逗号）→ `"'=a,b"`
    expect(csv).toContain(`"'=a,b"`)
  })

  it('★ 禁止措辞守卫：导出物不含 §7 禁用词', () => {
    const csv = serviceHoursToCsv(input())
    for (const w of FORBIDDEN) expect(csv).not.toContain(w)
  })

  it('分项/明细**数据驱动**：多分项都渲染；未收录 activity_type 回落原始值（不丢行）', () => {
    const csv = serviceHoursToCsv(input({
      breakdown: [
        { activityType: 'rescue_task', minutes: 30, count: 1 },
        { activityType: 'manual', minutes: 10, count: 1 },
        { activityType: 'brand_new_type', minutes: 5, count: 1 },
      ],
    }))
    expect(csv).toContain('救援任务')
    expect(csv).toContain('人工登记')
    expect(csv).toContain('brand_new_type')
    expect(activityLabel('nope')).toBe('nope')
  })
})
