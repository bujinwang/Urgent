import './setup' // 副作用：DB_PATH=':memory:' + initDb（验真处理器会查库）
import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { Server } from 'http'
import {
  createHourlyIpLimiter,
  SERVICE_CERT_VERIFY_LIMIT_ENV,
  SERVICE_CERT_VERIFY_HOURLY_LIMIT,
} from '../middleware/rateLimit'
import { createServiceHoursRouter } from '../routes/serviceHours'

/**
 * T32（★ v1.3）· 验真端点的**路由级限流**只作用于 `GET /service-certificates/:certNo`。
 *
 * 两个方向（§8 T32）：
 * 1. 公开验真路径超阈值 ⇒ **429**；
 * 2. **不误伤**同前缀的 `GET /service-certificates/me` 与 `POST /service-certificates`。
 *
 * v1.3 起限流器是**路由级中间件**（`router.get('/:certNo', verifyLimiter, handler)`），
 * 不再依赖 `app.use(prefix, …)` 或 `req.path` 语义。测试经工厂 `createServiceHoursRouter(limiter)`
 * 注入 `force=true` 的真实限流器（测试模式下默认限流被豁免，见 rateLimit.ts）。
 */
const ENV = SERVICE_CERT_VERIFY_LIMIT_ENV
let server: Server | undefined

function makeServer(): Server {
  const app = express()
  app.use(express.json())
  app.use('/api/volunteer', createServiceHoursRouter(createHourlyIpLimiter(ENV, SERVICE_CERT_VERIFY_HOURLY_LIMIT, true)))
  server = app.listen(0, '127.0.0.1')
  return server
}

afterEach(() => {
  server?.close()
  server = undefined
  delete process.env[ENV]
})

describe('T32 · 验真端点路由级限流（v1.3）', () => {
  it('默认阈值为 60/小时（常量）', () => {
    expect(SERVICE_CERT_VERIFY_HOURLY_LIMIT).toBe(60)
  })

  it('公开验真路径超阈值 ⇒ 429', async () => {
    process.env[ENV] = '2'
    const srv = makeServer()
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
