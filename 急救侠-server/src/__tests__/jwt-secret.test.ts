/**
 * JWT_SECRET 硬化（安全收敛 B）
 *
 * 独立成文件：需在**不同 env 下重新加载** `config.ts`，故不引入 `setup.ts`（避免加载 app）。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

describe('JWT_SECRET 硬化（安全收敛 B）', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('生产环境未配置 JWT_SECRET → 加载即抛错（fail-fast，拒绝弱默认启动）', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', '')
    await expect(import('../config')).rejects.toThrow(/JWT_SECRET/)
  })

  it('非生产未配置 → 正常加载，且密钥不是弱默认值', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('JWT_SECRET', '')
    const mod = await import('../config')
    expect(mod.JWT_SECRET).toBeTruthy()
    expect(mod.JWT_SECRET).not.toBe('jiujiaxia-dev-secret')
    expect(mod.JWT_SECRET.length).toBeGreaterThanOrEqual(32)
  })

  it('显式配置时使用配置值（生产可用）', async () => {
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', 'configured-strong-secret')
    const mod = await import('../config')
    expect(mod.JWT_SECRET).toBe('configured-strong-secret')
  })
})
