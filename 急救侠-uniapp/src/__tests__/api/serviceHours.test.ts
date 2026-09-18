/**
 * `api/serviceHours` 的**错误透出**契约（覆盖补缺：验真失败分流的前提）。
 *
 * `setup.ts` 把 `@/api/index` 全局 mock 了 ⇒ 本文件先 `vi.unmock` 还原**真实** `requestFull`，
 * 再让 `uni.request` 返回带 `statusCode` 的响应，断言它**透传**到抛出的错误上。
 * 若这一步不通，"404 vs 网络错误"的区分就不成立（那要停下来改产品方案）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.unmock('@/api/index')

import { verifyCertificate } from '@/api/serviceHours'

describe('api/serviceHours · 错误透出（statusCode 透传）', () => {
  beforeEach(() => { vi.mocked(uni.request).mockReset() })

  it('★ 404 ⇒ 抛出的错误带 statusCode=404（供页面判定"确实不存在"）', async () => {
    vi.mocked(uni.request).mockResolvedValueOnce({
      statusCode: 404,
      data: { code: -1, message: '证明不存在' },
    } as never)

    const err = await verifyCertificate('VS-X').then(() => null, (e) => e as { statusCode?: number; code?: number })
    expect(err).toBeTruthy()
    expect(err?.statusCode).toBe(404)
    expect(err?.code).toBe(-1)
  })

  it('★ 500 ⇒ statusCode=500（页面据此显示"验真失败"，而非"未找到"）', async () => {
    vi.mocked(uni.request).mockResolvedValueOnce({
      statusCode: 500,
      data: { code: -1, message: '服务器错误' },
    } as never)

    const err = await verifyCertificate('VS-Y').then(() => null, (e) => e as { statusCode?: number })
    expect(err?.statusCode).toBe(500)
  })

  it('网络异常（request 直接 reject）⇒ 无 statusCode（页面走"验真失败"）', async () => {
    vi.mocked(uni.request).mockRejectedValueOnce(new Error('network down'))

    const err = await verifyCertificate('VS-Z').then(() => null, (e) => e as { statusCode?: number })
    expect(err).toBeTruthy()
    expect(err?.statusCode).toBeUndefined()
  })

  it('成功 ⇒ 正常返回 data（透传不影响正常路径）', async () => {
    vi.mocked(uni.request).mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 0, message: 'ok', data: { certNo: 'VS-OK', periodFromMs: 0, periodToMs: 1, totalMinutes: 5, status: 'active' } },
    } as never)

    await expect(verifyCertificate('VS-OK')).resolves.toMatchObject({ certNo: 'VS-OK', totalMinutes: 5 })
  })
})
