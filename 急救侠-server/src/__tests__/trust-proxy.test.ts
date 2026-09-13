import { describe, it, expect, afterAll, vi } from 'vitest'
import request from 'supertest'
import os from 'os'
import path from 'path'
import fs from 'fs'
import type { Server } from 'http'
import type { Express } from 'express'
import { server as testServer } from './setup'

/**
 * `trust proxy` 生效性 + **匿名限流的真实挂载**覆盖。
 *
 * 真实挂载用例需要限流器**不被 test 豁免** ⇒ 用 `NODE_ENV`/`DB_PATH` 造出 `isTestMode=false` 的
 * **全新 app**（`vi.resetModules()` 后重新加载），并**显式绑定 127.0.0.1**（沿用 setup.ts 约定）。
 */
const TMP = path.join(os.tmpdir(), `jiujiaxia-tp-${process.pid}-${Date.now()}.db`)
const ENV_KEYS = ['DB_PATH', 'NODE_ENV', 'TRUST_PROXY_HOPS', 'INQUIRE_HOURLY_LIMIT', 'JWT_SECRET', 'GOV_JWT_SECRET'] as const
const ORIG: Record<string, string | undefined> = {}
for (const k of ENV_KEYS) ORIG[k] = process.env[k]

const servers: Server[] = []

async function loadRealApp(env: Record<string, string>): Promise<Express> {
  process.env.DB_PATH = TMP
  process.env.NODE_ENV = 'development' // 非 test ⇒ isTestMode=false
  process.env.JWT_SECRET = 'tp-test-secret'
  process.env.GOV_JWT_SECRET = 'tp-test-gov-secret'
  for (const k of ['TRUST_PROXY_HOPS', 'INQUIRE_HOURLY_LIMIT']) delete process.env[k]
  for (const [k, v] of Object.entries(env)) process.env[k] = v
  vi.resetModules()
  const appMod = await import('../app')
  return appMod.default
}

function serve(app: Express): Server {
  const s = app.listen(0, '127.0.0.1')
  servers.push(s)
  return s
}

afterAll(() => {
  while (servers.length) servers.pop()!.close()
  for (const k of ENV_KEYS) {
    if (ORIG[k] === undefined) delete process.env[k]
    else process.env[k] = ORIG[k] as string
  }
  for (const f of [TMP, TMP + '-wal', TMP + '-shm', TMP + '-journal']) {
    try { fs.unlinkSync(f) } catch { /* ignore */ }
  }
})

describe('trust proxy（真实反代下的客户端 IP）', () => {
  it('默认 TRUST_PROXY_HOPS = 2', async () => {
    const app = await loadRealApp({})
    expect(app.get('trust proxy')).toBe(2)
  })

  it('TRUST_PROXY_HOPS=0 ⇒ trust proxy = false（关闭）', async () => {
    const app = await loadRealApp({ TRUST_PROXY_HOPS: '0' })
    expect(app.get('trust proxy')).toBe(false)
  })

  it('★ 真实挂载：连续超限 ⇒ 429；**不同 X-Forwarded-For 分属不同桶**（未共桶）', async () => {
    const app = await loadRealApp({ TRUST_PROXY_HOPS: '1', INQUIRE_HOURLY_LIMIT: '2' })
    const srv = serve(app)
    const hit = (xff: string) =>
      request(srv).post('/api/public/inquire').set('X-Forwarded-For', xff).send({ message: 'hi' })

    // 来源 A 打满（上限 2）⇒ 第 3 次 429 —— 证明**真实 app 上确实挂了**按 IP 限流
    expect((await hit('203.0.113.9')).status).toBe(200)
    expect((await hit('203.0.113.9')).status).toBe(200)
    expect((await hit('203.0.113.9')).status).toBe(429)

    // ★ 来源 B 仍 200 —— 证明 `trust proxy` 生效、**未退化为全局共桶**
    expect((await hit('203.0.113.10')).status).toBe(200)
  })

  it('回归：测试环境（isTestMode）匿名限流豁免，不设 XFF 行为不变', async () => {
    const res = await request(testServer).post('/api/public/inquire').send({ message: 'hi' })
    expect(res.status).toBe(200)
  })
})
