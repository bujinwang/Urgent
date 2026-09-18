/**
 * T05 独立验证（QA 第二双眼睛）—— 迁移实机（T16）+ CLI（service:purge / service:report）。
 *
 * 与实现方 `service-migration-legacy.test.ts` **完全独立**，并**补强两处**：
 *  - 迁移：旧库中**含同 (user,period) 的重复 active 证明** ⇒ 用**真实 runner** 验证 045 的
 *    「先去重、再建唯一索引」（实现方的用例只覆盖了「无重复」的旧库）。
 *  - CLI：用**真实子进程**（`node_modules/.bin/tsx`）驱动，端到端验证
 *    `--dry-run` / 默认不删 / `--confirm` 真删 / 参数边界 / 零分母三行。
 *
 * ⚠️ 本文件**不 import `./setup`**（它会强制 `DB_PATH=':memory:'`）；改为**先设 `DB_PATH`
 * 再动态 import + `vi.resetModules()`**，并在 afterAll 还原 `DB_PATH=':memory:'`。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'

const MIGRATION_IDS = [
  '041_add_task_volunteers',
  '042_add_volunteer_service_logs',
  '043_add_service_certificates',
  '044_add_task_arrival_void',
  '045_add_service_cert_active_dedup',
  '046_add_task_rejoin_count',
]

/** 定位 server 根（tsx 可执行所在），兼容 cwd 为仓库根或 server 子目录。 */
function resolveServerDir(): string {
  const cwd = process.cwd()
  if (fs.existsSync(path.join(cwd, 'node_modules', '.bin', 'tsx'))) return cwd
  const alt = path.join(cwd, '急救侠-server')
  if (fs.existsSync(path.join(alt, 'node_modules', '.bin', 'tsx'))) return alt
  return cwd
}
const SERVER_DIR = resolveServerDir()
const TSX = path.join(SERVER_DIR, 'node_modules', '.bin', 'tsx')

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Loaded { db: any; initDb: (o?: { silent?: boolean }) => void; recordService: (i: any) => any }

/** 在指定 `DB_PATH` 下重新加载 `db` / `serviceLog`（每次调用都拿到全新模块图）。 */
async function loadModules(dbPath: string): Promise<Loaded> {
  process.env.DB_PATH = dbPath
  vi.resetModules()
  const dbMod = await import('../db')
  const svcMod = await import('../services/serviceLog')
  return { db: dbMod.default, initDb: dbMod.initDb, recordService: svcMod.recordService }
}

/** 以真实子进程运行 CLI 脚本。 */
function runCli(script: string, args: string[], dbPath: string) {
  return spawnSync(TSX, [`src/scripts/${script}`, ...args], {
    cwd: SERVER_DIR,
    env: { ...process.env, DB_PATH: dbPath },
    encoding: 'utf8',
  })
}

