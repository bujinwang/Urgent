import { describe, it, expect, beforeEach, vi } from 'vitest'
import { requestFull } from '@/api/index'
import {
  getGovToken,
  govAuthHeader,
  govLogin,
  fetchGovMe,
  fetchGovDashboard,
  listGovViewers,
  createGovViewer,
  updateGovViewer,
} from '@/api/gov'
import type { GovViewer } from '@/api/gov'

const viewer: GovViewer = {
  id: 'g1', name: '张监管', orgName: '天河卫健委', scopeAll: false, districts: ['天河区'],
}

/** 覆盖 uni.getStorageSync：按 key 返回，未命中返回空串。 */
function setStorage(values: Record<string, string>): void {
  vi.mocked(uni.getStorageSync).mockImplementation((key: string): any => values[key] ?? '')
}

describe('Gov API（政府接口令牌隔离 + 调用契约）', () => {
  beforeEach(() => {
    // 默认：仅业务令牌存在，gov 令牌为空（模拟普通业务用户会话）
    vi.mocked(requestFull).mockReset()
    vi.mocked(requestFull).mockResolvedValue({ code: 0, message: 'ok' })
    vi.mocked(uni.getStorageSync).mockReset()
    setStorage({ jwt_token: 'mock-token-123' })
  })

  // ---- P2-8 令牌隔离（最高价值）----
  it('仅存业务 jwt_token 时，gov 令牌为空且鉴权头为空对象', () => {
    expect(getGovToken()).toBe('')
    expect(govAuthHeader()).toEqual({})
  })

  it('存在 gov_token 时鉴权头为 Bearer（不借用业务令牌）', () => {
    setStorage({ jwt_token: 'biz-token', gov_token: 'gov-tok-1' })
    expect(getGovToken()).toBe('gov-tok-1')
    expect(govAuthHeader()).toEqual({ Authorization: 'Bearer gov-tok-1' })
  })

  // ---- govLogin ----
  it('govLogin 以 POST /gov/login 提交用户名与密码，并返回 token/viewer', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: { token: 't1', viewer }, message: 'ok' })
    const res = await govLogin('govuser', 'secret')
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({
      url: '/gov/login', method: 'POST', data: { username: 'govuser', password: 'secret' },
    })
    expect(res.token).toBe('t1')
    expect(res.viewer).toEqual(viewer)
  })

  it('govLogin 业务码非 0 ⇒ 抛出服务端 message', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: '账号或密码错误' })
    await expect(govLogin('a', 'b')).rejects.toThrow('账号或密码错误')
  })

  it('govLogin code=0 但无 data ⇒ 抛错（无服务端 message 时为「请求失败」）', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, message: '' })
    await expect(govLogin('a', 'b')).rejects.toThrow('请求失败')
  })

  // ---- fetchGovMe ----
  it('fetchGovMe 请求 /gov/me，无 gov 令牌时 header 为空对象', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: viewer, message: 'ok' })
    const v = await fetchGovMe()
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({ url: '/gov/me', header: {} })
    expect(v).toEqual(viewer)
  })

  it('fetchGovMe 携带 gov 令牌（Bearer）', async () => {
    setStorage({ gov_token: 'gov-tok-1' })
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: viewer, message: 'ok' })
    await fetchGovMe()
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({
      url: '/gov/me', header: { Authorization: 'Bearer gov-tok-1' },
    })
  })

  // ---- fetchGovDashboard ----
  it('fetchGovDashboard 对 district 做 URL 编码并拼接 window', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: {}, message: 'ok' })
    await fetchGovDashboard({ window: 30, district: '天河区' })
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({
      url: '/gov/dashboard?window=30&district=%E5%A4%A9%E6%B2%B3%E5%8C%BA',
      header: {},
    })
  })

  it('fetchGovDashboard 无参数时 URL 恰为 /gov/dashboard（不含 ?）', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: {}, message: 'ok' })
    await fetchGovDashboard()
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({ url: '/gov/dashboard', header: {} })
  })

  it('fetchGovDashboard 依次拼装 from/to/window', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: {}, message: 'ok' })
    await fetchGovDashboard({ from: 100, to: 200, window: 7 })
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({
      url: '/gov/dashboard?from=100&to=200&window=7', header: {},
    })
  })

  // ---- 管理面（业务令牌，非 gov 令牌）----
  it('listGovViewers 请求 /gov/viewers 且不带 header（走业务令牌）', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: [], message: 'ok' })
    await listGovViewers()
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({ url: '/gov/viewers' })
  })

  it('createGovViewer 以 POST /gov/viewers 透传数据', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, data: { id: 'g2' }, message: 'ok' })
    const r = await createGovViewer({ username: 'u', password: 'p', scopeAll: true })
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({
      url: '/gov/viewers', method: 'POST', data: { username: 'u', password: 'p', scopeAll: true },
    })
    expect(r.id).toBe('g2')
  })

  it('updateGovViewer 以 PUT /gov/viewers/:id 更新', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: 0, message: 'ok' })
    await updateGovViewer('g9', { active: false })
    expect(vi.mocked(requestFull)).toHaveBeenCalledWith({
      url: '/gov/viewers/g9', method: 'PUT', data: { active: false },
    })
  })

  it('updateGovViewer 业务码非 0 ⇒ 抛错（callVoid 不静默）', async () => {
    vi.mocked(requestFull).mockResolvedValueOnce({ code: -1, message: '无权限' })
    await expect(updateGovViewer('g9', {})).rejects.toThrow('无权限')
  })
})
