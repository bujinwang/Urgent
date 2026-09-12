import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { server } from './setup'

/**
 * 未配置 `ALIYUN_SMS_REPORT_SECRET` 时的行为：端点**整体关闭**（404，不暴露其存在）。
 * 本文件**不设置**该 env（config 于模块加载时捕获为空）。
 */
describe('POST /api/public/aliyun-sms-report — 未配置密钥', () => {
  it('任意请求（含带密钥头）→ 404', async () => {
    const plain = await request(server).post('/api/public/aliyun-sms-report').send([{ biz_id: 'X', success: false }])
    expect(plain.status).toBe(404)

    const withHeader = await request(server)
      .post('/api/public/aliyun-sms-report')
      .set('x-sms-report-secret', 'anything')
      .send([{ biz_id: 'X', success: false }])
    expect(withHeader.status).toBe(404)
  })
})