/* ───────────────────────── 迁移实机（T16） ───────────────────────── */
describe('T16-QA · 迁移实机：旧库 → 真实 runner 上 041–046（含 045 去重）', () => {
  let db: any
  let initDb: (o?: { silent?: boolean }) => void
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f4-t05qa-mig-'))
  const file = path.join(dir, 'legacy.db')

  beforeAll(async () => { ({ db, initDb } = await loadModules(file)) })
  afterAll(() => {
    try { db?.close?.() } catch { /* ignore */ }
    process.env.DB_PATH = ':memory:'
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const runCapture = (): string[] => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => { /* 静音 */ })
    try { initDb(); return spy.mock.calls.map((c) => String(c[0])) } finally { spy.mockRestore() }
  }

  it('旧库（含重复 active 证明）⇒ 041–046 全部 applied，列/表/索引/去重/记录到位，且幂等', () => {
    initDb({ silent: true })
    db.prepare("INSERT OR IGNORE INTO users (id, name) VALUES ('u_legacy','旧用户')").run()

    // —— 仿真 v1.0 / 半升级旧库：三张 F4 表回到旧形状，_migrations 缺 041–046 ——
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
      DROP TABLE IF EXISTS volunteer_service_logs;
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
    // 同 (u_legacy, 0, 100) 三条 active（旧行为允许重复）+ 另一区间一条 active
    const ins = db.prepare(
      `INSERT INTO service_certificates
         (id,user_id,cert_no,period_from_ms,period_to_ms,total_minutes,breakdown_json,issued_at_ms,issued_by,status,revoked_at_ms,revoke_reason)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    ins.run('sc_a', 'u_legacy', 'VS-A', 0, 100, 30, '[]', 100, 'self', 'active', null, '')
    ins.run('sc_b', 'u_legacy', 'VS-B', 0, 100, 30, '[]', 200, 'self', 'active', null, '')
    ins.run('sc_c', 'u_legacy', 'VS-C', 0, 100, 30, '[]', 300, 'self', 'active', null, '')
    ins.run('sc_d', 'u_legacy', 'VS-D', 0, 200, 45, '[]', 150, 'self', 'active', null, '')
    db.prepare("DELETE FROM _migrations WHERE substr(id,1,3) BETWEEN '041' AND '046'").run()

    // —— 真实 runner ——
    const logs = runCapture()
    for (const id of MIGRATION_IDS) {
      expect(logs.some((l) => l.includes(`Migration applied: ${id}`)), `应 applied（非 skipped）: ${id}`).toBe(true)
      expect(logs.some((l) => l.includes('Migration skipped') && l.includes(id)), `不应 skipped: ${id}`).toBe(false)
    }

    // —— 结构确实升级 ——
    const tvCols = (db.prepare('PRAGMA table_info(task_volunteers)').all() as Array<{ name: string }>).map((c) => c.name)
    expect(tvCols).toEqual(expect.arrayContaining(['arrived_at_ms', 'voided_at_ms', 'void_reason', 'rejoin_count']))
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='volunteer_service_logs'").get()).toBeTruthy()
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_scert_active_dedup'").get()).toBeTruthy()

    // —— 045 真去重：同 (user,period) 仅保留 issued_at_ms 最早的一条 active ——
    const act = (db.prepare(
      "SELECT id FROM service_certificates WHERE user_id='u_legacy' AND period_from_ms=0 AND period_to_ms=100 AND status='active' ORDER BY issued_at_ms"
    ).all() as Array<{ id: string }>).map((r) => r.id)
    expect(act).toEqual(['sc_a'])
    expect((db.prepare(
      "SELECT COUNT(*) AS c FROM service_certificates WHERE status='revoked' AND revoke_reason='auto-dedup (migration 045)'"
    ).get() as { c: number }).c).toBe(2)
    expect(db.prepare("SELECT status FROM service_certificates WHERE id='sc_d'").get()).toEqual({ status: 'active' })

    // —— _migrations 记录齐全 ——
    const rec = (db.prepare("SELECT id FROM _migrations WHERE substr(id,1,3) BETWEEN '041' AND '046'").all() as Array<{ id: string }>).map((r) => r.id)
    expect(rec.sort()).toEqual([...MIGRATION_IDS].sort())

    // —— 幂等：再跑一次 → 已记录者**静默 continue**（既非 applied、也非 skipped，不打日志），去重状态不变 ——
    const logs2 = runCapture()
    for (const id of MIGRATION_IDS) {
      expect(logs2.some((l) => l.includes(`Migration applied: ${id}`)), `二次应不再 applied: ${id}`).toBe(false)
      expect(logs2.some((l) => l.includes('Migration skipped') && l.includes(id)), `二次不应报 skipped（已记录者静默跳过）: ${id}`).toBe(false)
    }
    expect((db.prepare("SELECT COUNT(*) AS c FROM service_certificates WHERE status='active'").get() as { c: number }).c).toBe(2)
  })
})

/* ───────────────────────── CLI · purge ───────────────────────── */
describe('T05-QA · CLI service:purge（真实子进程）', () => {
  let db: any
  let initDb: (o?: { silent?: boolean }) => void
  let recordService: (i: any) => any
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f4-t05qa-purge-'))
  const file = path.join(dir, 'cli.db')

  beforeAll(async () => {
    const m = await loadModules(file)
    db = m.db; initDb = m.initDb; recordService = m.recordService
  })
  afterAll(() => {
    try { db?.close?.() } catch { /* ignore */ }
    process.env.DB_PATH = ':memory:'
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const count = (sql: string): number => (db.prepare(sql).get() as { c: number }).c

  it('dry-run+confirm 不删；默认不删；--confirm 仅删过期台账、证明永存', () => {
    initDb({ silent: true })
    db.prepare("INSERT INTO users (id,name) VALUES ('u1','甲')").run()
    const nowMs = Date.now()
    // logA：写入时刻=now（保留期内）；服务时刻=很久以前 —— 验证保留期按 created_at_ms
    recordService({ userId: 'u1', activityType: 'rescue_task', sourceRef: 'qa_keep', startedAtMs: 1, endedAtMs: 1 + 30 * 60000, now: nowMs })
    // logB：写入时刻=1（过期）；服务时刻=now
    recordService({ userId: 'u1', activityType: 'rescue_task', sourceRef: 'qa_del', startedAtMs: nowMs, endedAtMs: nowMs + 30 * 60000, now: 1 })
    // 权益凭证（证明）：永不被清理
    db.prepare(
      `INSERT INTO service_certificates
         (id,user_id,cert_no,period_from_ms,period_to_ms,total_minutes,breakdown_json,issued_at_ms,issued_by,status,revoked_at_ms,revoke_reason)
       VALUES ('sc_keep','u1','VS-KEEP',0,1,30,'[]',1,'self','active',NULL,'')`
    ).run()

    const logsCount = () => count('SELECT COUNT(*) AS c FROM volunteer_service_logs')
    const proofCount = () => count("SELECT COUNT(*) AS c FROM service_certificates WHERE cert_no='VS-KEEP'")

    // ① --dry-run + --confirm ⇒ 什么都不删（dry-run 优先）
    const r1 = runCli('service-purge.ts', ['--days', '30', '--dry-run', '--confirm'], file)
    expect(r1.status).toBe(0)
    expect(r1.stdout).toContain('DRY-RUN')
    expect(logsCount()).toBe(2)
    expect(proofCount()).toBe(1)

    // ② 默认（无 --confirm）⇒ 什么都不删
    const r2 = runCli('service-purge.ts', ['--days', '30'], file)
    expect(r2.status).toBe(0)
    expect(r2.stdout).toContain('默认不删')
    expect(logsCount()).toBe(2)
    expect(proofCount()).toBe(1)

    // ③ --confirm ⇒ 真删过期台账（按 created_at_ms），证明仍在
    const r3 = runCli('service-purge.ts', ['--days', '30', '--confirm'], file)
    expect(r3.status).toBe(0)
    expect(r3.stdout).toContain('已清理台账')
    expect(logsCount()).toBe(1) // logB 被删、logA 保留
    expect(count("SELECT COUNT(*) AS c FROM volunteer_service_logs WHERE source_ref='qa_del'")).toBe(0)
    expect(count("SELECT COUNT(*) AS c FROM volunteer_service_logs WHERE source_ref='qa_keep'")).toBe(1)
    expect(proofCount()).toBe(1) // ★ 权益凭证永存（D7）
    expect(r3.stdout).toContain('证明记录')
  })

  it('参数边界：--days 非法 / 未知参数 ⇒ exit 2；--help ⇒ exit 0', () => {
    const bad1 = runCli('service-purge.ts', ['--days', 'abc'], file)
    expect(bad1.status).toBe(2)
    expect(bad1.stderr).toContain('--days 需要一个正数')

    const bad2 = runCli('service-purge.ts', ['--days', '-5'], file)
    expect(bad2.status).toBe(2)

    const bad3 = runCli('service-purge.ts', ['--bogus'], file)
    expect(bad3.status).toBe(2)
    expect(bad3.stderr).toContain('未知参数')

    const help = runCli('service-purge.ts', ['--help'], file)
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('证明记录')
  })
})

/* ───────────────────────── CLI · report ───────────────────────── */
describe('T05-QA · CLI service:report（零分母 + 正向对照）', () => {
  let db: any
  let initDb: (o?: { silent?: boolean }) => void
  let recordService: (i: any) => any
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f4-t05qa-report-'))
  const file = path.join(dir, 'report.db')

  beforeAll(async () => {
    const m = await loadModules(file)
    db = m.db; initDb = m.initDb; recordService = m.recordService
  })
  afterAll(() => {
    try { db?.close?.() } catch { /* ignore */ }
    process.env.DB_PATH = ':memory:'
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('无样本 ⇒ 三行均为「—（无样本）」，无 NaN、无假 0', () => {
    initDb({ silent: true })
    const r = runCli('service-report.ts', [], file)
    expect(r.status).toBe(0)
    const out = r.stdout
    expect((out.match(/—（无样本）/g) || []).length).toBe(3)
    expect(out).not.toContain('NaN')
    expect(out).not.toContain('0.0%')
    expect(out).toContain('可归因率')
    expect(out).toContain('未闭合率')
    expect(out).toContain('演习污染率')
  })

  it('有样本 ⇒ 三指标真算（正向对照，证明不是恒「—」）', () => {
    initDb({ silent: true })
    db.prepare("INSERT INTO users (id,name) VALUES ('u1','甲')").run()
    db.prepare("INSERT INTO users (id,name) VALUES ('u2','乙')").run()
    db.prepare(
      "INSERT INTO tasks (id,type,address,distance,lat,lng,volunteers_needed,volunteers_responded,status,created_at) VALUES ('t1','cpr','x',1,0,0,1,1,'active','2026-01-01')"
    ).run()
    // 参与行：未闭合 ⇒ 可归因率 0/1、未闭合率 1/1
    db.prepare("INSERT INTO task_volunteers (id,task_id,user_id,responded_at_ms,ended_at_ms,status) VALUES ('tv1','t1','u1',?,NULL,'responded')").run(Date.now())
    // 台账：u2 / 不匹配 task ⇒ 不影响可归因；is_drill=0 ⇒ 演习污染率 0/1
    const now = Date.now()
    recordService({ userId: 'u2', activityType: 'rescue_task', sourceRef: 'x1', startedAtMs: now, endedAtMs: now + 30 * 60000, now })

    const r = runCli('service-report.ts', [], file)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('0.0%（0/1）')   // 可归因率 & 演习污染率
    expect(r.stdout).toContain('100.0%（1/1）') // 未闭合率
    expect(r.stdout).not.toContain('NaN')
  })
})
