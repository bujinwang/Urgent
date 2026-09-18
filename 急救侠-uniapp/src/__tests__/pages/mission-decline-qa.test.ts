import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

/**
 * mission 页「退出动作」的 **QA 独立**调用点验证（★ v1.2 §11.5）。
 *
 * 实现方的 `mission-callpoints.test.ts` 覆盖了 arrived→/complete 与 running→/abandon；
 * 本文件**另起攻击面**：`index.vue` 的「无法前往 / 拒绝」必须**一个写请求都不发**（§11.5 第 5 行），
 * 并独立复验 arrived 页退出后 store 被复位（顺序 + 重置组合）。
 */

const stubTask = {
  id: 'task_001', type: 'cpr' as const, title: 'x', description: '', address: '深圳湾公园南门',
  distance: 100, lat: 22.517, lng: 113.947, volunteersNeeded: 3, volunteersResponded: 3,
  volunteersEnRoute: 0, status: 'active' as const, createdAt: '2026-01-01T00:00:00.000Z', sceneType: '',
}

vi.mock('@/api/task', () => ({
  fetchActiveTask: vi.fn(() => Promise.resolve(stubTask)),
  fetchTaskList: vi.fn(() => Promise.resolve([stubTask])),
  acceptTaskApi: vi.fn(() => Promise.resolve({})),
  arriveTaskApi: vi.fn(() => Promise.resolve({})),
  completeTaskApi: vi.fn(() => Promise.resolve({})),
  abandonTaskApi: vi.fn(() => Promise.resolve({})),
  mapRescueTask: (r: unknown) => r,
}))

vi.mock('@/utils/voice', () => ({
  voice: { speak: vi.fn(), stop: vi.fn(), speakSequence: vi.fn() },
}))

import { acceptTaskApi, arriveTaskApi, completeTaskApi, abandonTaskApi } from '@/api/task'
import { useTaskStore } from '@/stores/task'

/** 冲掉微任务链（`void reportX()` 的 await 链）。⚠️ 不能用 `setTimeout` —— 假定时器会把它冻住。 */
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

describe('mission 页退出的 QA 独立调用点验证（★ v1.2 §11.5）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

  it('QA-F1：index 页「无法前往」⇒ 不发任何任务写请求（拒绝者从未报名，§11.5）', async () => {
    const store = useTaskStore()
    store.activeTask = { ...stubTask }
    const page = await import('@/pages/mission/index.vue')
    const wrapper = shallowMount(page.default)

    vi.mocked(acceptTaskApi).mockClear()
    vi.mocked(arriveTaskApi).mockClear()
    vi.mocked(completeTaskApi).mockClear()
    vi.mocked(abandonTaskApi).mockClear()

    await wrapper.find('.mission-btn-decline').trigger('click')
    await flush()

    expect(vi.mocked(acceptTaskApi)).not.toHaveBeenCalled()
    expect(vi.mocked(arriveTaskApi)).not.toHaveBeenCalled()
    expect(vi.mocked(completeTaskApi)).not.toHaveBeenCalled()
    expect(vi.mocked(abandonTaskApi)).not.toHaveBeenCalled()
    // 本地重置仍须发生（拒绝 = 退出，但目标是"什么都不上报"）
    expect(store.activeTask).toBeNull()
    expect(store.missionPhase).toBe('idle')
    wrapper.unmount()
  })

  it('QA-F2：arrived 页「结束服务并返回」⇒ 调 /complete 且随后复位 store（顺序+重置）', async () => {
    const store = useTaskStore()
    store.activeTask = { ...stubTask }
    const page = await import('@/pages/mission/arrived.vue')
    const wrapper = mount(page.default)

    await wrapper.find('.arrived-btn-secondary').trigger('click')
    await flush()

    expect(vi.mocked(completeTaskApi)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(completeTaskApi)).toHaveBeenCalledWith('task_001')
    expect(vi.mocked(abandonTaskApi)).not.toHaveBeenCalled()
    expect(store.activeTask).toBeNull()
    expect(store.missionPhase).toBe('idle')
    wrapper.unmount()
  })
})
