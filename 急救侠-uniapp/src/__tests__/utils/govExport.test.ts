import { describe, it, expect, vi } from 'vitest'
import {
  csvEscape,
  pctOrEmpty,
  numOrEmpty,
  secsOrEmpty,
  dashboardToCsv,
  govCsvFilename,
  downloadText,
  printGovDashboard,
} from '@/utils/govExport'
import type { GovDashboard, GovDistrictRow } from '@/api/gov'

/** 构造看板夹具；默认含 null 指标 + 一行区域明细。 */
function makeDashboard(overrides: Partial<GovDashboard> = {}): GovDashboard {
  const base: GovDashboard = {
    meta: {
      from: 0, to: 0, windowDays: 30, district: null,
      generatedAt: 0, dataGaps: ['人口基线缺失', '面积基线缺失'],
    },
    responseTime: {
      hasData: false, sampleSize: 0, p95Ms: null, slaRate: null, noResponseRate: null,
      alertTotal: 0, trend: [], channelDistribution: [],
    },
    aed: {
      total: 10, available: 8, availabilityRate: 0.8, pickups: 3, activePickups: 1,
      coverage: { per10k: null, perKm2: null, dataGap: true },
    },
    tasks: { total: 5, completed: 3, completionRate: 0.6, typeDistribution: [], hourlyDistribution: [] },
    rescue: { records: 2, cases: 1 },
    people: { certifiedVolunteers: 20, onlineVolunteers: 7, organizations: 2, orgMembers: 15 },
    districts: [
      {
        district: '天河区', aedCount: 4, aedAvailableRate: 0.75, responseP95Ms: 300000,
        slaRate: 0.9, alertTotal: 5, taskCount: 2, taskCompletionRate: 0.5, coveragePer10k: null,
      },
    ],
  }
  return { ...base, ...overrides }
}

function row(partial: Partial<GovDistrictRow>): GovDistrictRow {
  return {
    district: 'X', aedCount: 0, aedAvailableRate: null, responseP95Ms: null,
    slaRate: null, alertTotal: 0, taskCount: 0, taskCompletionRate: null, coveragePer10k: null,
    ...partial,
  }
}

