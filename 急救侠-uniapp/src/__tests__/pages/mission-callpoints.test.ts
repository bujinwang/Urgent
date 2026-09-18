import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

/**
 * mission 页「退出动作」的**调用点守卫**（★ v1.2 §11.5 / §8 T30）。
 *
 * 为什么必须从页面走：store / api 层的不变式测得再全，也覆盖不了「页面是否真的调用了它」。
 * v1.0 的缺陷正是**页面退出动作被错误地映射到 `/complete`**（`finishMission()` 一把抓三种退出语义）。
 * 本文件钉死 v1.2 的映射：arrived 页退出 ⇒ `/complete`（结束）；running 页放弃 ⇒ `/abandon`（作废）。
 * 删掉页面里对应那一行调用 ⇒ 对应用例必须变红。
 */

/** 任务桩（store 自动拉取也用它，保证 activeTask.id === 'task_001'）。 */
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

// 语音与页面逻辑无关；mock 掉以免真实的语音定时器/合成器在本用例里产生副作用。
vi.mock('@/utils/voice', () => ({
  voice: { speak: vi.fn(), stop: vi.fn(), speakSequence: vi.fn() },
}))

import { completeTaskApi, abandonTaskApi } from '@/api/task'
import { useTaskStore } from '@/stores/task'

describe('mission 页退出动作的调用点（★ v1.2 T30）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // running 页 onMounted 里有一个未清句柄的 `setTimeout`：用假定时器消除跨用例定时器泄漏
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

  it('★ T30：arrived 页「结束服务并返回」⇒ 调 completeTaskApi(/task/complete)，且不得调 /abandon', async () => {
    const store = useTaskStore()
    store.activeTask = { ...stubTask } // 确保取到 taskId（不依赖微任务时序）
    const page = await import('@/pages/mission/arrived.vue')
    const wrapper = mount(page.default)

    await wrapper.find('.arrived-btn-secondary').trigger('click')

    expect(vi.mocked(completeTaskApi)).toHaveBeenCalledWith('task_001')
    expect(vi.mocked(abandonTaskApi)).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('★ T30：running 页「放弃任务」⇒ 调 abandonTaskApi(/task/abandon)，且不得调 /complete', async () => {
    const store = useTaskStore()
    store.activeTask = { ...stubTask }
    const page = await import('@/pages/mission/running.vue')
    const wrapper = mount(page.default)

    await wrapper.find('.running-btn-cancel').trigger('click')

    expect(vi.mocked(abandonTaskApi)).toHaveBeenCalledWith('task_001')
    expect(vi.mocked(completeTaskApi)).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('文案核对：arrived 页退出按钮文案为「结束服务并返回」（v1.2 语义明确化）', async () => {
    const store = useTaskStore()
    store.activeTask = { ...stubTask }
    const page = await import('@/pages/mission/arrived.vue')
    const wrapper = mount(page.default)
    expect(wrapper.find('.arrived-btn-secondary').text()).toContain('结束服务并返回')
    wrapper.unmount()
  })
})
