/**
 * P0-2 前端收口 —— **调用点守卫**（QA 只读盘点出的 401/403 复发点）。
 *
 * 背景（为什么必须单独一个文件）：后端 P0-2 给一批原本无鉴权的端点加了 `authMiddleware`，
 * 并给救援 `media` / `volunteers` / `live` 三个读端点 + `media` / live start 两个写端点加了
 * 「**仅该任务参与者**」作用域。**收紧必然产生新的 401/403**，而本项目前端处理 401/403 的方式
 * 一直是错的、已复发 5 次：
 *   1~4) 裸 `fetch`（不带 token）⇒ 401 ⇒ 被 `catch{}` 空吞 ⇒ 页面显示“暂无数据”；
 *   5)   `request()` 遇到 403 只 `console.warn` **不抛错** ⇒ 调用方无条件弹“已批准” ⇒ **假成功**。
 *
 * 本文件锁的是**调用点**：谁在失败时弹了成功提示、谁清掉了用户输入、谁把 UI 乐观推进了。
 *
 * 覆盖原则（防假绿）：
 * 1. 失败 ⇒ 断言「**弹了失败提示**」**且**「**没弹**成功提示」；
 * 2. 失败 ⇒ 断言「**没有清空**用户输入」（救援现场丢一条更新不可接受）；
 * 3. 读端点 403 ⇒ 断言列表是 **`[]`**（不是 undefined ⇒ 不会触发渲染期 TypeError）；
 * 4. live start 403 ⇒ 断言 `isLive` **没被改**（无 UI 状态错乱）；
 * 5. `uni.uploadFile` **必须**带 `Authorization` 头。
 *
 * ⚠️ 关于 token 夹具：`pages/auth/login.vue` 的 Demo 登录写入 `jwt_token='demo_token_demo'`
 * —— **不是合法 JWT**，对所有 `authMiddleware` 端点一律 401。故这里用 `REAL_JWT`（三段结构）。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import * as uniApp from '@dcloudio/uni-app'
import { request, requestFull } from '@/api/index'
import { i18n, setLocale } from '@/i18n'
import { isForbidden } from '@/utils/action-feedback'

/** 登录用户（id 需能被页面的可见性/过滤条件匹配上）。 */
const LOGGED = {
  id: 'user_001', name: 'Tester', avatar: 'T', tier: 'bronze', points: 0,
  city: '', volunteerId: '', certifications: [] as string[], rescueCount: 0,
  volunteer_type: 'medical',
}

/**
 * 真 token 夹具：**三段式 JWT**（`header.payload.signature`）。
 * 不用 `'demo_token_demo'`（Demo 登录写入的那个不是 JWT ⇒ 所有鉴权端点都 401，会误导排查）。
 */
const REAL_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzAwMSIsImlhdCI6MTcwMDAwMDAwMH0.9GkQ7Yb2cJ4f8pQd1sV2mZ3nH5rL6tK8wX0aB1cD2eF'

const profileFixture = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))
/**
 * 任务列表夹具。
 *
 * ⚠️ `stores/task.ts` 在 **store 创建时**就 `void refresh()`（自动拉列表）⇒ 直接给
 * `store.tasks` 赋值会在下一次微任务被 **真实** `fetchTaskList()` 的结果覆盖掉。
 * 故这里 mock `@/api/task`，让「兜底 ⇒ `ts.tasks[0]`」这一级有确定的真值。
 */
const taskListFixture = vi.hoisted(() => ({ current: [] as Array<Record<string, unknown>> }))

// user store 首次创建会**异步**拉 profile；不 mock 的话 `request`(→null) 会把 profile 写坏。
vi.mock('@/api/user', () => ({
  fetchProfile: vi.fn(() => Promise.resolve(profileFixture.current)),
  fetchStats: vi.fn(() => Promise.resolve({
    certifiedRescuers: 0, networkedAeds: 0, monthlyRescues: 0,
    onlineVolunteers: 0, aedsWithin1km: 0,
  })),
}))
vi.mock('@/api/org', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/org')>()),
  fetchUserOrgRoles: vi.fn(() => Promise.resolve([])),
}))
vi.mock('@/api/task', () => ({
  mapRescueTask: (raw: any) => raw,
  fetchActiveTask: vi.fn(() => Promise.resolve(null)),
  fetchTaskList: vi.fn(() => Promise.resolve(taskListFixture.current)),
  acceptTaskApi: vi.fn(() => Promise.resolve()),
  arriveTaskApi: vi.fn(() => Promise.resolve()),
  completeTaskApi: vi.fn(() => Promise.resolve()),
  abandonTaskApi: vi.fn(() => Promise.resolve()),
}))

