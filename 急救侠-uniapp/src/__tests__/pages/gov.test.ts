import { describe, it, expect, beforeEach, vi } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { requestFull } from '@/api/index'
import { downloadText } from '@/utils/govExport'
import { useGovStore } from '@/stores/gov'
import type { GovViewer, GovDashboard } from '@/api/gov'

// 仅 mock downloadText（副作用），保留其余真实实现 —— 以便断言 CSV 参数且不触碰真实 DOM 下载。
vi.mock('@/utils/govExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/govExport')>()
  return { ...actual, downloadText: vi.fn() }
})

const viewer: GovViewer = {
  id: 'g1', name: '张监管', orgName: '天河卫健委', scopeAll: false, districts: ['天河区'],
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
    ],
  }
}

/** 覆盖 uni.getStorageSync：按 key 返回，未命中返回空串。 */
function setStorage(values: Record<string, string>): void {
  vi.mocked(uni.getStorageSync).mockImplementation((key: string): any => values[key] ?? '')
}

describe('政府看板页面', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(requestFull).mockReset()
    vi.mocked(requestFull).mockResolvedValue({ code: 0, message: 'ok' })
    vi.mocked(uni.getStorageSync).mockReset()
    setStorage({ jwt_token: 'mock-token-123' }) // 默认无 gov_token ⇒ 未登录
  })

  describe('pages/gov/dashboard.vue', () => {
    it('未登录（无 gov_token）⇒ onMounted 跳转登录页', async () => {
      const page = await import('@/pages/gov/dashboard.vue')
      shallowMount(page.default)
      await flushPromises()
      await flushPromises()
      expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/gov/login' })
    })

    it('已登录 ⇒ 加载身份与看板，无响应样本时显示「数据积累中」提示', async () => {
      setStorage({ gov_token: 'gov-tok-1' })
      vi.mocked(requestFull)
        .mockResolvedValueOnce({ code: 0, data: viewer, message: 'ok' }) // /gov/me
        .mockResolvedValueOnce({ code: 0, data: makeDashboard(), message: 'ok' }) // /gov/dashboard
      const page = await import('@/pages/gov/dashboard.vue')
      const wrapper = shallowMount(page.default)
      await flushPromises()
      await flushPromises()
      expect(uni.redirectTo).not.toHaveBeenCalled()
      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(expect.objectContaining({ url: '/gov/me' }))
      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/gov/dashboard?window=30' })
      )
      expect(wrapper.text()).toContain('数据积累中')
      expect(wrapper.text()).toContain('AED 概览')
    })

    /** 装载「已登录 + 已取到看板数据」的页面。 */
    async function mountLoaded() {
      setStorage({ gov_token: 'gov-tok-1' })
      vi.mocked(requestFull)
        .mockResolvedValueOnce({ code: 0, data: viewer, message: 'ok' }) // /gov/me
        .mockResolvedValueOnce({ code: 0, data: makeDashboard(), message: 'ok' }) // /gov/dashboard
      const page = await import('@/pages/gov/dashboard.vue')
      const wrapper = shallowMount(page.default)
      await flushPromises()
      await flushPromises()
      return wrapper
    }

    it('导出按钮存在，「导出 PDF」调用 window.print', async () => {
      const wrapper = await mountLoaded()
      expect(wrapper.find('.gov-csv-btn').exists()).toBe(true)
      expect(wrapper.find('.gov-pdf-btn').exists()).toBe(true)
      expect(wrapper.text()).toContain('导出 CSV')
      expect(wrapper.text()).toContain('导出 PDF')

      const printSpy = vi.fn()
      const orig = (window as unknown as { print?: () => void }).print
      ;(window as unknown as { print: () => void }).print = printSpy
      await wrapper.find('.gov-pdf-btn').trigger('click')
      expect(printSpy).toHaveBeenCalledTimes(1)
      ;(window as unknown as { print?: () => void }).print = orig
    })

    it('「导出 CSV」不抛错且以正确参数调用 downloadText', async () => {
      const wrapper = await mountLoaded()
      await wrapper.find('.gov-csv-btn').trigger('click')
      expect(vi.mocked(downloadText)).toHaveBeenCalledTimes(1)
      const call = vi.mocked(downloadText).mock.calls[0]
      expect(call[0]).toMatch(/^gov-dashboard-\d{8}\.csv$/)
      expect(call[1].startsWith('\uFEFF')).toBe(true)
      expect(call[1]).toContain('区域,AED数')
      expect(call[2]).toBe('text/csv;charset=utf-8')
    })

    it('无看板数据（dashboard=null）时：导出 CSV / PDF 均提示「暂无数据可导出」且不触发导出', async () => {
      const wrapper = await mountLoaded()
      const store = useGovStore()
      store.dashboard = null
      await flushPromises()
      vi.mocked(uni.showToast).mockClear()

      await wrapper.find('.gov-csv-btn').trigger('click')
      expect(vi.mocked(uni.showToast)).toHaveBeenCalledWith(
        expect.objectContaining({ title: '暂无数据可导出' })
      )
      expect(vi.mocked(downloadText)).not.toHaveBeenCalled()

      vi.mocked(uni.showToast).mockClear()
      const printSpy = vi.fn()
      const orig = (window as unknown as { print?: () => void }).print
      ;(window as unknown as { print: () => void }).print = printSpy
      await wrapper.find('.gov-pdf-btn').trigger('click')
      expect(vi.mocked(uni.showToast)).toHaveBeenCalledWith(
        expect.objectContaining({ title: '暂无数据可导出' })
      )
      expect(printSpy).not.toHaveBeenCalled()
      ;(window as unknown as { print?: () => void }).print = orig
    })
  })

  describe('pages/gov/login.vue', () => {
    it('空用户名/密码 ⇒ 提示「请输入用户名与密码」且不发起登录请求', async () => {
      const page = await import('@/pages/gov/login.vue')
      const wrapper = shallowMount(page.default)
      await wrapper.find('.gov-btn').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('请输入用户名与密码')
      expect(vi.mocked(requestFull)).not.toHaveBeenCalled()
    })

    it('合法凭据 ⇒ 登录成功（写 gov_token）并跳转看板', async () => {
      vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: { token: 'gov-tok', viewer }, message: 'ok' })
      const page = await import('@/pages/gov/login.vue')
      const wrapper = shallowMount(page.default)
      const inputs = wrapper.findAll('input')
      await inputs[0].setValue('govuser')
      await inputs[1].setValue('pw123')
      await wrapper.find('.gov-btn').trigger('click')
      await flushPromises()
      await flushPromises()
      expect(uni.setStorageSync).toHaveBeenCalledWith('gov_token', 'gov-tok')
      expect(uni.redirectTo).toHaveBeenCalledWith({ url: '/pages/gov/dashboard' })
    })

    it('登录失败 ⇒ 渲染服务端错误文案且不跳转', async () => {
      vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: '账号或密码错误' })
      const page = await import('@/pages/gov/login.vue')
      const wrapper = shallowMount(page.default)
      const inputs = wrapper.findAll('input')
      await inputs[0].setValue('govuser')
      await inputs[1].setValue('wrong')
      await wrapper.find('.gov-btn').trigger('click')
      await flushPromises()
      await flushPromises()
      expect(wrapper.text()).toContain('账号或密码错误')
      expect(uni.redirectTo).not.toHaveBeenCalled()
    })
  })
})
