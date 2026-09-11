import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, db } from './setup'

describe('Cases Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/cases/list', () => {
    it('returns case list', async () => {
      const res = await request(server).get('/api/cases/list')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('GET /api/cases/:id', () => {
    it('returns case by id', async () => {
      const res = await request(server).get('/api/cases/case_001')
      expect(res.status).toBe(200)
      expect(res.body.data.title).toContain('心脏骤停')
    })

    it('returns error for unknown id', async () => {
      const res = await request(server).get('/api/cases/zzz')
      expect(res.body.code).toBe(-1)
    })
  })

  describe('case ↔ news 互链（news_id 可空）', () => {
    it('无可靠数据来源时 newsId 为空（保持可空）', async () => {
      const res = await request(server).get('/api/cases/case_001')
      expect(res.body.data.newsId).toBeUndefined()
    })

    it('存在 news_id 时在 /:id 与 /list 暴露', async () => {
      db.prepare('INSERT INTO rescue_cases (id,title,summary,date,location,result,volunteers,body,news_id) VALUES (?,?,?,?,?,?,?,?,?)')
        .run('case_link', '互链案例', 's', '2026-01-01', '深圳', '成功', '[]', '', 'n001')

      const one = await request(server).get('/api/cases/case_link')
      expect(one.body.data.newsId).toBe('n001')

      const list = await request(server).get('/api/cases/list')
      const found = (list.body.data as Array<{ id: string; newsId?: string }>).find((c) => c.id === 'case_link')
      expect(found?.newsId).toBe('n001')
    })
  })
})
