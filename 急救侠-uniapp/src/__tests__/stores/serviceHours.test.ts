/**
 * T03 · `useServiceHoursStore` 契约测试 —— 重点：**失败显式记 `error` 并抛出（不静默兜底）**。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useServiceHoursStore } from '@/stores/serviceHours'

vi.mock('@/api/serviceHours', () => ({
  getMyHours: vi.fn(),
  createCertificate: vi.fn(),
  listMyCertificates: vi.fn(),
  verifyCertificate: vi.fn(),
  revokeCertificate: vi.fn(),
}))

import { getMyHours, createCertificate, listMyCertificates, verifyCertificate } from '@/api/serviceHours'
import type { ServiceHoursView } from '@/api/serviceHours'

const view: ServiceHoursView = {
  totalMinutes: 75,
  breakdown: [{ activityType: 'rescue_task', minutes: 75, count: 2 }],
  items: [],
  page: 1,
  pageSize: 20,
  total: 2,
}

describe('serviceHours store', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('loadHours 成功 ⇒ 写入 totalMinutes / breakdown / total / page', async () => {
    vi.mocked(getMyHours).mockResolvedValueOnce(view)
    const s = useServiceHoursStore()
    await s.loadHours()
    expect(s.totalMinutes).toBe(75)
    expect(s.breakdown).toHaveLength(1)
    expect(s.total).toBe(2)
    expect(s.page).toBe(1)
    expect(s.error).toBe('')
  })

  it('★ loadHours 失败 ⇒ 显式记 error 并抛出（不静默兜底）', async () => {
    vi.mocked(getMyHours).mockRejectedValueOnce(new Error('boom'))
    const s = useServiceHoursStore()
    await expect(s.loadHours()).rejects.toThrow('boom')
    expect(s.error).toBe('boom')
    expect(s.loading).toBe(false)
  })

  it('★ loadCertificates 失败 ⇒ error 记录 + 抛出', async () => {
    vi.mocked(listMyCertificates).mockRejectedValueOnce(new Error('net'))
    const s = useServiceHoursStore()
    await expect(s.loadCertificates()).rejects.toThrow('net')
    expect(s.error).toBe('net')
  })

  it('createCertificate 成功 ⇒ 调 api 且刷新列表', async () => {
    vi.mocked(createCertificate).mockResolvedValueOnce({
      certNo: 'VS-1', periodFromMs: 0, periodToMs: 1, totalMinutes: 75, breakdown: [], issuedAtMs: 1, status: 'active',
    })
    vi.mocked(listMyCertificates).mockResolvedValueOnce([
      { certNo: 'VS-1', periodFromMs: 0, periodToMs: 1, totalMinutes: 75, status: 'active', issuedAtMs: 1 },
    ])
    const s = useServiceHoursStore()
    const cert = await s.createCertificate(0, 1)
    expect(cert.certNo).toBe('VS-1')
    expect(s.certificates).toHaveLength(1)
  })

  it('★ verify 失败 ⇒ error 记录 + 抛出', async () => {
    vi.mocked(verifyCertificate).mockRejectedValueOnce(new Error('404'))
    const s = useServiceHoursStore()
    await expect(s.verify('VS-X')).rejects.toThrow('404')
    expect(s.error).toBe('404')
  })
})
