import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, clearAll, userToken } from './setup'

const auth = { Authorization: `Bearer ${userToken('user_001')}` }

/** 走完整「报名 → 到达 → 离开」（v1.2：让任务真正被本人闭合）。 */
async function acceptArriveComplete() {
  await request(server).post('/api/task/accept').set(auth).send({ taskId: 'task_001' })
  await request(server).post('/api/task/arrive').set(auth).send({ taskId: 'task_001' })
  return request(server).post('/api/task/complete').set(auth).send({ taskId: 'task_001' })
}

describe('Task Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/task/active', () => {
    it('returns active task', async () => {
      const res = await request(server).get('/api/task/active')
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe('task_001')
      expect(res.body.data.type).toBe('cpr')
    })

    it('returns null when no active task', async () => {
      // v1.2：`tasks.status='completed'` 仅在「本人真正闭合」时更新 ⇒ 需带 token 走完整流程
      await acceptArriveComplete()
      const res = await request(server).get('/api/task/active')
      expect(res.body.data).toBeNull()
    })
  })

  describe('GET /api/task/list', () => {
    it('returns task list', async () => {
      const res = await request(server).get('/api/task/list')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('POST /api/task/accept', () => {
    it('accepts a task（游客也返回 200）', async () => {
      const res = await request(server)
        .post('/api/task/accept')
        .send({ taskId: 'task_001' })
      expect(res.status).toBe(200)
      expect(res.body.code).toBe(0)
    })

    it('带 token ⇒ 返回 { attributed } 且归因成功（F4 T01 契约）', async () => {
      const res = await request(server)
        .post('/api/task/accept')
        .set('Authorization', `Bearer ${userToken('user_001')}`)
        .send({ taskId: 'task_001' })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ attributed: true })
    })
  })

  describe('POST /api/task/arrive（★ v1.2 新增）', () => {
    it('带 token 且已报名 ⇒ { arrived:true }', async () => {
      await request(server).post('/api/task/accept').set(auth).send({ taskId: 'task_001' })
      const res = await request(server).post('/api/task/arrive').set(auth).send({ taskId: 'task_001' })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ arrived: true })
    })

    it('游客 ⇒ { arrived:false }，仍 200', async () => {
      const res = await request(server).post('/api/task/arrive').send({ taskId: 'task_001' })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ arrived: false })
    })
  })

  describe('POST /api/task/complete（★ v1.2 改为按人闭合）', () => {
    it('带 token 且已到达 ⇒ { closed:1, minutes:0 } 且任务不再 active', async () => {
      const res = await acceptArriveComplete()
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ closed: 1, minutes: 0 })

      const active = await request(server).get('/api/task/active')
      expect(active.body.data).toBeNull()
    })

    it('游客 ⇒ { closed:0, minutes:0 }，仍 200（且不改变任务状态）', async () => {
      const res = await request(server).post('/api/task/complete').send({ taskId: 'task_001' })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ closed: 0, minutes: 0 })
    })
  })

  describe('POST /api/task/abandon（★ v1.2 新增）', () => {
    it('带 token 且已报名 ⇒ { voided:true }', async () => {
      await request(server).post('/api/task/accept').set(auth).send({ taskId: 'task_001' })
      const res = await request(server).post('/api/task/abandon').set(auth).send({ taskId: 'task_001' })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ voided: true })
    })

    it('游客 ⇒ { voided:false }，仍 200', async () => {
      const res = await request(server).post('/api/task/abandon').send({ taskId: 'task_001' })
      expect(res.status).toBe(200)
      expect(res.body.data).toEqual({ voided: false })
    })
  })
})
