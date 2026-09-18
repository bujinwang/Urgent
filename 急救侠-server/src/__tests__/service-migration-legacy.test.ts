/**
 * T16（★ T05）· **迁移实机验证：旧库升级**（`:memory:` 测不出这一层）。
 *
 * 为什么必须单独测：单测跑 `:memory:` 时，**canonical schema 已建好全部表/列** ⇒ 迁移 041–046
 * **恒为 skipped** ⇒ **"既有库真正升级"这条路径从未被测过**。本文件用一个**真实文件库**模拟
 * **v1.0 旧库**（`task_volunteers`/`service_certificates` 是**旧形状**、`_migrations` 缺 041–046），
 * 再跑真实 `initDb()`，断言日志出现 `Migration applied: 041…046`（**非 skipped**）且结构确实被升级。
 *
 * ⚠️ 本文件**不 import `./setup`**（它会强制 `DB_PATH=':memory:'`）；改为**先设 `DB_PATH` 再动态 import**，
 * 并用 `vi.resetModules()` 保证 `config/db` 在**新 `DB_PATH`** 下重新求值。`afterAll` 恢复 `DB_PATH`。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f4-mig-'))
const dbFile = path.join(tmpDir, 'legacy.db')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any
let initDb: (options?: { silent?: boolean }) => void

const MIGRATION_IDS = [
  '041_add_task_volunteers',
  '042_add_volunteer_service_logs',
  '043_add_service_certificates',
  '044_add_task_arrival_void',
  '045_add_service_cert_active_dedup',
  '046_add_task_rejoin_count',
]

/** 在 mock 掉 console.log 的情况下跑 initDb，返回日志行。 */
function runAndCaptureLogs(): string[] {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => { /* 静音 */ })
  try {
    initDb()
    return spy.mock.calls.map((c) => String(c[0]))
  } finally {
    spy.mockRestore()
  }
}

describe('T16 · 迁移实机验证：v1.0 旧库 → 上 041–046', () => {
  beforeAll(async () => {
    process.env.DB_PATH = dbFile
    vi.resetModules()
    const mod = await import('../db')
    db = mod.default
    initDb = mod.initDb
  })

  afterAll(() => {
    try { db?.close?.() } catch { /* ignore */ }
    process.env.DB_PATH = ':memory:' // 还原（同进程后续文件依赖 setup.ts 重设，但双保险）
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('旧库启动 ⇒ 041–046 全部 `Migration applied`（非 skipped），且结构与记录到位', () => {
    // 1) 初始建库（记录全部迁移）—— 静音
    runAndCaptureLogs()

    // 2) 剥离 F4 产物 → 仿真 v1.0 旧库：
    //    task_volunteers 回到「两时刻」旧形状；service_certificates 回到旧形状（无去重索引）。
    db.exec(`
      DROP TABLE IF EXISTS task_volunteers;
      CREATE TABLE task_volunteers (
        id               TEXT PRIMARY KEY,
        task_id          TEXT NOT NULL,
        user_id          TEXT NOT NULL,
        responded_at_ms  INTEGER NOT NULL,
        ended_at_ms      INTEGER,
        status           TEXT NOT NULL DEFAULT 'responded',
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(task_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_tv_task ON task_volunteers(task_id);
    `)
    db.exec(`
      DROP TABLE IF EXISTS service_certificates;
      CREATE TABLE service_certificates (
        id             TEXT PRIMARY KEY,
        user_id        TEXT NOT NULL,
        cert_no        TEXT NOT NULL,
        period_from_ms INTEGER NOT NULL,
        period_to_ms   INTEGER NOT NULL,
        total_minutes  INTEGER NOT NULL,
        breakdown_json TEXT NOT NULL DEFAULT '{}',
        issued_at_ms   INTEGER NOT NULL,
        issued_by      TEXT NOT NULL DEFAULT 'self',
        status         TEXT NOT NULL DEFAULT 'active',
        revoked_at_ms  INTEGER,
        revoke_reason  TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_scert_no ON service_certificates(cert_no);
      CREATE INDEX IF NOT EXISTS idx_scert_user ON service_certificates(user_id, issued_at_ms DESC);
    `)
    // 只删 041–046 的记录（`040_add_sos_events` 保留）
    db.prepare("DELETE FROM _migrations WHERE substr(id, 1, 3) >= '041' AND substr(id, 1, 3) <= '046'").run()

    // 3) 再次启动（真实迁移）
    const logs = runAndCaptureLogs()

    // 4) 断言 041–046 全部 applied（且非 skipped）
    for (const id of MIGRATION_IDS) {
      expect(logs.some((l) => l.includes(`Migration applied: ${id}`)), `应 applied: ${id}`).toBe(true)
      expect(logs.some((l) => l.includes('Migration skipped') && l.includes(id)), `不应 skipped: ${id}`).toBe(false)
    }

    // 5) 结构确实被升级（列/索引都在）
    const cols = (db.prepare('PRAGMA table_info(task_volunteers)').all() as Array<{ name: string }>).map((c) => c.name)
    expect(cols).toEqual(expect.arrayContaining(['arrived_at_ms', 'voided_at_ms', 'void_reason', 'rejoin_count']))
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_scert_active_dedup'").get()).toBeTruthy()

    // 6) `_migrations` 记录了 041–046
    const applied = (db.prepare("SELECT id FROM _migrations WHERE substr(id, 1, 3) >= '041' AND substr(id, 1, 3) <= '046'").all() as Array<{ id: string }>).map((r) => r.id)
    expect(applied.sort()).toEqual([...MIGRATION_IDS].sort())
  })
})
