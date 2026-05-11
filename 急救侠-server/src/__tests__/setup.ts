// Must set DB_PATH before any app imports
process.env.DB_PATH = ':memory:'

import app from '../app'
import { clearAll } from '../db'
import db from '../db'

// Seed helper used by individual tests
export function seedTestData() {
  clearAll()

  db.prepare(`INSERT INTO users (id, name, avatar, tier, points, city, volunteer_id, certifications, rescue_count)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(
    'user_001', '陆远', '陆', 'gold', 2340, '深圳', 'SZ-012',
    JSON.stringify(['CPR-AHA', 'AED-Operator']), 12
  )

  db.prepare('INSERT INTO stats (id, certified_rescuers, networked_aeds, monthly_rescues, online_volunteers, aeds_within_1km) VALUES (1, 12847, 3256, 89, 3, 12)').run()

  db.prepare('INSERT INTO tasks (id, type, address, distance, lat, lng, volunteers_needed, volunteers_responded, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(
    'task_001', 'cpr', '深圳湾公园南门', 100, 22.517, 113.947, 3, 3, 'active', new Date().toISOString()
  )

  db.prepare('INSERT INTO aed_devices (id, name, address, lat, lng, distance, status, last_check, battery_level) VALUES (?,?,?,?,?,?,?,?,?)').run(
    'aed_001', '深圳湾公园 AED', '深圳湾公园南门', 22.517, 113.947, 80, 'available', '2025-05-01', 98)

  db.prepare("INSERT INTO news (id, title, type, category, time, location_name, location_lat, location_lng, tags, is_live, is_urgent) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
    'n001', '测试新闻标题', 'article', 'recommend', '2小时前', '深圳', 22.543, 114.058, '["测试"]', 0, 0)

  db.prepare('INSERT INTO courses (id, title, category, duration, completed, progress, icon) VALUES (?,?,?,?,?,?,?)').run(
    'course_001', 'CPR 基础', '知识库', '15分钟', 0, 0.5, '❤️')

  db.prepare('INSERT INTO volunteers (id, name, avatar, tier, points, rescue_count, city, rank_pos) VALUES (?,?,?,?,?,?,?,?)').run(
    'v001', '陆远', '陆', 'gold', 2340, 12, '深圳', 1)

  db.prepare("INSERT INTO rescue_records (id, type, date, location, role, squad, result) VALUES (?,?,?,?,?,?,?)").run(
    'rec_001', 'CPR', '2025-05-01', '深圳湾公园', '按压员', '["陆远","陈敏"]', '成功')

  db.prepare("INSERT INTO rescue_cases (id, title, summary, date, location, result, volunteers, body) VALUES (?,?,?,?,?,?,?,?)").run(
    'case_001', '心脏骤停救援', '测试摘要', '2025-05-01', '深圳湾公园', '成功', '["陆远"]', '详细记录')

  db.prepare("INSERT INTO atlas_cards (id, title, category, description, steps, icon) VALUES (?,?,?,?,?,?)").run(
    'atlas_001', 'CPR 心肺复苏', '基础技能', '测试描述', '["步骤1","步骤2"]', '❤️')
}

export { app }
export { clearAll } from '../db'
export { default as db } from '../db'