import { useUserStore } from '@/stores/user'
import { useTaskStore } from '@/stores/task'
import { acceptTaskApi } from '@/api/task'

/** 页面 `<script setup>` 的内部状态（本文件通过 `wrapper.vm` 读写以驱动调用点）。 */
type PageVM = Record<string, any>

const toastTitles = (): Array<string | undefined> =>
  vi.mocked(uni.showToast).mock.calls.map((c) => (c[0] as { title?: string } | undefined)?.title)

/** 全局 i18n 的 `t`（取期望文案，避免把翻译写死在断言里）。 */
function gt(key: string): string {
  return (i18n.global as unknown as { t: (k: string) => string }).t(key)
}

/** 服务端 403（**业务码 -1 + HTTP 403** —— 与后端 `sendError(res,403,...)` 一致）。 */
const FORBIDDEN = { code: -1, message: '无权访问该任务的现场更新', statusCode: 403 }
/** 服务端成功。 */
const OK = (data?: unknown): { code: number; message: string; data?: unknown } =>
  ({ code: 0, message: 'ok', data })

/** 建好 pinia + 已登录的 user store（profile 已落地，token 是真 JWT）。 */
async function readyUser(): Promise<void> {
  const userStore = useUserStore()
  await flushPromises()
  expect(userStore.profile.id).toBe('user_001')
}

/** 让 `uni.showModal` 立刻以「确认 + 给定内容」回调（页面把写操作放在 success 回调里）。 */
function mockModalConfirm(content: string, confirm = true): void {
  vi.mocked(uni.showModal).mockImplementation((((opts: any) => {
    opts?.success?.({ confirm, cancel: !confirm, content })
  }) as never))
}

// ---------------------------------------------------------------------------
// `pages/rescue/task-detail` 的宿主夹具（describe E / F 共用）
// ---------------------------------------------------------------------------

/**
 * 让被 mock 的 `onLoad` **同步立即回调**（真实 uni-app 里 `onLoad` 早于 `onMounted`）。
 *
 * setup.ts 里的 `onLoad: vi.fn()` **不执行回调** ⇒ 不覆盖实现的话路由参数一级永远测不到。
 */
function withRouteParams(options?: Record<string, unknown>): void {
  vi.mocked(uniApp.onLoad).mockImplementation(((cb: (o?: Record<string, unknown>) => void) => {
    cb(options)
  }) as never)
}

/** `uni.getLaunchOptionsSync()`：模拟 App 启动参数（scheme / 推送唤起）。 */
function withLaunchQuery(query: Record<string, string> | undefined): void {
  ;(uni as unknown as Record<string, unknown>).getLaunchOptionsSync =
    vi.fn(() => (query ? { query } : {}))
}

/** 「最后兜底」那一级的可辨识真值。 */
const STORE_TASK: Record<string, unknown> = {
  id: 'task_store', type: 'cpr', title: 'T', description: '', address: '',
  distance: 0, lat: 0, lng: 0, volunteersNeeded: 1, volunteersResponded: 0,
  volunteersEnRoute: 0, status: 'active', createdAt: '', sceneType: 'outdoor',
}

/** 让 `ts.tasks` 稳定等于 `[STORE_TASK]`（先落夹具，再 `refresh()`，避免被自动 refresh 覆盖）。 */
async function withStoreTask(): Promise<ReturnType<typeof useTaskStore>> {
  taskListFixture.current = [{ ...STORE_TASK }]
  const store = useTaskStore()
  await store.refresh()
  await flushPromises()
  return store
}

async function mountWith(params: { route?: Record<string, unknown>; launch?: Record<string, string> }) {
  await readyUser()
  vi.mocked(uniApp.onLoad).mockClear()
  withRouteParams(params.route)
  withLaunchQuery(params.launch)
  await withStoreTask()
  const page = await import('@/pages/rescue/task-detail.vue')
  const wrapper = mount(page.default)
  await flushPromises()
  return wrapper
}

