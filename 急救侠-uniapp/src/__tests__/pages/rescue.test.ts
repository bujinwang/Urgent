import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

/**
 * F3 埋点的**调用点**守护（设计文档 §5.3）。
 *
 * 为什么单独测这个：`api/sos.ts` 自身的不变式已由 `api/sos.test.ts` 覆盖，但
 * **页面是否真的调用了它**无人守。实测突变：删掉 `startCpr()` 里那一行
 * `void reportSosEvent(...)`，全部 213 个用例仍全绿 —— 功能静默失效（SURVIVED）。
 * 本文件从界面走完整流程补上这一环。
 */
vi.mock('@/api/sos', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/sos')>()
  return { ...actual, reportSosEvent: vi.fn(() => Promise.resolve()) }
})

import { reportSosEvent } from '@/api/sos'

const mockReport = vi.mocked(reportSosEvent)

/** 装载页面并打开确认弹层、勾选免责声明（真实走 `.sos-button` → `.confirm-check`）。 */
async function readyToConfirm() {
  const page = await import('@/pages/rescue/index.vue')
  const wrapper = mount(page.default)
  await wrapper.find('.sos-button').trigger('click')    // showConfirm()
  await wrapper.find('.confirm-check').trigger('click') // confirmed = true
  return wrapper
}

describe('rescue 页：SOS 埋点的调用点', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockReport.mockReset()
    mockReport.mockResolvedValue(undefined)
  })

  it('★ 确认启动 CPR ⇒ 恰好上报一次，带 sos_ 前缀幂等键且 isDrill=false', async () => {
    const wrapper = await readyToConfirm()
    await wrapper.find('.confirm-btn').trigger('click')
    await flushPromises()

    expect(mockReport).toHaveBeenCalledTimes(1)
    const arg = mockReport.mock.calls[0][0]
    expect(arg.isDrill).toBe(false)
    expect(arg.clientEventId).toMatch(/^sos_/)
    wrapper.unmount()
  })

  it('★ 未勾选免责声明 ⇒ 不上报（留痕不得绕过二次确认）', async () => {
    const page = await import('@/pages/rescue/index.vue')
    const wrapper = mount(page.default)
    await wrapper.find('.sos-button').trigger('click')
    await wrapper.find('.confirm-btn').trigger('click') // 未勾选 ⇒ startCpr 提前 return
    await flushPromises()

    expect(mockReport).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('★ 上报挂起（永不 settle）时流程仍推进 ⇒ 证明调用方没有 await 埋点', async () => {
    mockReport.mockReturnValueOnce(new Promise<void>(() => {}) as Promise<void>)
    const wrapper = await readyToConfirm()
    await wrapper.find('.confirm-btn').trigger('click')
    await flushPromises()

    // 决策页已卸载 ⇒ 流程确实推进到了 cpr 阶段，没有被挂起的上报卡住
    expect(wrapper.find('.sos-button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('两次触发各生成不同幂等键（不复用会话级 id）', async () => {
    const first = await readyToConfirm()
    await first.find('.confirm-btn').trigger('click')
    await flushPromises()
    first.unmount()

    const second = await readyToConfirm()
    await second.find('.confirm-btn').trigger('click')
    await flushPromises()
    second.unmount()

    expect(mockReport).toHaveBeenCalledTimes(2)
    const [a, b] = mockReport.mock.calls.map(c => c[0].clientEventId)
    expect(a).not.toBe(b)
  })

  it('★ 演习模式（mode=drill）⇒ isDrill=true（否则演习会被计入真实 SOS，直接污染反滥用 KPI）', async () => {
    vi.mocked(getCurrentPages).mockReturnValueOnce([
      { options: { mode: 'drill' }, route: 'pages/rescue/index' },
    ] as unknown as ReturnType<typeof getCurrentPages>)

    const wrapper = await readyToConfirm()
    await wrapper.find('.confirm-btn').trigger('click')
    await flushPromises()

    expect(mockReport).toHaveBeenCalledTimes(1)
    expect(mockReport.mock.calls[0][0].isDrill).toBe(true)
    wrapper.unmount()
  })
})
