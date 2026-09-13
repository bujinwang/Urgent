import { describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import type { Server } from 'http'
import { createSmsReportLimiter, SMS_REPORT_LIMIT } from '../app'

/**
 * M4：`smsReportLimiter` 在 test 模式下被豁免，故用 `createSmsReportLimiter(true)` **强制返回真实限流器**
 * 并挂到临时 app 上验证。阈值经 env 下调到 2（避免 61 次 HTTP 的端口抖动；与其它限流器一致）。
 * 按 `setup.ts` 的既定做法**显式绑定 127.0.0.1**。
 */
let server: Server | undefined

afterEach(() => {
  server?.close()
  server = undefined
  delete process.env.SMS_REPORT_MINUTE_LIMIT
})

describe('短信状态报告回调限流（M4）', () => {
  it('默认上限为 60/分钟（常量）', () => {
    expect(SMS_REPORT_LIMIT.max).toBe(60)
  })

  it('超过阈值 → 429', async () => {
    process.env.SMS_REPORT_MINUTE_LIMIT = '2'
    const app = express()
    app.get('/x', createSmsReportLimiter(true), (_req, res) => { res.json({ ok: true }) })
    server = app.listen(0, '127.0.0.1')

    expect((await request(server).get('/x')).status).toBe(200)
    expect((await request(server).get('/x')).status).toBe(200)
    const over = await request(server).get('/x')
    expect(over.status).toBe(429)
    expect(over.body.code).toBe(-1)
  })
})