describe('P0-2 前端收口 · 调用点守卫（401/403 不再静默 / 不再假成功）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setLocale('zh-CN')
    vi.clearAllMocks()
    profileFixture.current = { ...LOGGED }
    // ★ 真 token：所有断言「请求带了 Authorization」的用例都依赖它。
    vi.mocked(uni.getStorageSync).mockImplementation(((k: string) =>
      (k === 'jwt_token' ? REAL_JWT : '')) as never)
    vi.mocked(request).mockResolvedValue(null)
    vi.mocked(requestFull).mockResolvedValue(OK())
  })

  afterEach(() => {
    setLocale('zh-CN')
    vi.unstubAllGlobals()
  })

  // =========================================================================
  // A. pages/community —— 裸 fetch（401）+ 无条件成功提示
  // =========================================================================
  describe('community/index：加群 / 私信 / 列表', () => {
    async function mountCommunity(withNearby = true) {
      await readyUser()
      vi.mocked(requestFull).mockImplementation((async (opts: { url?: string }) => {
        if (opts.url?.startsWith('/community/nearby')) {
          return OK(withNearby ? [{ userId: 'u2', userName: '远端志愿者', tier: 'gold', rescueCount: 3 }] : [])
        }
        if (opts.url === '/community/groups') {
          return OK([{ id: 'g1', name: '深圳湾急救群', description: 'd', memberCount: 3 }])
        }
        return OK()
      }) as never)
      const page = await import('@/pages/community/index.vue')
      const wrapper = mount(page.default)
      await flushPromises()
      return wrapper
    }

    /** 切到「群组」tab 并等列表渲染（原 L8 的 tab 点击会触发 `loadGroups`）。 */
    async function openGroupsTab(wrapper: ReturnType<typeof mount>): Promise<void> {
      const tabs = wrapper.findAll('.comm-tab')
      await tabs[1].trigger('click')
      await flushPromises()
      expect(wrapper.findAll('.comm-item').length).toBe(1)
    }

    it('★ 加群被 403 ⇒ 弹权限提示且**不**弹「已加入」（原：裸 fetch + 无条件已加入）', async () => {
      const wrapper = await mountCommunity()
      await openGroupsTab(wrapper)
      mockModalConfirm('')
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await wrapper.find('.comm-item').trigger('click')
      await flushPromises()

      // 必须走 `requestFull`（带 token）；裸 fetch 是本次要根除的写法
      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/community/groups/g1/join', method: 'POST' }),
      )
      const titles = toastTitles()
      expect(titles).toContain(gt('common.noPermission'))
      expect(titles).not.toContain('已加入')
      wrapper.unmount()
    })

    it('★ 加群请求体**不含** userId（后端已改为 token 派生，留着是死字段）', async () => {
      const wrapper = await mountCommunity()
      await openGroupsTab(wrapper)
      mockModalConfirm('')
      vi.mocked(requestFull).mockResolvedValue(OK({ id: 'm1' }))

      await wrapper.find('.comm-item').trigger('click')
      await flushPromises()

      const call = vi.mocked(requestFull).mock.calls.at(-1)?.[0] as { data?: Record<string, unknown> }
      expect(call.data).toBeDefined()
      expect(Object.keys(call.data ?? {})).not.toContain('userId')
      expect(toastTitles()).toContain('已加入')
      wrapper.unmount()
    })

    it('★ 发私信被 403 ⇒ 弹权限提示且**不**弹「已发送」', async () => {
      const wrapper = await mountCommunity()
      expect(wrapper.findAll('.comm-item').length).toBe(1)
      mockModalConfirm('你好，我是志愿者')
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await wrapper.find('.comm-item').trigger('click')
      await flushPromises()

      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/community/messages', method: 'POST',
          data: expect.objectContaining({ toUserId: 'u2', content: '你好，我是志愿者' }),
        }),
      )
      const titles = toastTitles()
      expect(titles).toContain(gt('common.noPermission'))
      expect(titles).not.toContain('已发送')
      wrapper.unmount()
    })

    it('★ 读列表失败 ⇒ 有可见反馈（不得静默成"附近没人"）', async () => {
      await readyUser()
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)
      const page = await import('@/pages/community/index.vue')
      const wrapper = mount(page.default)
      await flushPromises()

      // 401/403 不再被 `catch{}` 吞掉：必须有提示，且列表为空而不是"看起来没人"
      expect(toastTitles()).toContain(gt('common.noPermission'))
      expect((wrapper.vm as unknown as PageVM).nearby).toEqual([])
      wrapper.unmount()
    })
  })

  // =========================================================================
  // B. pages/video —— 上传无 token / 发布假成功 / 乐观自增 / 假评论
  // =========================================================================
  describe('video/index：上传 / 发布 / 点赞 / 评论', () => {
    async function mountVideo() {
      await readyUser()
      vi.mocked(request).mockResolvedValue({ items: [], hasMore: false })
      ;(uni as unknown as Record<string, unknown>).chooseVideo =
        vi.fn((opts: any) => { opts?.success?.({ tempFilePath: '/tmp/a.mp4', duration: 12, size: 2048 }) })
      const page = await import('@/pages/video/index.vue')
      const wrapper = mount(page.default)
      await flushPromises()
      return wrapper
    }

    /** 通过 UI 走完「选视频 → 填标题」，停在点发布之前。 */
    async function fillPublishForm(wrapper: ReturnType<typeof mount>): Promise<void> {
      await wrapper.find('.fab').trigger('click')
      await flushPromises()
      await wrapper.find('.pick-area').trigger('click')
      await flushPromises()
      const inputs = wrapper.findAll('.mi')
      await inputs[0].setValue('现场急救视频')
      await inputs[1].setValue('描述')
      await flushPromises()
    }

    it('★ 上传必须带 Authorization 头（uni.uploadFile 不复用 api 层 header）', async () => {
      const wrapper = await mountVideo()
      await fillPublishForm(wrapper)
      let captured: Record<string, any> | null = null
      vi.mocked(uni.uploadFile).mockImplementation(((opts: any) => {
        captured = opts
        opts?.success?.({ data: JSON.stringify(OK({ videoUrl: 'u', thumbnail: 't', duration: '0:12' })) })
        return { onProgressUpdate: vi.fn() }
      }) as never)
      vi.mocked(requestFull).mockResolvedValue(OK({ id: 'v1' }))

      await wrapper.find('.btn').trigger('click')
      await flushPromises()

      expect(captured).not.toBeNull()
      const header = (captured as Record<string, any>).header as Record<string, string> | undefined
      expect(header).toBeDefined()
      expect(header?.Authorization).toBe(`Bearer ${REAL_JWT}`)
      wrapper.unmount()
    })

    it('★ 发布被 403 ⇒ **不**弹「已发布」、弹权限提示、**保留**弹窗与用户输入', async () => {
      const wrapper = await mountVideo()
      await fillPublishForm(wrapper)
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await wrapper.find('.btn').trigger('click')
      await flushPromises()

      const titles = toastTitles()
      expect(titles).toContain(gt('common.noPermission'))
      expect(titles).not.toContain('已发布')
      // 弹窗没被 `cancelPub()` 关掉 ⇒ 用户的选择与标题还在
      expect(wrapper.find('.modal').exists()).toBe(true)
      expect((wrapper.vm as unknown as PageVM).pubTitle).toBe('现场急救视频')
      expect((wrapper.vm as unknown as PageVM).pubDesc).toBe('描述')
      wrapper.unmount()
    })

    it('发布成功 ⇒ 弹「已发布」、关闭弹窗并刷新列表', async () => {
      const wrapper = await mountVideo()
      await fillPublishForm(wrapper)
      vi.mocked(requestFull).mockResolvedValue(OK({ id: 'v1' }))

      await wrapper.find('.btn').trigger('click')
      await flushPromises()

      expect(toastTitles()).toContain('已发布')
      expect(wrapper.find('.modal').exists()).toBe(false)
      wrapper.unmount()
    })

    it('★ 点赞被 403 ⇒ 弹权限提示，且**不**乐观自增（不伪造 liked）', async () => {
      const wrapper = await mountVideo()
      const vm = wrapper.vm as unknown as PageVM
      vm.videos = [{ id: 'v1', likeCount: 3, viewCount: 1 }]
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await vm.doLike(vm.videos[0])
      await flushPromises()

      expect(toastTitles()).toContain(gt('common.noPermission'))
      expect(vm.videos[0].likeCount).toBe(3)
      expect(vm.videos[0].liked).toBeFalsy()
      wrapper.unmount()
    })

    it('★ 评论被 403 ⇒ 弹权限提示、**保留**输入、**不**插入本地假评论', async () => {
      const wrapper = await mountVideo()
      const vm = wrapper.vm as unknown as PageVM
      vm.videos = [{ id: 'v1', commentCount: 2 }]
      vm.fsIndex = 0
      vm.cmtText = '这条评论不该凭空出现'
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await vm.submitComment()
      await flushPromises()

      expect(toastTitles()).toContain(gt('common.noPermission'))
      expect(vm.cmtText).toBe('这条评论不该凭空出现')
      expect(vm.cmts).toEqual([])
      expect(vm.videos[0].commentCount).toBe(2)
      wrapper.unmount()
    })

    it('★ 观看计数失败 ⇒ 不本地自增（埋点失败不伪造数字，也不打扰用户）', async () => {
      const wrapper = await mountVideo()
      const vm = wrapper.vm as unknown as PageVM
      vm.videos = [{ id: 'v1', viewCount: 7 }]
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await vm.recordView(vm.videos[0])
      await flushPromises()

      expect(vm.videos[0].viewCount).toBe(7)
      wrapper.unmount()
    })

    it('★ P1-4：已赞后再次 doLike ⇒ 不重复乐观自增（后端幂等，前端须同步）', async () => {
      const wrapper = await mountVideo()
      const vm = wrapper.vm as unknown as PageVM
      vm.videos = [{ id: 'v1', likeCount: 3, viewCount: 1, liked: true }]
      vi.mocked(requestFull).mockResolvedValue(OK(null))

      await vm.doLike(vm.videos[0])
      await flushPromises()

      expect(vm.videos[0].likeCount).toBe(3)   // ★ 不 +1
      expect(vm.videos[0].liked).toBe(true)
      expect(vi.mocked(requestFull)).not.toHaveBeenCalled()  // 已赞 ⇒ 不发请求
      wrapper.unmount()
    })

    it('★ P1-4：已观看后再次 recordView ⇒ 不重复乐观自增（后端幂等）', async () => {
      const wrapper = await mountVideo()
      const vm = wrapper.vm as unknown as PageVM
      vm.videos = [{ id: 'v1', viewCount: 7, viewed: true }]
      vi.mocked(requestFull).mockResolvedValue(OK(null))

      await vm.recordView(vm.videos[0])
      await flushPromises()

      expect(vm.videos[0].viewCount).toBe(7)   // ★ 不 +1
      expect(vi.mocked(requestFull)).not.toHaveBeenCalled()
      wrapper.unmount()
    })
  })

  // =========================================================================
  // C. pages/rescue/task-detail —— 最集中的一处（渲染期 TypeError / 状态永久错乱）
  // =========================================================================
  describe('rescue/task-detail：现场更新 / 直播', () => {
    async function mountTaskDetail() {
      await readyUser()
      const page = await import('@/pages/rescue/task-detail.vue')
      const wrapper = mount(page.default)
      await flushPromises()
      return wrapper
    }

    it('★ GET media 403 ⇒ mediaList 是 `[]`（不是 undefined ⇒ 不触发渲染期 TypeError）', async () => {
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)
      const wrapper = await mountTaskDetail()

      const vm = wrapper.vm as unknown as PageVM
      expect(Array.isArray(vm.mediaList)).toBe(true)
      expect(vm.mediaList).toEqual([])
      // 模板 `mediaList.length===0` 能正常求值 ⇒ 空态渲染出来（未崩）
      expect(wrapper.find('.empty').exists()).toBe(true)
      wrapper.unmount()
    })

    it('★ GET media 403 ⇒ 空态给「仅参与者可见」的**说明文案**（不是"暂无现场更新"）', async () => {
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)
      const wrapper = await mountTaskDetail()

      // 403 是**正常的权限状态**，不是故障：必须告诉用户"谁能看"
      expect(wrapper.find('.empty').text()).toBe(gt('permission.taskParticipant.readMedia'))
      expect(gt('permission.taskParticipant.readMedia')).toBe('仅参与该任务的志愿者可查看现场更新')
      wrapper.unmount()
    })

    it('★ GET live 403 ⇒ liveCount 为 0 且不抛错（原 `r.length` 被 catch 吞 ⇒ 恒 0）', async () => {
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)
      const wrapper = await mountTaskDetail()

      expect((wrapper.vm as unknown as PageVM).liveCount).toBe(0)
      expect(wrapper.find('.live-indicator').exists()).toBe(false)
      wrapper.unmount()
    })

    it('★ 发现场更新被 403 ⇒ 弹「仅参与者可发布」、**保留**输入框内容', async () => {
      const wrapper = await mountTaskDetail()
      const vm = wrapper.vm as unknown as PageVM
      vm.taskId = 'task_1'
      vm.msg = '已到达现场，患者意识恢复'
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await vm.send()
      await flushPromises()

      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/rescue/mobilizations/task_1/media', method: 'POST',
          data: expect.objectContaining({ content: '已到达现场，患者意识恢复' }),
        }),
      )
      expect(toastTitles()).toContain(gt('permission.taskParticipant.writeMedia'))
      // ★ 失败**不得**清空输入：救援现场丢一条更新不可接受
      expect(vm.msg).toBe('已到达现场，患者意识恢复')
      wrapper.unmount()
    })

    it('发现场更新成功 ⇒ 清空输入并刷新列表', async () => {
      const wrapper = await mountTaskDetail()
      const vm = wrapper.vm as unknown as PageVM
      vm.taskId = 'task_1'
      vm.msg = '已到达现场'
      vi.mocked(requestFull).mockResolvedValue(OK([{ id: 'm1' }]))

      await vm.send()
      await flushPromises()

      expect(vm.msg).toBe('')
      wrapper.unmount()
    })

    it('★ 开直播被 403 ⇒ **不改** isLive（不得停在"⏹ 结束"），并弹权限说明', async () => {
      const wrapper = await mountTaskDetail()
      const vm = wrapper.vm as unknown as PageVM
      vm.taskId = 'task_1'
      vm.isLive = false
      vm.liveId = ''
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await vm.toggleLive()
      await flushPromises()

      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/rescue/live/task_1/start', method: 'POST' }),
      )
      expect(toastTitles()).toContain(gt('permission.taskParticipant.live'))
      // ★ 先判 code 再改 UI：原写法 `isLive=true; liveId=r.id` 会抛 TypeError 且 UI 已乐观置 true
      expect(vm.isLive).toBe(false)
      expect(vm.liveId).toBe('')
      wrapper.unmount()
    })

    it('开直播成功 ⇒ 置 isLive 并记录 liveId', async () => {
      const wrapper = await mountTaskDetail()
      const vm = wrapper.vm as unknown as PageVM
      vm.taskId = 'task_1'
      vm.isLive = false
      vi.mocked(requestFull).mockResolvedValue(OK({ id: 'live_1' }))

      await vm.toggleLive()
      await flushPromises()

      expect(vm.isLive).toBe(true)
      expect(vm.liveId).toBe('live_1')
      wrapper.unmount()
    })

    it('★ 结束直播被 403 ⇒ 状态**保持**在直播中（服务端会话还在，不得假装已结束）', async () => {
      const wrapper = await mountTaskDetail()
      const vm = wrapper.vm as unknown as PageVM
      vm.isLive = true
      vm.liveId = 'live_1'
      vi.mocked(requestFull).mockResolvedValue(FORBIDDEN)

      await vm.toggleLive()
      await flushPromises()

      expect(toastTitles()).toContain(gt('permission.taskParticipant.live'))
      expect(vm.isLive).toBe(true)
      expect(vm.liveId).toBe('live_1')
      wrapper.unmount()
    })
  })

  // =========================================================================
  // E. pages/rescue/task-detail —— 路由参数解析（P0-2 追加：丢了 navigateTo 的 ?id=）
  //
  // 背景：`uni.getLaunchOptionsSync()` 返回的是 **App 启动参数**（scheme / 推送唤起），
  // **不是** `uni.navigateTo({url:'...?id=tid'})` 的路由参数；后者走页面的 `onLoad(options)`。
  // 唯一的跳转来源 `pages/home/index.vue:408` 用的正是 `navigateTo` ⇒ `id` 原先被**静默丢弃**，
  // 页面永远显示 `ts.tasks[0]`（别人接的任务）。叠加「仅参与者可见」后 ⇒ 莫名其妙的 403。
  // =========================================================================
  describe('rescue/task-detail：taskId 三级回退（路由 > 启动参数 > store）', () => {
    it('★ 路由参数优先：navigateTo 的 ?id= 必须胜出（启动参数与 store 都不同值）', async () => {
      const wrapper = await mountWith({ route: { id: 'task_route' }, launch: { id: 'task_launch' } })

      expect((wrapper.vm as unknown as PageVM).taskId).toBe('task_route')
      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/rescue/mobilizations/task_route/media' }),
      )
      wrapper.unmount()
    })

    it('★ 无路由参数 ⇒ 回落到 App 启动参数（scheme / 推送唤起场景不能丢）', async () => {
      const wrapper = await mountWith({ launch: { id: 'task_launch' } })

      expect((wrapper.vm as unknown as PageVM).taskId).toBe('task_launch')
      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/rescue/mobilizations/task_launch/media' }),
      )
      wrapper.unmount()
    })

    it('★ 两者都无 ⇒ 兜底 `ts.tasks[0]`（原逻辑不得被改坏）', async () => {
      const wrapper = await mountWith({})

      expect((wrapper.vm as unknown as PageVM).taskId).toBe('task_store')
      expect(vi.mocked(requestFull)).toHaveBeenCalledWith(
        expect.objectContaining({ url: '/rescue/mobilizations/task_store/media' }),
      )
      wrapper.unmount()
    })

    it('★ 进入详情页**不得**自动接受任务（/task/accept 非幂等：每次 volunteers_responded +1）', async () => {
      const store = await withStoreTask()
      const acceptMission = vi.spyOn(store, 'acceptMission')
      vi.mocked(acceptTaskApi).mockClear()
      const wrapper = await mountWith({ route: { id: 'task_route' } })

      // 进入详情页只是**读**：绝不能顺手 `/task/accept`（否则每进一次 +1，且资格语义也不对）
      expect(acceptMission).not.toHaveBeenCalled()
      expect(vi.mocked(acceptTaskApi)).not.toHaveBeenCalled()
      expect(vi.mocked(uni.navigateTo)).not.toHaveBeenCalled()
      expect(toastTitles()).toEqual([])
      wrapper.unmount()
    })
  })

  // =========================================================================
  // F. pages/rescue/task-detail —— 「接受任务」入口（用户拍板新增的产品入口）
  //
  // 三个硬性约束，每条都有对应用例 + 突变：
  // 1. 只在**确认非参与者**时出现（`GET media` 403）⇒ 参与者看不到；
  // 2. **只能显式点击**（一次性标志位防连点）—— `/task/accept` 非幂等（每次 +1）；
  // 3. 必须用**本页 taskId** 调 `reportAccept()`，**不能用** `acceptMission()`
  //    （后者取 `store.activeTask`，与首页轮播传来的 taskId **不必相等** ⇒ 接错任务 / 静默无动作）；
  // 4. `reportAccept()` 吞异常 ⇒ 必须**重拉 media/live 复验**，不能"没报错就算成功"。
  // =========================================================================
  describe('rescue/task-detail：接受任务入口（显式点击 + 用本页 taskId）', () => {
    const MEDIA_ITEM = { id: 'm1', userName: '先行者', type: 'text', content: '已到达现场' }
    /** 关键夹具：**store 的 activeTask ≠ 详情页的 taskId**（首页轮播是公开任务池）。 */
    const ACTIVE_TASK_ID = 'task_active'

    interface MountOpts {
      /** 点击后服务端是否真的给了参与者身份（默认：给了）。 */
      grantParticipation?: boolean
      /** 是否把 `store.activeTask` 设成**另一条**任务（用于 N2「接错任务」突变）。 */
      withDifferentActiveTask?: boolean
    }

    async function mountNonParticipant(opts: MountOpts = {}) {
      const grant = opts.grantParticipation !== false
      await readyUser()
      vi.mocked(uniApp.onLoad).mockClear()
      withRouteParams({ id: 'task_route' })
      withLaunchQuery(undefined)
      const store = await withStoreTask()
      if (opts.withDifferentActiveTask) {
        store.activeTask = { ...STORE_TASK, id: ACTIVE_TASK_ID } as never
      }
      let accepted = false
      vi.mocked(requestFull).mockImplementation((async (o: { url?: string }) => {
        // 接受之前：media / live 一律 403（非参与者）；接受之后恢复正常
        if (o.url?.includes('/media') || o.url?.includes('/live/')) {
          return accepted ? OK([{ ...MEDIA_ITEM }]) : FORBIDDEN
        }
        return OK()
      }) as never)
      vi.mocked(acceptTaskApi).mockClear()
      vi.mocked(acceptTaskApi).mockImplementation((async () => { accepted = grant }) as never)

      const page = await import('@/pages/rescue/task-detail.vue')
      const wrapper = mount(page.default)
      await flushPromises()
      return wrapper
    }

    it('★ 非参与者（media 403）⇒ 显示「接受任务」入口', async () => {
      const wrapper = await mountNonParticipant()

      expect(wrapper.find('.accept-btn').exists()).toBe(true)
      expect(wrapper.find('.accept-hint').text()).toBe(gt('permission.taskParticipant.accept.hint'))
      expect(wrapper.find('.accept-btn').text()).toBe(gt('permission.taskParticipant.accept.cta'))
      wrapper.unmount()
    })

    it('★ 参与者（media 200）⇒ **不**显示「接受任务」入口', async () => {
      await readyUser()
      withRouteParams({ id: 'task_route' })
      withLaunchQuery(undefined)
      await withStoreTask()
      vi.mocked(requestFull).mockResolvedValue(OK([{ ...MEDIA_ITEM }]))
      vi.mocked(acceptTaskApi).mockClear()
      const page = await import('@/pages/rescue/task-detail.vue')
      const wrapper = mount(page.default)
      await flushPromises()

      expect(wrapper.find('.accept-btn').exists()).toBe(false)
      expect(vi.mocked(acceptTaskApi)).not.toHaveBeenCalled()
      wrapper.unmount()
    })

    it('★★ 接受任务必须用**本页 taskId**（store.activeTask 是另一条任务 ⇒ 不得接错）', async () => {
      const wrapper = await mountNonParticipant({ withDifferentActiveTask: true })
      expect((wrapper.vm as unknown as PageVM).taskId).toBe('task_route')

      await wrapper.find('.accept-btn').trigger('click')
      await flushPromises()

      const args = vi.mocked(acceptTaskApi).mock.calls
      expect(args.length).toBeGreaterThan(0)
      expect(args[0][0]).toBe('task_route')
      // ★ 绝不能出现 `acceptMission()` 的行为：拿 activeTask 去接 ⇒ 接了别的任务
      for (const call of args) expect(call[0]).not.toBe(ACTIVE_TASK_ID)
      wrapper.unmount()
    })

    it('★ 接单成功 ⇒ 重拉 media/live 验证资格，按钮消失、列表可读', async () => {
      const wrapper = await mountNonParticipant()
      await wrapper.find('.accept-btn').trigger('click')
      await flushPromises()

      const mediaCalls = vi.mocked(requestFull).mock.calls
        .filter((c) => (c[0] as { url?: string }).url?.includes('/media'))
      // 进一次 + 接单后复验一次 ⇒ 至少 2 次（★ 没有这次复验就无法确认服务端真的给了资格）
      expect(mediaCalls.length).toBeGreaterThanOrEqual(2)
      expect((wrapper.vm as unknown as PageVM).mediaList).toEqual([MEDIA_ITEM])
      expect((wrapper.vm as unknown as PageVM).mediaForbidden).toBe(false)
      expect(wrapper.find('.accept-btn').exists()).toBe(false)
      expect(toastTitles()).toContain(gt('permission.taskParticipant.accept.ok'))
      wrapper.unmount()
    })

    it('★ 服务端没给资格（仍 403）⇒ 明确提示「接单失败」且按钮可重试（不静默）', async () => {
      const wrapper = await mountNonParticipant({ grantParticipation: false })

      await wrapper.find('.accept-btn').trigger('click')
      await flushPromises()

      expect(toastTitles()).toContain(gt('permission.taskParticipant.accept.failed'))
      expect((wrapper.vm as unknown as PageVM).mediaForbidden).toBe(true)
      // 不能消失（否则用户没有任何重试路径）
      expect(wrapper.find('.accept-btn').exists()).toBe(true)
      wrapper.unmount()
    })

    it('★ 连点只算一次（/task/accept 非幂等：每次 volunteers_responded +1）', async () => {
      const wrapper = await mountNonParticipant()
      const vm = wrapper.vm as unknown as PageVM

      vm.acceptTask()
      await vm.acceptTask()
      await flushPromises()

      expect(vi.mocked(acceptTaskApi)).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    })
  })

  // =========================================================================
  // D. 403 语义：判定与双语文案
  // =========================================================================
  describe('403 语义（参与者作用域）', () => {
    it('isForbidden：认 HTTP 403 / 业务码 403，不认其它', () => {
      expect(isForbidden(FORBIDDEN)).toBe(true)
      expect(isForbidden({ code: 403, message: '' })).toBe(true)
      expect(isForbidden(OK())).toBe(false)
      expect(isForbidden(null)).toBe(false)
    })

    it('★ 参与者作用域文案在 en-US 下也是英文（不是中文硬编码）', () => {
      setLocale('en-US')
      expect(gt('permission.taskParticipant.readMedia')).toBe(
        'Only volunteers taking part in this task can view live updates',
      )
      expect(gt('permission.taskParticipant.writeMedia')).toBe(
        'Only volunteers taking part in this task can post live updates',
      )
      expect(gt('permission.taskParticipant.live')).toBe(
        'Only volunteers taking part in this task can start or end the live stream',
      )
    })
  })
})

