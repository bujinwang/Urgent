import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { requestFull } from '@/api/index'
import { useGovStore } from '@/stores/gov'
import type { GovViewer, GovDashboard } from '@/api/gov'

// tsconfig 的 types 仅含 @dcloudio/types，process 非全局类型；此处仅为测试内监听使用。
declare const process: {
  on(event: 'unhandledRejection', listener: (reason: unknown, promise: unknown) => void): void
  off(event: 'unhandledRejection', listener: (reason: unknown, promise: unknown) => void): void
}

const viewer: GovViewer = {
  id: 'g1', name: '张监管', orgName: '天河卫健委', scopeAll: false, districts: ['天河区'],
}
const viewerAll: GovViewer = {
  id: 'g2', name: '市监管', orgName: '市卫健委', scopeAll: true, districts: [],
}

function makeDashboard(): GovDashboard {
  return {
    meta: { from: 0, to: 0, windowDays: 30, district: null, generatedAt: 1700000000000, dataGaps: [] },
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
      {
        district: '__UNASSIGNED__', aedCount: 1, aedAvailableRate: null, responseP95Ms: null,
        slaRate: null, alertTotal: 0, taskCount: 0, taskCompletionRate: null, coveragePer10k: null,
      },
    ],
  }
}

describe('Gov Store（政府看板状态层）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(requestFull).mockReset()
    vi.mocked(requestFull).mockResolvedValue({ code: 0, message: 'ok' })
  })

  // ---- districtOptions 区域选择器 ----
  it('districtOptions：未加载身份时为空数组', () => {
    const store = useGovStore()
    expect(store.districtOptions).toEqual([])
  })

  it('districtOptions：全域可见但看板未加载 ⇒ 仅「全部区域」占位', () => {
    const store = useGovStore()
    store.viewer = viewerAll
    expect(store.districtOptions).toEqual([''])
  })

  it('districtOptions：全域可见时取看板 districts', () => {
    const store = useGovStore()
    store.viewer = viewerAll
    store.dashboard = makeDashboard()
    expect(store.districtOptions).toEqual(['', '天河区', '__UNASSIGNED__'])
  })

  it('districtOptions：定向账号用自身可见区域', () => {
    const store = useGovStore()
    store.viewer = viewer
    expect(store.districtOptions).toEqual(['', '天河区'])
  })

  // ---- login ----
  it('login 落盘 gov_token（不写 jwt_token）并设置 viewer', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: { token: 'gov-tok', viewer }, message: 'ok' })
    const store = useGovStore()
    await store.login('govuser', 'pw')
    expect(uni.setStorageSync).toHaveBeenCalledWith('gov_token', 'gov-tok')
    expect(uni.setStorageSync).not.toHaveBeenCalledWith('jwt_token', expect.anything())
    expect(store.viewer).toEqual(viewer)
  })

  // ---- loadMe ----
  it('loadMe：成功设置 viewer', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: viewer, message: 'ok' })
    const store = useGovStore()
    await store.loadMe()
    expect(store.viewer).toEqual(viewer)
  })

  it('loadMe：失败吞掉异常并置 viewer=null（不抛）', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: '未授权' })
    const store = useGovStore()
    await expect(store.loadMe()).resolves.toBeUndefined()
    expect(store.viewer).toBeNull()
  })

  // ---- loadDashboard ----
  it('loadDashboard：成功后写入 dashboard 且 loading 复位', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: makeDashboard(), message: 'ok' })
    const store = useGovStore()
    const p = store.loadDashboard()
    expect(store.loading).toBe(true)
    await p
    expect(store.loading).toBe(false)
    expect(store.dashboard?.aed.total).toBe(10)
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/gov/dashboard?window=30' })
    )
  })

  it('loadDashboard：失败记 error 并向上抛出', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: '看板加载失败' })
    const store = useGovStore()
    await expect(store.loadDashboard()).rejects.toThrow('看板加载失败')
    expect(store.error).toBe('看板加载失败')
    expect(store.loading).toBe(false)
  })

  // ---- setWindow / setDistrict ----
  it('setWindow：更新窗口并用新值重载', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: makeDashboard(), message: 'ok' })
    const store = useGovStore()
    store.setWindow(7)
    expect(store.windowDays).toBe(7)
    await flushPromises()
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/gov/dashboard?window=7' })
    )
  })

  it('setDistrict：更新区域并用新值重载（district 被编码）', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: makeDashboard(), message: 'ok' })
    const store = useGovStore()
    store.setDistrict('天河区')
    expect(store.district).toBe('天河区')
    await flushPromises()
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/gov/dashboard?window=30&district=%E5%A4%A9%E6%B2%B3%E5%8C%BA' })
    )
  })

  it('setWindow：重载失败不产生未处理 rejection（直接监听 unhandledRejection）', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason) }
    process.on('unhandledRejection', onUnhandled)
    try {
      vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: 'boom' })
      const store = useGovStore()
      store.setWindow(90) // 内部 loadDashboard 失败后已 .catch 兜底
      await flushPromises()
      await new Promise((r) => setTimeout(r, 0)) // 给 unhandledRejection 派发时机
      expect(unhandled).toHaveLength(0)
      expect(store.windowDays).toBe(90)
      expect(store.error).toBe('boom')
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  // ---- logout ----
  it('logout：清除 gov_token 与全部状态', () => {
    const store = useGovStore()
    store.viewer = viewer
    store.dashboard = makeDashboard()
    store.logout()
    expect(uni.removeStorageSync).toHaveBeenCalledWith('gov_token')
    expect(store.viewer).toBeNull()
    expect(store.dashboard).toBeNull()
  })
})
