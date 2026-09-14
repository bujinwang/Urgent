import { describe, it, expect, beforeEach, type Mock } from 'vitest'
import { requestFull } from '@/api/index'
import { reportSosEvent, newSosEventId } from '@/api/sos'

/**
 * F3 SOS 埋点的**前端契约**（设计文档 §5.2 / §9 T6）。
 *
 * `@/api/index` 在 `__tests__/setup.ts` 里被整体 mock，故这里能直接操纵 `requestFull` 的
 * 成功/失败/异常三种结局，验证「埋点绝不把异常抛回急救流程」这条不可动摇的约束。
 */
const mockRequestFull = requestFull as unknown as Mock

interface CapturedCall {
  url: string
  method: string
  data: Record<string, unknown>
}

function lastPayload(): CapturedCall {
  const calls = mockRequestFull.mock.calls
  return calls[calls.length - 1][0] as CapturedCall
}

describe('sos api — 旁路上报绝不打断急救流程', () => {
  beforeEach(() => { mockRequestFull.mockClear() })

  it('★ 网络异常（reject）⇒ reportSosEvent 仍 resolve，绝不 reject', async () => {
    mockRequestFull.mockRejectedValueOnce(new Error('network down'))
    await expect(reportSosEvent({ clientEventId: 'e1', isDrill: false })).resolves.toBeUndefined()
  })

  it('★ 服务端 500 / 429 业务错误（code≠0）⇒ 仍 resolve', async () => {
    mockRequestFull.mockResolvedValueOnce({ code: -1, message: '操作过于频繁，请稍后再试' })
    await expect(reportSosEvent({ clientEventId: 'e2', isDrill: false })).resolves.toBeUndefined()
  })

  it('上报正常成功 ⇒ resolve', async () => {
    mockRequestFull.mockResolvedValueOnce({ code: 0, data: { duplicate: false }, message: 'ok' })
    await expect(reportSosEvent({ clientEventId: 'e3', isDrill: true })).resolves.toBeUndefined()
  })
})

describe('sos api — 载荷契约', () => {
  beforeEach(() => { mockRequestFull.mockClear() })

  it('★ 载荷不含任何位置字段（D1：后端表里根本没有位置列，前端也不得"顺手"加上）', async () => {
    await reportSosEvent({ clientEventId: 'evt-1', isDrill: true })
    const p = lastPayload()

    expect(p.url).toBe('/public/sos-event')
    expect(p.method).toBe('POST')
    expect(Object.keys(p.data).sort()).toEqual(['clientEventId', 'isDrill', 'platform'])
    expect(p.data.isDrill).toBe(true)

    // 键名层面兜底：出现任何位置类键即说明有人扩大了隐私采集面。
    // ⚠️ 必须**切词后精确比对**，不能用子串匹配 —— `platform` 含 "lat"，子串匹配会误伤。
    const tokens = Object.keys(p.data).flatMap(k => k.toLowerCase().split(/[^a-z0-9]+/))
    const FORBIDDEN = [
      'lat', 'lng', 'lon', 'latitude', 'longitude', 'location', 'loc',
      'geo', 'geohash', 'geojson', 'coord', 'coords', 'coordinate', 'position',
      'address', 'gps', 'district',
    ]
    expect(tokens.filter(t => FORBIDDEN.includes(t))).toEqual([])
  })

  it('★ 绝不把 userId 放进载荷（身份只由 Authorization 头承载，body 传 userId 会被后端忽略）', async () => {
    await reportSosEvent({ clientEventId: 'evt-2', isDrill: false })
    expect(lastPayload().data).not.toHaveProperty('userId')
  })

  it('isDrill 以布尔值发送（不是真值字符串，避免后端归一化歧义）', async () => {
    await reportSosEvent({ clientEventId: 'evt-3', isDrill: false })
    expect(lastPayload().data.isDrill).toBe(false)
  })
})

describe('newSosEventId', () => {
  it('生成前缀正确、长度有界、且互不相同（幂等键不得碰撞）', () => {
    const ids = Array.from({ length: 200 }, () => newSosEventId())
    expect(ids.every(id => id.startsWith('sos_'))).toBe(true)
    // 后端 client_event_id 上限 64，前端必须留足余量
    expect(ids.every(id => id.length <= 64)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
