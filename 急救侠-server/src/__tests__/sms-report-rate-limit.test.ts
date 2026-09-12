import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createSmsReportLimiter, SMS_REPORT_LIMIT } from '../app'

/**
 * M4：`smsReportLimiter` 在 test 模式下被豁免，故无覆盖。这里用 `createSmsReportLimiter(true)`
 * **强制返回真实限流器**并挂到一个临时 app 上，验证超限返回 429（真实断言我们选的限流参数）。
 */
describe('短信状态报告回调限流（M4）', () => {
  it(`超过 ${SMS_REPORT_LIMIT.max} 次/分钟 → 429`, async () => {
    const app = express()
    app.get('/x', createSmsReportLimiter(true), (_req, res) => { res.json({ ok: true }) })

    for (let i = 0; i < SMS_REPORT_LIMIT.max; i++) {
      const r = await request(app).get('/x')
      expect(r.status).toBe(200)
    }
    const over = await request(app).get('/x')
    expect(over.status).toBe(429)
    expect(over.body.code).toBe(-1)
  })
})
