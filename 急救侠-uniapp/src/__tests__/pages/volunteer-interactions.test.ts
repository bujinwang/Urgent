/**
 * F4 T04 覆盖补缺 · `pages/volunteer/*` 的**交互路径**守卫（QA 列出的未覆盖不变量 1–7）。
 *
 * 原则：每条用例都必须「**删掉对应的那一行实现 ⇒ 精确变红**」。
 * 重点防假绿：**失败 toast**（catch 里什么都不做也能全绿）、**非法区间**（只断言弹了 toast 而不断言"没调 API"）、
 * **分页边界**（只断言调了 setPage 而不断言"不越界"）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { setLocale } from '@/i18n'
import { messages } from '@/locales'
import { useServiceHoursStore } from '@/stores/serviceHours'
import { useUserStore } from '@/stores/user'

// ---------------- mocks ----------------
const userFixture = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
vi.mock('@/api/user', () => ({
  fetchProfile: vi.fn(() => Promise.resolve(userFixture.current)),
  fetchStats: vi.fn(() => Promise.resolve({ certifiedRescuers: 0, networkedAeds: 0, monthlyRescues: 0, onlineVolunteers: 0, aedsWithin1km: 0 })),
  awardPointsApi: vi.fn(() => Promise.resolve({ points: 0, tier: 'bronze', reason: '' })),
}))
vi.mock('@/api/org', () => ({ fetchUserOrgRoles: vi.fn(() => Promise.resolve([])) }))
vi.mock('@/api/serviceHours', () => ({
  getMyHours: vi.fn(() => Promise.resolve({ totalMinutes: 0, breakdown: [], items: [], page: 1, pageSize: 20, total: 0 })),
  createCertificate: vi.fn(() => Promise.resolve({ certNo: 'VS-NEW', periodFromMs: 0, periodToMs: 1, totalMinutes: 0, breakdown: [], issuedAtMs: 1, status: 'active' })),
  listMyCertificates: vi.fn(() => Promise.resolve([])),
  verifyCertificate: vi.fn(() => Promise.resolve({ certNo: 'VS-X', periodFromMs: 0, periodToMs: 1, totalMinutes: 0, status: 'active' })),
  revokeCertificate: vi.fn(() => Promise.resolve({ certNo: 'VS-X', status: 'revoked' })),
}))
vi.mock('@/utils/govExport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/govExport')>()),
  downloadText: vi.fn(),
  printGovDashboard: vi.fn(),
}))

import { getMyHours, createCertificate, listMyCertificates, verifyCertificate, revokeCertificate } from '@/api/serviceHours'

const LOGGED = {
  id: 'u_test', name: 'Tester', avatar: 'T', tier: 'bronze', points: 0,
  city: '', volunteerId: '', certifications: [] as string[], rescueCount: 0, volunteer_type: 'medical',
}

async function mountHours() { const p = await import('@/pages/volunteer/hours.vue'); return mount(p.default) }
async function mountCerts() { const p = await import('@/pages/volunteer/certificates.vue'); return mount(p.default) }

let printSpy: ReturnType<typeof vi.fn>
const toastTitles = () => vi.mocked(uni.showToast).mock.calls.map((c) => (c[0] as { title?: string })?.title)

describe('F4 T04 补缺 · volunteer 页交互路径', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    setLocale('zh-CN')
    vi.clearAllMocks()
    userFixture.current = { ...LOGGED }           // 登录态（fetchProfile 会把它写进 profile）
    printSpy = vi.fn()
    Object.defineProperty(window, 'print', { value: printSpy, writable: true, configurable: true })
    vi.mocked(listMyCertificates).mockResolvedValue([])
    // ★ 关键：user store 首次创建会**异步**刷新 profile；`onMounted` 是同步的 ⇒
    // 必须**先建 store 并 flush**，否则 mount 时 profile 仍是游客（id='')、onMounted 不会去加载数据。
    useUserStore()
    await flushPromises()
  })
  afterEach(() => setLocale('zh-CN'))

  // ---- #1 撤销调用点 ----
  it('#1 撤销调用点：点 .certs-item-revoke ⇒ 调 revokeCertificate(certNo)', async () => {
    vi.mocked(listMyCertificates).mockResolvedValue([{ certNo: 'VS-A', periodFromMs: 0, periodToMs: 1, totalMinutes: 10, status: 'active', issuedAtMs: 1 }])
    const w = await mountCerts(); await flushPromises()
    await w.find('.certs-item-revoke').trigger('click')
    await flushPromises()
    expect(vi.mocked(revokeCertificate)).toHaveBeenCalledWith('VS-A', undefined)
    w.unmount()
  })

  // ---- #2 打印 ----
  it('#2 打印：点 .certs-print ⇒ 调 window.print()', async () => {
    const w = await mountCerts(); await flushPromises()
    await w.find('.certs-print').trigger('click')
    expect(printSpy).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  // ---- #3 分页（含边界） ----
  it('#3 分页：nextPage ⇒ setPage(2)（调 getMyHours({page:2})）', async () => {
    vi.mocked(getMyHours).mockResolvedValue({ totalMinutes: 0, breakdown: [], items: [], page: 1, pageSize: 20, total: 100 })
    const w = await mountHours(); await flushPromises()
    const before = vi.mocked(getMyHours).mock.calls.length
    await w.findAll('.hours-page-btn')[1].trigger('click') // next
    await flushPromises()
    expect(vi.mocked(getMyHours).mock.calls.length, '应触发一次加载').toBe(before + 1)
    expect((vi.mocked(getMyHours).mock.calls.at(-1)?.[0] as { page?: number })?.page).toBe(2)
    w.unmount()
  })

  it('★ #3 边界：首页 prev 不越界（不触发加载）', async () => {
    vi.mocked(getMyHours).mockResolvedValue({ totalMinutes: 0, breakdown: [], items: [], page: 1, pageSize: 20, total: 100 })
    const w = await mountHours(); await flushPromises()
    expect(useServiceHoursStore().page).toBe(1)
    const before = vi.mocked(getMyHours).mock.calls.length
    await w.findAll('.hours-page-btn')[0].trigger('click') // prev @ page 1
    await flushPromises()
    expect(vi.mocked(getMyHours).mock.calls.length, '首页往前 ⇒ 不得发起加载').toBe(before)
    w.unmount()
  })

  it('★ #3 边界：末页 next 不越界（不触发加载）', async () => {
    vi.mocked(getMyHours).mockResolvedValue({ totalMinutes: 0, breakdown: [], items: [], page: 5, pageSize: 20, total: 100 })
    const w = await mountHours(); await flushPromises()
    expect(useServiceHoursStore().page).toBe(5)
    const before = vi.mocked(getMyHours).mock.calls.length
    await w.findAll('.hours-page-btn')[1].trigger('click') // next @ 末页（5*20=100 已到 total）
    await flushPromises()
    expect(vi.mocked(getMyHours).mock.calls.length, '末页往后 ⇒ 不得发起加载').toBe(before)
    w.unmount()
  })

  // ---- #4 非法区间（断言"没调 API"） ----
  it('★ #4 非法区间（start > end）⇒ 提示 invalidRange 且**绝不调** createCertificate', async () => {
    const w = await mountCerts(); await flushPromises()
    const inputs = w.findAll('.certs-range-input')
    await inputs[0].setValue('2026-09-17') // from
    await inputs[1].setValue('2026-01-01') // to（早于 from ⇒ 非法）
    await w.find('.certs-range .certs-btn-primary').trigger('click')
    await flushPromises()
    expect(vi.mocked(createCertificate), '非法区间不得发请求').not.toHaveBeenCalled()
    expect(toastTitles()).toContain(messages['zh-CN'].serviceCert.invalidRange)
    w.unmount()
  })

  // ---- #5 三个失败 toast（防"catch 里空转"） ----
  it('★ #5a 生成失败 ⇒ 提示 createFailed（不静默吞掉）', async () => {
    vi.mocked(createCertificate).mockRejectedValueOnce(new Error('no data'))
    const w = await mountCerts(); await flushPromises()
    await w.find('.certs-range .certs-btn-primary').trigger('click') // 默认区间合法
    await flushPromises()
    expect(toastTitles()).toContain(messages['zh-CN'].serviceCert.createFailed)
    w.unmount()
  })

  it('★ #5b 验真失败 ⇒ 渲染 verifyNotFound（不静默吞掉）', async () => {
    vi.mocked(verifyCertificate).mockRejectedValueOnce(new Error('404'))
    const w = await mountCerts(); await flushPromises()
    await w.find('.certs-verify-input').setValue('VS-NOPE')
    await w.find('.certs-verify .certs-btn-primary').trigger('click')
    await flushPromises()
    expect(w.find('.certs-verify-result').text()).toBe(messages['zh-CN'].serviceCert.verifyNotFound)
    w.unmount()
  })

  it('★ #5c 撤销失败 ⇒ 提示 revokeFailed（不静默吞掉）', async () => {
    vi.mocked(listMyCertificates).mockResolvedValue([{ certNo: 'VS-B', periodFromMs: 0, periodToMs: 1, totalMinutes: 5, status: 'active', issuedAtMs: 1 }])
    vi.mocked(revokeCertificate).mockRejectedValueOnce(new Error('403'))
    const w = await mountCerts(); await flushPromises()
    await w.find('.certs-item-revoke').trigger('click')
    await flushPromises()
    expect(toastTitles()).toContain(messages['zh-CN'].serviceCert.revokeFailed)
    w.unmount()
  })

  // ---- #6 已撤销状态渲染 ----
  it('#6 已撤销 ⇒ 列表项显示「已撤销」且与 active 可区分（active 才有撤销按钮）', async () => {
    vi.mocked(listMyCertificates).mockResolvedValue([
      { certNo: 'VS-REV', periodFromMs: 0, periodToMs: 1, totalMinutes: 7, status: 'revoked', issuedAtMs: 1 },
      { certNo: 'VS-ACT', periodFromMs: 0, periodToMs: 1, totalMinutes: 9, status: 'active', issuedAtMs: 2 },
    ])
    const w = await mountCerts(); await flushPromises()
    const items = w.findAll('.certs-item')
    expect(items).toHaveLength(2)

    // 第 1 项 = revoked：有「已撤销」文案、**无**撤销按钮
    expect(items[0].find('.certs-item-status').exists()).toBe(true)
    expect(items[0].find('.certs-item-status').text()).toBe(messages['zh-CN'].serviceCert.revoked)
    expect(items[0].find('.certs-item-revoke').exists()).toBe(false)

    // 第 2 项 = active：**无**「已撤销」文案、**有**撤销按钮
    expect(items[1].find('.certs-item-status').exists()).toBe(false)
    expect(items[1].find('.certs-item-revoke').exists()).toBe(true)
    w.unmount()
  })

  // ---- #7 goBack ----
  it('#7 goBack：有上级页 ⇒ navigateBack', async () => {
    vi.mocked(getCurrentPages).mockReturnValueOnce([{ options: {}, route: 'a' }, { options: {}, route: 'b' }] as unknown as ReturnType<typeof getCurrentPages>)
    const w = await mountHours(); await flushPromises()
    await w.find('.hours-back').trigger('click')
    expect(uni.navigateBack).toHaveBeenCalledTimes(1)
    expect(uni.switchTab).not.toHaveBeenCalled()
    w.unmount()
  })

  it('#7 goBack：无上级页（栈深 1）⇒ switchTab 到「我的」', async () => {
    const w = await mountCerts(); await flushPromises()
    await w.find('.certs-back').trigger('click')
    expect(uni.switchTab).toHaveBeenCalledWith({ url: '/pages/cert/index' })
    expect(uni.navigateBack).not.toHaveBeenCalled()
    w.unmount()
  })

  // ---- 加载失败态（**与空态可区分**；绝不静默落空态） ----
  it('★ 加载失败（hours）⇒ 渲染失败态、且**不**渲染空态文案（否则用户误以为时长丢了）', async () => {
    vi.mocked(getMyHours).mockRejectedValueOnce(new Error('net'))
    const w = await mountHours(); await flushPromises()
    expect(w.find('.hours-error').exists()).toBe(true)
    expect(w.find('.hours-error-text').text()).toBe(messages['zh-CN'].hours.loadFailed)
    expect(w.text(), '失败态不得落成空态').not.toContain(messages['zh-CN'].hours.empty)
    w.unmount()
  })

  it('★ 调用点：点 hours 失败态「重试」⇒ 再次加载（getMyHours 第 2 次）；成功后失败态消失', async () => {
    vi.mocked(getMyHours).mockRejectedValueOnce(new Error('net'))
    const w = await mountHours(); await flushPromises()
    expect(w.find('.hours-error').exists()).toBe(true)

    vi.mocked(getMyHours).mockResolvedValueOnce({ totalMinutes: 0, breakdown: [], items: [], page: 1, pageSize: 20, total: 0 })
    await w.find('.hours-error-retry').trigger('click')
    await flushPromises()
    expect(vi.mocked(getMyHours).mock.calls.length, '重试应再发一次请求').toBe(2)
    expect(w.find('.hours-error').exists()).toBe(false)
    w.unmount()
  })

  it('★ 两态可区分（hours）：无错误且无数据 ⇒ 空态（且无失败态）', async () => {
    const w = await mountHours(); await flushPromises()
    expect(w.find('.hours-error').exists()).toBe(false)
    expect(w.find('.hours-empty').text()).toBe(messages['zh-CN'].hours.empty)
    w.unmount()
  })

  it('★ 加载失败（certificates）⇒ 渲染失败态、且**不**渲染空态文案', async () => {
    vi.mocked(listMyCertificates).mockRejectedValueOnce(new Error('net'))
    const w = await mountCerts(); await flushPromises()
    expect(w.find('.certs-error').exists()).toBe(true)
    expect(w.find('.certs-error-text').text()).toBe(messages['zh-CN'].serviceCert.loadFailed)
    expect(w.text(), '失败态不得落成空态').not.toContain(messages['zh-CN'].serviceCert.empty)
    w.unmount()
  })

  it('★ 调用点：点 certificates 失败态「重试」⇒ 再次加载（listMyCertificates 第 2 次）', async () => {
    vi.mocked(listMyCertificates).mockRejectedValueOnce(new Error('net'))
    const w = await mountCerts(); await flushPromises()
    expect(w.find('.certs-error').exists()).toBe(true)

    vi.mocked(listMyCertificates).mockResolvedValueOnce([])
    await w.find('.certs-error-retry').trigger('click')
    await flushPromises()
    expect(vi.mocked(listMyCertificates).mock.calls.length, '重试应再发一次请求').toBe(2)
    expect(w.find('.certs-error').exists()).toBe(false)
    w.unmount()
  })

  it('★ 两态可区分（certificates）：无错误且无数据 ⇒ 空态（且无失败态）；动作失败不把整页换成失败态', async () => {
    const w = await mountCerts(); await flushPromises()
    expect(w.find('.certs-error').exists()).toBe(false)
    expect(w.find('.certs-empty').text()).toBe(messages['zh-CN'].serviceCert.empty)

    // 「撤销失败」（actions 失败）不得让整页变成加载失败态（验证用了**局部** loadError 而非 store.error）
    vi.mocked(listMyCertificates).mockResolvedValue([{ certNo: 'VS-R', periodFromMs: 0, periodToMs: 1, totalMinutes: 3, status: 'active', issuedAtMs: 1 }])
    const w2 = await mountCerts(); await flushPromises()
    vi.mocked(revokeCertificate).mockRejectedValueOnce(new Error('403'))
    await w2.find('.certs-item-revoke').trigger('click')
    await flushPromises()
    expect(w2.find('.certs-error').exists(), '动作失败 ≠ 加载失败').toBe(false)
    expect(w2.find('.certs-item').exists(), '列表内容应仍在').toBe(true)
    w.unmount(); w2.unmount()
  })
})
