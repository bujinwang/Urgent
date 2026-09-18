/**
 * P0-1 收尾 —— 写操作「**失败可见化**」守卫（QA 缺陷 5.2：静默兜底 / 假成功）。
 *
 * 为什么单独测这个：后端 P0-1 加固后，`approve`（动员批准）/ `complete`（演习完成）/
 * `addCert`（机构发证）对无权限调用者返回 **403**；而前端这三个点原先都是
 * `await request(...)` + 无条件弹成功 toast —— `request()` 对 403 **不抛错** ⇒
 * **用户看到「已批准 / 已完成 / 已发证」，服务端其实拒绝了**（假成功，比静默更糟）。
 * 实测突变：把 `notifyIfFailed(...)` 那一行删掉 ⇒ 本文件精确变红（见文件末尾注释）。
 *
 * 覆盖原则（防假绿）：
 * 1. 失败 ⇒ **必须**断言「弹了失败提示」**且**「没弹成功提示」；
 * 2. 成功 ⇒ **必须**断言「没弹失败提示」；
 * 3. 403 与其它失败文案**不同**（403 说“无权”，其余说“失败请重试”）；
 * 4. 中英双语都断言（`common.noPermission` / `common.actionFailed`）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { request, requestFull } from '@/api/index'
import { i18n, setLocale } from '@/i18n'
import { notifyIfFailed, isForbidden } from '@/utils/action-feedback'
import { useOrgStore } from '@/stores/org'

/** 登录用户（id 必须能被页面/按钮的可见性条件匹配上）。 */
const LOGGED = {
  id: 'user_001', name: 'Tester', avatar: 'T', tier: 'bronze', points: 0,
  city: '', volunteerId: '', certifications: [] as string[], rescueCount: 0,
  volunteer_type: 'medical',
}

const profileFixture = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

// user store 首次创建会**异步**拉 profile；不 mock 的话 `request`(→null) 会把 profile 写坏。
vi.mock('@/api/user', () => ({
  fetchProfile: vi.fn(() => Promise.resolve(profileFixture.current)),
  fetchStats: vi.fn(() => Promise.resolve({
    certifiedRescuers: 0, networkedAeds: 0, monthlyRescues: 0,
    onlineVolunteers: 0, aedsWithin1km: 0,
  })),
}))
// `fetchUserOrgRoles` 走 mock（返回空角色）；其余（含 `addCertificateFull`）**保留真实实现**。
vi.mock('@/api/org', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/org')>()),
  fetchUserOrgRoles: vi.fn(() => Promise.resolve([])),
}))

import { useUserStore } from '@/stores/user'

const toastTitles = (): Array<string | undefined> =>
  vi.mocked(uni.showToast).mock.calls.map((c) => (c[0] as { title?: string } | undefined)?.title)

