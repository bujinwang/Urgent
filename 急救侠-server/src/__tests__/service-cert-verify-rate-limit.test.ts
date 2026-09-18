/**
 * T02 · 服务证明**验真端点**按 IP 限流（T25 / Q7）。
 *
 * 两个方向都要断言（§8 T25）：
 * 1. 公开验真路径超阈值 ⇒ **429**；
 * 2. **不误伤**同前缀的 `GET /service-certificates/me` 与 `POST /service-certificates`（否则即为
 *    「把限流器挂到整个前缀」的回归 —— 设计明确禁止）。
 *
 * 测试模式下限流被豁免，故用 `createServiceCertVerifyLimiter(true)` **强制真实限流器**，
 * 并按本仓既定做法**显式绑定 127.0.0.1**（同 anon-rate-limit.test.ts）。
 */
import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { Server } from 'http'
import { createServiceCertVerifyLimiter, SERVICE_CERT_VERIFY_HOURLY_LIMIT } from '../app'
import { serviceHoursRouter } from '../routes/serviceHours'

const ENV = 'SERVICE_CERT_VERIFY_HOURLY_LIMIT'
let server: Server | undefined

/** 复刻 `app.ts` 的真实挂载：验真限流器在前，`serviceHoursRouter` 在后。 */
function makeServer(): Server {
  const app = express()
  app.use(express.json())
  app.use('/api/volunteer/service-certificates', createServiceCertVerifyLimiter(true))
  app.use('/api/volunteer', serviceHoursRouter)
  server = app.listen(0, '127.0.0.1')
  return server
}

afterEach(() => {
  server?.close()
  server = undefined
  delete process.env[ENV]
})

describe('T02 · 验真端点限流（T25）', () => {
  it('默认阈值为 60/小时（常量）', () => {
    expect(SERVICE_CERT_VERIFY_HOURLY_LIMIT).toBe(60)
  })

  it('公开验真路径超阈值 ⇒ 429', async () => {
    process.env[ENV] = '2'
    const srv = makeServer()
    // 未知编号 ⇒ 404，但限流器在处理器之前计数 ⇒ 阈值内为 404，超阈值 429
    expect((await request(srv).get('/api/volunteer/service-certificates/VS-X1')).status).toBe(404)
    expect((await request(srv).get('/api/volunteer/service-certificates/VS-X2')).status).toBe(404)
    const over = await request(srv).get('/api/volunteer/service-certificates/VS-X3')
    expect(over.status).toBe(429)
    expect(over.body.code).toBe(-1)
  })

  it('不误伤同前缀的 GET /me（限额耗尽后仍为 401，绝不 429）', async () => {
    process.env[ENV] = '1'
    const srv = makeServer()
    await request(srv).get('/api/volunteer/service-certificates/VS-A') // 已耗尽验真配额
    for (let i = 0; i < 5; i++) {
      const r = await request(srv).get('/api/volunteer/service-certificates/me')
      expect(r.status).toBe(401) // 未登录，而非被限流
    }
  })

  it('不误伤同前缀的 POST（限额耗尽后仍为 401，绝不 429）', async () => {
    process.env[ENV] = '1'
    const srv = makeServer()
    await request(srv).get('/api/volunteer/service-certificates/VS-B') // 已耗尽验真配额
    for (let i = 0; i < 5; i++) {
      const r = await request(srv).post('/api/volunteer/service-certificates').send({ periodFromMs: 0, periodToMs: 1 })
      expect(r.status).toBe(401)
    }
  })
})
