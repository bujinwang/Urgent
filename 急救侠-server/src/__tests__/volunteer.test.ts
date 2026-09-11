import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { server, seedTestData, db } from './setup'

function seedExtraVolunteers() {
  // v_a：低积分、高救援；v_b：高积分、低救援 —— 用于区分两种榜单排序
  db.prepare('INSERT INTO volunteers (id,name,avatar,tier,points,rescue_count,city,rank_pos) VALUES (?,?,?,?,?,?,?,?)')
    .run('v_a', 'A', 'A', 'gold', 100, 50, '深圳', 9)
  db.prepare('INSERT INTO volunteers (id,name,avatar,tier,points,rescue_count,city,rank_pos) VALUES (?,?,?,?,?,?,?,?)')
    .run('v_b', 'B', 'B', 'gold', 900, 5, '深圳', 8)
}

describe('Volunteer Routes', () => {
  beforeEach(() => { seedTestData() })

  describe('GET /api/volunteer/rankings', () => {
    it('returns volunteer rankings', async () => {
      const res = await request(server).get('/api/volunteer/rankings')
      expect(res.status).toBe(200)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0].name).toBeTruthy()
      expect(res.body.data[0].rank).toBeGreaterThan(0)
    })
  })

  describe('GET /api/volunteer/rankings?type=', () => {
    it('type=points 与 type=rescue 排序确实不同', async () => {
      seedExtraVolunteers()

      const points = await request(server).get('/api/volunteer/rankings?type=points')
      const rescue = await request(server).get('/api/volunteer/rankings?type=rescue')

      const pid = (points.body.data as Array<{ id: string }>).map((r) => r.id)
      const rid = (rescue.body.data as Array<{ id: string }>).map((r) => r.id)

      // points: v001(2340) > v_b(900) > v_a(100)
      expect(pid[0]).toBe('v001')
      expect(pid.indexOf('v_b')).toBeLessThan(pid.indexOf('v_a'))

      // rescue: v_a(50) > v001(12) > v_b(5)
      expect(rid[0]).toBe('v_a')
      expect(rid.indexOf('v_a')).toBeLessThan(rid.indexOf('v_b'))

      // position 反映所选维度位次（1-based）
      expect(points.body.data[0].position).toBe(1)
      expect(rescue.body.data[0].position).toBe(1)
    })

    it('缺省 type 等同 points', async () => {
      const def = await request(server).get('/api/volunteer/rankings')
      const pts = await request(server).get('/api/volunteer/rankings?type=points')
      expect((def.body.data as Array<{ id: string }>).map((r) => r.id))
        .toEqual((pts.body.data as Array<{ id: string }>).map((r) => r.id))
    })
  })
})
