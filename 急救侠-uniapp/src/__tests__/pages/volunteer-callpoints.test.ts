/**
 * F4 T04 · **按钮调用点守卫**（本项目教训：模块级测试再全，删掉页面那一行调用照样全绿）。
 *
 * 三个调用点各一条用例：删掉页面对应那一行 ⇒ **对应用例变红**。
 * - `hours.vue` 「导出 CSV」→ `downloadText`（`@/utils/govExport`）
 * - `hours.vue` 「生成证明」→ `uni.navigateTo('/pages/volunteer/certificates')`
 * - `certificates.vue` 「生成证明」→ `createCertificate`（`@/api/serviceHours`）
 * - `certificates.vue` 「验真」→ `verifyCertificate`
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '@/stores/user'
import type { UserProfile } from '@/api/user'

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

import { downloadText } from '@/utils/govExport'
import { createCertificate, verifyCertificate } from '@/api/serviceHours'

const PROFILE: UserProfile = {
  id: 'u_test', name: 'Tester', avatar: 'T', tier: 'bronze', points: 0,
  city: '', volunteerId: '', certifications: [], rescueCount: 0, volunteer_type: 'medical',
}
/** 先 flush 落地 store 的异步 `refresh()`，再设 profile（否则会被 refresh 覆盖成 null）。 */
async function login() {
  const u = useUserStore()
  await flushPromises()
  u.profile = { ...PROFILE }
}

describe('F4 T04 · 页面按钮调用点', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.clearAllMocks() })

  it('★ 调用点：hours「导出 CSV」⇒ downloadText 恰好一次（删掉那一行 ⇒ 本用例红）', async () => {
    await login()
    const page = await import('@/pages/volunteer/hours.vue')
    const w = mount(page.default)
    await flushPromises()

    await w.find('.hours-btn-secondary').trigger('click')
    expect(vi.mocked(downloadText)).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('★ 调用点：hours「生成证明」⇒ 跳转证明页', async () => {
    await login()
    const page = await import('@/pages/volunteer/hours.vue')
    const w = mount(page.default)
    await flushPromises()

    await w.find('.hours-btn-primary').trigger('click')
    expect(uni.navigateTo).toHaveBeenCalledWith({ url: '/pages/volunteer/certificates' })
    w.unmount()
  })

  it('★ 调用点：certificates「生成证明」⇒ createCertificate 被调用（删掉那一行 ⇒ 本用例红）', async () => {
    await login()
    const page = await import('@/pages/volunteer/certificates.vue')
    const w = mount(page.default)
    await flushPromises()

    await w.find('.certs-range .certs-btn-primary').trigger('click')
    await flushPromises()
    expect(vi.mocked(createCertificate)).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('★ 调用点：certificates「验真」⇒ verifyCertificate 被调用且带输入编号', async () => {
    await login()
    const page = await import('@/pages/volunteer/certificates.vue')
    const w = mount(page.default)
    await flushPromises()

    await w.find('.certs-verify-input').setValue('VS-TEST-1')
    await w.find('.certs-verify .certs-btn-primary').trigger('click')
    await flushPromises()
    expect(vi.mocked(verifyCertificate)).toHaveBeenCalledWith('VS-TEST-1')
    w.unmount()
  })
})
