import { describe, it, expect, vi, beforeEach } from 'vitest'

// setup.ts 全局 mock 了 '@/api/index'；这里用 pass-through 还原**真实**实现，
// 以便测试 request()/requestFull() 的真实行为（P1-1 根因修复）。
vi.mock('@/api/index', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return { ...actual }
})

import { request, requestFull, ApiBusinessError } from '@/api/index'

const uniMock = (globalThis as any).uni as { request: ReturnType<typeof vi.fn> }

function mockUniRequest(body: unknown, statusCode = 200) {
  uniMock.request = vi.fn((opts: any) => {
    const res = { data: body, statusCode }
    if (typeof opts?.success === 'function') opts.success(res)
    return Promise.resolve(res)
  })
}

describe('P1-1 · request() 根因修复：业务错误必须抛错', () => {
  beforeEach(() => { uniMock.request.mockReset() })

  it('★ code === 0 ⇒ request() 解析 body.data', async () => {
    mockUniRequest({ code: 0, data: { id: 'x' }, message: 'ok' })
    const data = await request<{ id: string }>({ url: '/t' })
    expect(data).toEqual({ id: 'x' })
  })

  it('★ code !== 0 ⇒ request() 抛 ApiBusinessError（不再静默回传 body.data）', async () => {
    mockUniRequest({ code: 4003, data: undefined, message: '未同意 PIPL' })
    await expect(request({ url: '/t' })).rejects.toBeInstanceOf(ApiBusinessError)
    // 错误信息透传，调用方可据此给精准文案（而非「假成功」）
    try {
      await request({ url: '/t' })
    } catch (e: any) {
      expect(e.code).toBe(4003)
      expect(e.message).toBe('未同意 PIPL')
    }
  })

  it('★ code !== 0 ⇒ requestFull() **不**抛错，返回完整响应体（供按码分支）', async () => {
    mockUniRequest({ code: 4003, data: null, message: '未同意 PIPL' })
    const res = await requestFull({ url: '/t' })
    expect(res.code).toBe(4003)
    expect(res.message).toBe('未同意 PIPL')
    expect(res.statusCode).toBe(200)
  })

  it('★ 网络/传输失败 ⇒ request() 抛原错误（不吞）', async () => {
    uniMock.request = vi.fn(() => Promise.reject(new Error('network down')))
    await expect(request({ url: '/t' })).rejects.toThrow('network down')
  })
})