/**
 * 突变记录（对应用例必须变红；每次都 `cp` 备份 + `shasum -a 256 -c` 字节级还原）：
 * - M1 `community/index.vue` 把 join 改回「裸 fetch + 无条件 showToast('已加入')」
 *     ⇒ 「403 不弹已加入」红，且 `requestFull` 调用断言红。
 * - M2 `community/index.vue` 把 `sendMessage` 改回无条件 '已发送'
 *     ⇒ 「私信 403 不弹已发送」红。
 * - M3 `community/index.vue` 把 `loadNearby` 改回裸 fetch + `catch{}`
 *     ⇒ 「读列表失败有可见反馈」红。
 * - M4 `video/index.vue` 去掉 `publish()` 里 `uni.uploadFile` 的 `header`
 *     ⇒ 「上传必须带 Authorization 头」红。
 * - M5 `video/index.vue` 把发布改回「无条件 '已发布' + cancelPub()」
 *     ⇒ 「403 不弹已发布 / 保留弹窗与输入」红。
 * - M6 `video/index.vue` 把 `doLike` 改回乐观自增 ⇒ 「不乐观自增」红。
 * - M7 `video/index.vue` 把 `submitComment` 改回「先清空 + 插入 tmp 评论」
 *     ⇒ 「保留输入 / 不插入假评论」红。
 * - M8 `task-detail.vue` 把 `loadMedia` 改回 `mediaList = await request(...)`
 *     ⇒ 「mediaList 是 []」红（request 的桩返回 null / requestFull 403 返回 undefined）。
 * - M9 `task-detail.vue` 把 `send` 改回「无条件清空 msg」⇒ 「保留输入」红。
 * - M10 `task-detail.vue` 把 live start 改回「先 `isLive=true` 再取 `r.id`」
 *     ⇒ 「403 不改 isLive」红（且 `r.id` 会抛 TypeError）。
 * - M11 `utils/action-feedback.ts` 忽略 `options.forbiddenMessage`
 *     ⇒ 三处「仅参与者」文案断言红（退化成通用"无权执行此操作"）。
 */