describe('govExport — 纯函数', () => {
  describe('csvEscape（RFC 4180）', () => {
    it('普通值原样返回', () => {
      expect(csvEscape('天河区')).toBe('天河区')
      expect(csvEscape('')).toBe('')
      expect(csvEscape('abc123')).toBe('abc123')
    })

    it('含逗号 ⇒ 双引号包裹', () => {
      expect(csvEscape('天河,区')).toBe('"天河,区"')
    })

    it('含双引号 ⇒ 包裹并把内部双引号双写', () => {
      expect(csvEscape('他说"你好"')).toBe('"他说""你好"""')
    })

    it('含 CR / LF ⇒ 双引号包裹', () => {
      expect(csvEscape('a\r\nb')).toBe('"a\r\nb"')
      expect(csvEscape('a\nb')).toBe('"a\nb"')
    })
  })

  describe('null → 空串（绝不放 0）', () => {
    it('pctOrEmpty / numOrEmpty / secsOrEmpty 对 null 返空串', () => {
      expect(pctOrEmpty(null)).toBe('')
      expect(numOrEmpty(null)).toBe('')
      expect(secsOrEmpty(null)).toBe('')
    })

    it('非 null 正常输出（0 是真实值 ⇒ "0"/"0.0"，不是空串）', () => {
      expect(pctOrEmpty(0.857)).toBe('85.7') // 1 位小数
      expect(pctOrEmpty(0.8)).toBe('80.0')
      expect(pctOrEmpty(0)).toBe('0.0')
      expect(numOrEmpty(0)).toBe('0')
      expect(numOrEmpty(12)).toBe('12')
      expect(secsOrEmpty(300000)).toBe('300.0') // ms → 秒，1 位小数
      expect(secsOrEmpty(1500)).toBe('1.5')
    })
  })

  describe('dashboardToCsv', () => {
    it('以 UTF-8 BOM 开头、行尾全为 CRLF、以 CRLF 结束', () => {
      const csv = dashboardToCsv(makeDashboard())
      expect(csv.startsWith('\uFEFF')).toBe(true)
      expect(csv.charCodeAt(0)).toBe(0xfeff)
      expect(csv).toContain('\r\n')
      expect(csv.endsWith('\r\n')).toBe(true)
      // 不存在「孤立 LF」（即所有换行都是 CRLF）
      expect(csv.replace(/\r\n/g, '')).not.toContain('\n')
    })

    it('三段结构完整（元信息 / 总览指标 / 区域明细），段间空行', () => {
      const csv = dashboardToCsv(makeDashboard())
      expect(csv).toContain('项目,值')
      expect(csv).toContain('统计窗口,最近30天')
      expect(csv).toContain('区域,全部区域')
      expect(csv).toContain('生成时间,')
      expect(csv).toContain('数据缺口,人口基线缺失; 面积基线缺失')
      expect(csv).toContain('指标,数值')
      expect(csv).toContain('区域,AED数,可用率(%),每万人覆盖率,P95(秒),SLA达标率(%),告警数,任务数,完成率(%)')
    })

    it('null 指标导出为空单元格（不含 0），实数正常导出', () => {
      const csv = dashboardToCsv(makeDashboard())
      // p95Ms / slaRate / noResponseRate 均为 null ⇒ 值为空
      expect(csv).toContain('响应 P95(秒),\r\n')
      expect(csv).toContain('SLA 达标率(%),\r\n')
      expect(csv).toContain('责任人无响应率(%),\r\n')
      expect(csv).not.toContain('响应 P95(秒),0')
      expect(csv).not.toContain('SLA 达标率(%),0')
      // 实数正常
      expect(csv).toContain('AED 总数(台),10')
      expect(csv).toContain('AED 可用率(%),80.0')
      expect(csv).toContain('任务完成率(%),60.0')
      expect(csv).toContain('在线志愿者(人),7')
    })

    it('区域明细逐行输出（含转义、null 空串）', () => {
      const csv = dashboardToCsv(makeDashboard())
      // 天河区：AED 4 / 可用率 75.0 / coverage null→空 / P95 300.0s / SLA 90.0 / 告警 5 / 任务 2 / 完成率 50.0
      expect(csv).toContain('天河区,4,75.0,,300.0,90.0,5,2,50.0')
    })

    it('__UNASSIGNED__ ⇒ 未分区（且原文不出现）', () => {
      const csv = dashboardToCsv(makeDashboard({ districts: [row({ district: '__UNASSIGNED__', aedCount: 1 })] }))
      expect(csv).toContain('未分区,1,,,,,0,0,')
      expect(csv).not.toContain('__UNASSIGNED__')
    })

    it('含逗号的区域名被真正转义', () => {
      const csv = dashboardToCsv(makeDashboard({ districts: [row({ district: 'A,B' })] }))
      expect(csv).toContain('"A,B"')
    })

    it('区域维度本身为「未分区」时，元信息区域同步显示未分区', () => {
      const csv = dashboardToCsv(makeDashboard({ meta: { ...makeDashboard().meta, district: '__UNASSIGNED__' } }))
      expect(csv).toContain('区域,未分区')
    })

    it('空 districts 不崩且三段结构仍在', () => {
      const csv = dashboardToCsv(makeDashboard({ districts: [] }))
      expect(csv).toContain('项目,值')
      expect(csv).toContain('指标,数值')
      expect(csv).toContain('区域,AED数,可用率(%)')
      expect(csv.startsWith('\uFEFF')).toBe(true)
    })
  })

  describe('govCsvFilename', () => {
    it('由固定 now 生成 ASCII 文件名 YYYYMMDD', () => {
      const now = new Date(2026, 8, 11, 12, 0, 0).getTime() // 2026-09-11 本地 12:00
      expect(govCsvFilename(makeDashboard(), now)).toBe('gov-dashboard-20260911.csv')
    })

    it('月份/日期补零', () => {
      const now = new Date(2026, 0, 5, 9, 0, 0).getTime() // 2026-01-05
      expect(govCsvFilename(makeDashboard(), now)).toBe('gov-dashboard-20260105.csv')
    })
  })
})

describe('govExport — 副作用函数（平台守卫）', () => {
  it('printGovDashboard 调 window.print', () => {
    const spy = vi.fn()
    const orig = (window as unknown as { print?: () => void }).print
    ;(window as unknown as { print: () => void }).print = spy
    printGovDashboard()
    expect(spy).toHaveBeenCalledTimes(1)
    ;(window as unknown as { print?: () => void }).print = orig
  })

  it('downloadText：创建 <a download> 并释放 objectURL', () => {
    const click = vi.fn()
    const fakeA = { href: '', download: '', click } as unknown as HTMLAnchorElement
    const createEl = vi.spyOn(document, 'createElement').mockReturnValue(fakeA)
    const append = vi.spyOn(document.body, 'appendChild').mockImplementation((n: Node) => n)
    const remove = vi.spyOn(document.body, 'removeChild').mockImplementation((n: Node) => n)
    const createUrl = vi.fn(() => 'blob:fake')
    const revokeUrl = vi.fn()
    const urlObj = URL as unknown as { createObjectURL: (b: Blob) => string; revokeObjectURL: (u: string) => void }
    const origCreate = urlObj.createObjectURL
    const origRevoke = urlObj.revokeObjectURL
    urlObj.createObjectURL = createUrl
    urlObj.revokeObjectURL = revokeUrl

    downloadText('a.csv', 'x', 'text/csv;charset=utf-8')

    expect(createUrl).toHaveBeenCalledTimes(1)
    expect(fakeA.download).toBe('a.csv')
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeUrl).toHaveBeenCalledWith('blob:fake')

    createEl.mockRestore(); append.mockRestore(); remove.mockRestore()
    urlObj.createObjectURL = origCreate
    urlObj.revokeObjectURL = origRevoke
  })
})