/** 全局 i18n 的 `t`（在 zh-CN 下取期望文案，避免把翻译写死在断言里）。 */
function gt(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

/** 建好 pinia + 已登录的 user store（profile 已落地）。 */
async function readyUser(): Promise<void> {
  const userStore = useUserStore()
  await flushPromises()
  expect(userStore.profile.id).toBe('user_001')
}

describe('P0-1 收尾 · 写操作失败可见化', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setLocale('zh-CN')
    vi.clearAllMocks()
    profileFixture.current = { ...LOGGED }
    vi.mocked(request).mockResolvedValue(null)
    vi.mocked(requestFull).mockResolvedValue({ code: 0, message: 'ok' })
  })

  afterEach(() => {
    setLocale('zh-CN')
    vi.unstubAllGlobals()
  })

  // ---------------- 1. 判定 + 文案（unit） ----------------
  describe('notifyIfFailed：判定与本地化文案', () => {
    it('★ 403 ⇒ 视为失败且提示「无权执行此操作」', () => {
      const failed = notifyIfFailed({ code: -1, message: '无权审批动员', statusCode: 403 })
      expect(failed).toBe(true)
      expect(toastTitles()).toEqual([gt('common.noPermission')])
      expect(gt('common.noPermission')).toBe('无权执行此操作')
    })

    it('★ 非 403 失败（网络 / 500）⇒ 提示「操作失败，请稍后重试」（不与 403 混用）', () => {
      const failed = notifyIfFailed({ code: -1, message: '网络错误' })
      expect(failed).toBe(true)
      expect(toastTitles()).toEqual(['操作失败，请稍后重试'])
      expect(gt('common.actionFailed')).toBe('操作失败，请稍后重试')
    })

    it('★ 成功（code=0）⇒ 不弹任何提示，返回 false', () => {
      const failed = notifyIfFailed({ code: 0, message: 'ok', statusCode: 200 })
      expect(failed).toBe(false)
      expect(vi.mocked(uni.showToast)).not.toHaveBeenCalled()
    })

    it('★ en-US 下同样是本地化文案（不是中文硬编码）', () => {
      setLocale('en-US')
      notifyIfFailed({ code: -1, message: 'forbidden', statusCode: 403 })
      notifyIfFailed({ code: -1, message: 'boom' })
      expect(toastTitles()).toEqual([
        'No permission to perform this action',
        'Action failed. Please try again later.',
      ])
    })

    it('isForbidden：认 HTTP 403 与业务码 403，不认其它', () => {
      expect(isForbidden({ code: -1, message: '', statusCode: 403 })).toBe(true)
      expect(isForbidden({ code: 403, message: '' })).toBe(true)
      expect(isForbidden({ code: 0, message: '', statusCode: 200 })).toBe(false)
      expect(isForbidden(null)).toBe(false)
    })
  })

  // ---------------- 2. 动员「批准」按钮 ----------------
  describe('rescue/mobilize：批准（403 ⇒ 不再假成功）', () => {
    /** 装载页面：列表里有一条 pending 动员，当前用户可见「批准」按钮。 */
    async function mountMobilize() {
      await readyUser()
      vi.mocked(request).mockResolvedValue([
        { id: 'm1', title: 'T', description: '', address: '', status: 'pending',
          volunteersResponded: 0, volunteersNeeded: 5, leaderName: 'L' },
      ])
      const page = await import('@/pages/rescue/mobilize.vue')
      const wrapper = mount(page.default)
      await flushPromises()
      expect(wrapper.find('.mob-btn.approve').exists()).toBe(true)
      return wrapper
    }

    it('★ 批准被 403 ⇒ 弹「无权执行此操作」且**不**弹「已批准」', async () => {
      const wrapper = await mountMobilize()
      vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: '无权审批动员', statusCode: 403 })

      await wrapper.find('.mob-btn.approve').trigger('click')
      await flushPromises()

      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/rescue/mobilizations/m1/approve', method: 'PUT' }),
      )
      const titles = toastTitles()
      expect(titles).toContain('无权执行此操作')
      expect(titles).not.toContain('已批准')
      wrapper.unmount()
    })

    it('批准成功 ⇒ 弹「已批准」且不弹失败文案', async () => {
      const wrapper = await mountMobilize()
      vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: {}, message: 'ok' })

      await wrapper.find('.mob-btn.approve').trigger('click')
      await flushPromises()

      const titles = toastTitles()
      expect(titles).toContain('已批准')
      expect(titles).not.toContain('无权执行此操作')
      wrapper.unmount()
    })
  })

  // ---------------- 3. 演习「完成」按钮 ----------------
  describe('drill：完成（403 ⇒ 不再假成功）', () => {
    /** 装载页面：`load()` 走的是裸 fetch ⇒ 用桩喂一条「我是组织者」的 upcoming 演习。 */
    async function mountDrill() {
      await readyUser()
      vi.stubGlobal('fetch', vi.fn(async () => ({
        json: async () => ({
          code: 0,
          data: [{
            id: 'd1', title: 'T', scenario: 'cpr', description: '', date: '2024-01-01',
            location: 'L', organizerName: 'Tester', organizerId: 'user_001',
            currentParticipants: 1, maxParticipants: 10, pointsReward: 10, status: 'upcoming',
          }],
        }),
      })))
      const page = await import('@/pages/drill/index.vue')
      const wrapper = mount(page.default)
      await flushPromises()
      expect(wrapper.find('.drill-btn.complete').exists()).toBe(true)
      return wrapper
    }

    it('★ 完成被 403 ⇒ 弹「无权执行此操作」且**不**弹积分到账文案', async () => {
      const wrapper = await mountDrill()
      vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: '无权结束该演习', statusCode: 403 })

      await wrapper.find('.drill-btn.complete').trigger('click')
      await flushPromises()

      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/drill/events/d1/complete', method: 'PUT' }),
      )
      const titles = toastTitles()
      expect(titles).toContain('无权执行此操作')
      expect(titles).not.toContain(gt('drill.toast.pointsAwarded'))
      wrapper.unmount()
    })

    it('完成成功 ⇒ 弹积分到账文案且不弹失败文案', async () => {
      const wrapper = await mountDrill()
      vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: {}, message: 'ok' })

      await wrapper.find('.drill-btn.complete').trigger('click')
      await flushPromises()

      const titles = toastTitles()
      expect(titles).toContain(gt('drill.toast.pointsAwarded'))
      expect(titles).not.toContain('无权执行此操作')
      wrapper.unmount()
    })
  })

  // ---------------- 4. 机构发证 ----------------
  describe('stores/org：addCert（403 ⇒ 不再静默）', () => {
    const CERT = { userId: 'u1', type: 'CPR', issueDate: '2024-01-01', expiryDate: '2025-01-01' }

    it('★ 发证被 403 ⇒ 返回 false、弹「无权执行此操作」、**不**刷新列表', async () => {
      const store = useOrgStore()
      store.orgId = 'org_1'
      vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: '无权给该机构成员颁发证书', statusCode: 403 })

      const ok = await store.addCert(CERT)

      expect(ok).toBe(false)
      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/org/org_1/certificates', method: 'POST' }),
      )
      expect(toastTitles()).toContain('无权执行此操作')
      // 失败不得当作成功去刷新（否则看板会“看起来发了证”）
      expect(vi.mocked(request)).not.toHaveBeenCalled()
    })

    it('发证成功 ⇒ 返回 true、不弹失败提示、并刷新证书列表与看板', async () => {
      const store = useOrgStore()
      store.orgId = 'org_1'
      vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: { id: 'c1' }, message: 'ok' })

      const ok = await store.addCert(CERT)

      expect(ok).toBe(true)
      expect(toastTitles()).not.toContain('无权执行此操作')
      expect(vi.mocked(request)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/org/org_1/certificates' }),
      )
      expect(vi.mocked(request)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/org/org_1' }),
      )
    })

    it('未选机构 ⇒ 直接 false，不发请求也不弹提示', async () => {
      const store = useOrgStore()
      const ok = await store.addCert(CERT)
      expect(ok).toBe(false)
      expect(vi.mocked(requestFull)).not.toHaveBeenCalled()
      expect(vi.mocked(uni.showToast)).not.toHaveBeenCalled()
    })
  })
})

/**
 * 突变记录（本文件的对应用例必须变红）：
 * - M1 `mobilize.vue` 删掉 `approve()` 里的 `if (notifyIfFailed(res)) return` ⇒ 「403 ⇒ 不弹已批准」红
 *   （会走到 `已批准` 假成功分支）。
 * - M2 `drill/index.vue` 删掉 `complete()` 里的 `if (notifyIfFailed(res)) return` ⇒ 同上的 drill 用例红。
 * - M3 `stores/org.ts` 删掉 `addCert()` 里的 `if (notifyIfFailed(res)) return false` ⇒ addCert 403 用例红。
 * - M4 `utils/action-feedback.ts` 把 `isForbidden()` 改成恒 `false` ⇒ 403 文案断言红（退化成通用失败文案）。
 * - M5 把 `notifyIfFailed()` 的 `showToast` 调用删掉（只 return true）⇒ 全部「必须弹提示」用例红。
 */
