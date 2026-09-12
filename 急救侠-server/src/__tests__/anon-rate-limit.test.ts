import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { Server } from 'http'
import { createHourlyIpLimiter, ANON_LIMITS } from '../app'

/**
 * 匿名端点（media-alert/upload、public/inquire）在 test 模式下限流被豁免，
 * 故用 `createHourlyIpLimiter(envKey, def, force=true)` 挂临时 app **强制启用**真实限流器。
 * 注意：按 `setup.ts` 的既定做法**显式绑定 127.0.0.1**，避免 supertest 默认 `listen(0)`
 * 绑通配地址在 macOS 上被本机其它监听端接走（该仓库已记录过此类端口串扰）。
 */
const servers: Server[] = []

function makeServer(path: string, envKey: string, def: number): Server {
  const app = express()
  app.post(path, createHourlyIpLimiter(envKey, def, true), (_req, res) => { res.json({ ok: true }) })
  const s = app.listen(0, '127.0.0.1')
  servers.push(s)
  return s
}

afterEach(() => {
  while (servers.length) servers.pop()!.close()
  delete process.env.MEDIA_UPLOAD_HOURLY_LIMIT
  delete process.env.INQUIRE_HOURLY_LIMIT
})

describe('匿名端点按 IP 限流（保持无需注册，仅限频）', () => {
  it(`media-alert/upload 超过 ${ANON_LIMITS.mediaUpload} 次/小时 → 429`, async () => {
    const srv = makeServer('/up', 'MEDIA_UPLOAD_HOURLY_LIMIT', ANON_LIMITS.mediaUpload)
    for (let i = 0; i < ANON_LIMITS.mediaUpload; i++) {
      expect((await request(srv).post('/up')).status).toBe(200)
    }
    const over = await request(srv).post('/up')
    expect(over.status).toBe(429)
    expect(over.body.code).toBe(-1)
  })

  it(`public/inquire 超过 ${ANON_LIMITS.inquire} 次/小时 → 429`, async () => {
    const srv = makeServer('/in', 'INQUIRE_HOURLY_LIMIT', ANON_LIMITS.inquire)
    for (let i = 0; i < ANON_LIMITS.inquire; i++) {
      expect((await request(srv).post('/in')).status).toBe(200)
    }
    expect((await request(srv).post('/in')).status).toBe(429)
  })

  it('阈值可 env 覆盖（INQUIRE_HOURLY_LIMIT=1 ⇒ 第 2 次即 429）', async () => {
    process.env.INQUIRE_HOURLY_LIMIT = '1'
    const srv = makeServer('/in2', 'INQUIRE_HOURLY_LIMIT', ANON_LIMITS.inquire)
    expect((await request(srv).post('/in2')).status).toBe(200)
    expect((await request(srv).post('/in2')).status).toBe(429)
  })
})
