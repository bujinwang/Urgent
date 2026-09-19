import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setLocale } from '@/i18n'

/**
 * F1 `pages/aed/MapCanvas.vue` 降级路径守卫（PRD D3 硬约束："无高德 Key 前不合并地图代码，
 * 或必须同时合并降级路径并测试它"）。
 *
 * 本文件只测**降级**（这是当前仓库唯一可达路径，因 VITE_AMAP_KEY 未配置）：
 *  ① 无 Key ⇒ mounted 立即 emit('fallback')（绝不白屏、绝不阻塞）
 *  ② Key 在场但 SDK 加载失败 ⇒ catch 分支同样 emit('fallback')
 * 真地图渲染（有 Key 且 SDK 成功）属生产环境行为，需浏览器 + 真实 Key，不在此单测范围。
 */

describe('F1 pages/aed/MapCanvas —— 双降级路径（PRD D3）', () => {
  beforeEach(() => setLocale('zh-CN'))
  afterEach(() => {
    setLocale('zh-CN')
    vi.doUnmock('@/utils/map/adapter')
  })

  it('① 无高德 Key ⇒ mounted 立即 emit("fallback")（当前仓库实际路径）', async () => {
    const MapCanvas = (await import('@/pages/aed/MapCanvas.vue')).default
    const wrapper = mount(MapCanvas, { props: { devices: [] } })
    await flushPromises()
    expect(wrapper.emitted('fallback')).toBeTruthy()
    expect(wrapper.emitted('fallback')!.length).toBe(1)
  })

  it('② Key 在场但 SDK 加载失败 ⇒ catch 分支同样 emit("fallback")', async () => {
    await vi.doMock('@/utils/map/adapter', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/utils/map/adapter')>()
      return {
        ...actual,
        isMapEnabled: () => true,
        loadAmapSdk: vi.fn(() => Promise.reject(new Error('network down'))),
      }
    })
    const MapCanvas = (await import('@/pages/aed/MapCanvas.vue')).default
    const wrapper = mount(MapCanvas, { props: { devices: [] } })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
    await flushPromises()
    expect(wrapper.emitted('fallback')).toBeTruthy()
  })
})
