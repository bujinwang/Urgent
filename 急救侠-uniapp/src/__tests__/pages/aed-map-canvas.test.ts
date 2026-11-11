import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setLocale } from '@/i18n'

/**
 * F1 `pages/aed/MapCanvas.vue` 降级路径守卫（PRD D3 硬约束："无 Key 前不合并地图代码，
 * 或必须同时合并降级路径并测试它"）。
 *
 * 本文件只测 **H5 语义**下的降级（vitest / happy-dom 不处理 uni-app 条件编译注释，
 * 且 `isMpWeixin()` 在无 document 缺失 / 有 wx 缺失的测试宿主里恒 false ⇒ 走 H5 分支）：
 *  ① 无 Key ⇒ mounted 立即 emit('fallback')（绝不白屏、绝不阻塞）
 *  ② Key 在场但腾讯 GL JS SDK 加载失败 ⇒ catch 分支同样 emit('fallback')
 *  ③ Key 在场、SDK 成功但 createMap 抛错 ⇒ catch 分支同样 emit('fallback')
 * 真地图渲染（有 Key 且 SDK 成功）属生产环境行为，需浏览器 + 真实 Key，不在此单测范围。
 */

describe('F1 pages/aed/MapCanvas —— H5 三降级路径（PRD D3）', () => {
  beforeEach(() => {
    setLocale('zh-CN')
    vi.resetModules()
  })
  afterEach(() => {
    setLocale('zh-CN')
    vi.doUnmock('@/utils/map/adapter')
    vi.unstubAllGlobals()
  })

  it('① 无腾讯 Key ⇒ mounted 立即 emit("fallback") 恰好一次（当前仓库实际路径）', async () => {
    const MapCanvas = (await import('@/pages/aed/MapCanvas.vue')).default
    const wrapper = mount(MapCanvas, { props: { devices: [] } })
    await flushPromises()
    expect(wrapper.emitted('fallback')).toBeTruthy()
    expect(wrapper.emitted('fallback')!.length).toBe(1)
  })

  it('② Key 在场但 SDK 加载失败 ⇒ catch 分支同样 emit("fallback")', async () => {
    const sdkReject = vi.fn(() => Promise.reject(new Error('network down')))
    const createSpy = vi.fn()
    await vi.doMock('@/utils/map/adapter', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/utils/map/adapter')>()
      return {
        ...actual,
        isMapEnabled: () => true,
        isMpWeixin: () => false,
        loadTMapSdk: sdkReject,
        createMap: createSpy,
      }
    })
    const MapCanvas = (await import('@/pages/aed/MapCanvas.vue')).default
    const wrapper = mount(MapCanvas, { props: { devices: [] } })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
    await flushPromises()
    expect(sdkReject).toHaveBeenCalledTimes(1)
    expect(createSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('fallback')).toBeTruthy()
    expect(wrapper.emitted('fallback')!.length).toBe(1)
  })

  it('③ Key 在场、SDK 成功但 createMap 抛错 ⇒ catch 分支同样 emit("fallback")', async () => {
    const sdkResolve = vi.fn(() => Promise.resolve({ TMap: 'mock' }))
    const createThrows = vi.fn(() => { throw new Error('TMap init failed') })
    await vi.doMock('@/utils/map/adapter', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/utils/map/adapter')>()
      return {
        ...actual,
        isMapEnabled: () => true,
        isMpWeixin: () => false,
        loadTMapSdk: sdkResolve,
        createMap: createThrows,
      }
    })
    const MapCanvas = (await import('@/pages/aed/MapCanvas.vue')).default
    const wrapper = mount(MapCanvas, { props: { devices: [] } })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
    await flushPromises()
    expect(sdkResolve).toHaveBeenCalledTimes(1)
    expect(createThrows).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('fallback')).toBeTruthy()
    expect(wrapper.emitted('fallback')!.length).toBe(1)
  })

  it('④ 微信小程序语义（isMpWeixin=true、无 Key）⇒ 设备为空 ⇒ emit("fallback")，绝不加载 SDK', async () => {
    const sdkSpy = vi.fn(() => Promise.resolve({}))
    await vi.doMock('@/utils/map/adapter', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/utils/map/adapter')>()
      return {
        ...actual,
        isMapEnabled: () => false,
        isMpWeixin: () => true,
        loadTMapSdk: sdkSpy,
      }
    })
    const MapCanvas = (await import('@/pages/aed/MapCanvas.vue')).default
    const wrapper = mount(MapCanvas, { props: { devices: [] } })
    await flushPromises()
    expect(sdkSpy).not.toHaveBeenCalled()
    expect(wrapper.emitted('fallback')).toBeTruthy()
    expect(wrapper.emitted('fallback')!.length).toBe(1)
  })
})
