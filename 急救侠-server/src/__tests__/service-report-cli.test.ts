/**
 * 覆盖补缺 #8（backend）· `scripts/service-report.ts` 的 `--user` / `--days` **过滤分支是否真的生效**。
 *
 * 为什么**起子进程**而不是 import：脚本顶层 `process.exit(main())` 会在 import 时终止测试进程。
 * 子进程方式验证的是**真实 CLI**（参数 → 输出），比 import 内部函数更强（不会"只解析了参数"却假绿）。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f4-rep-'))
const dbFile = path.join(tmpDir, 'report.db')
const TSX = path.join(process.cwd(), 'node_modules', '.bin', 'tsx')
const SCRIPT = 'src/scripts/service-report.ts'

const DAY = 24 * 60 * 60 * 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any

/** 跑一次真实 CLI，返回 { status, stdout, stderr }。 */
function runCli(args: string[]) {
  const r = spawnSync(TSX, [SCRIPT, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DB_PATH: dbFile },
    encoding: 'utf8',
  })
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }
}

/** 从摘要行 `（参与行 N 行；台账 M 行；cutoff …）` 取台账行数。 */
function ledgerCount(out: string): number {
  const m = /台账 (\d+) 行/.exec(out)
  if (!m) throw new Error(`输出里找不到台账行数：\n${out}`)
  return Number(m[1])
}
function participantCount(out: string): number {
  const m = /参与行 (\d+) 行/.exec(out)
  if (!m) throw new Error(`输出里找不到参与行数：\n${out}`)
  return Number(m[1])
}

describe('补缺 #8 · service-report CLI 的 --user / --days 过滤真实生效', () => {
  beforeAll(async () => {
    process.env.DB_PATH = dbFile
    vi.resetModules()
    const mod = await import('../db')
    db = mod.default
    mod.initDb({ silent: true })

    const now = Date.now()
    // users（FK 开启 ⇒ 先建）
    db.prepare("INSERT INTO users (id, name) VALUES ('u1', 'U1')").run()
    db.prepare("INSERT INTO users (id, name) VALUES ('u2', 'U2')").run()
    // 台账：u1 近 10 天（救援 + 演习）、u2 100 天前（救援）
    const ins = db.prepare(
      `INSERT INTO volunteer_service_logs
         (id, user_id, activity_type, source_type, source_ref, started_at_ms, ended_at_ms,
          duration_min, is_drill, status, org_id, created_by, voided_at_ms, void_reason, created_at_ms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,'',?)`
    )
    ins.run('l1', 'u1', 'rescue_task', 'system', 't1', now - 10 * DAY, now - 10 * DAY + 60000, 1, 0, 'confirmed', '', '', now - 10 * DAY)
    ins.run('l2', 'u2', 'rescue_task', 'system', 't2', now - 100 * DAY, now - 100 * DAY + 60000, 1, 0, 'confirmed', '', '', now - 100 * DAY)
    ins.run('l3', 'u1', 'drill', 'manual', '', now - 10 * DAY, now - 10 * DAY + 60000, 1, 1, 'confirmed', '', '', now - 10 * DAY)
    db.close()
  })

  afterAll(() => {
    process.env.DB_PATH = ':memory:'
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('无过滤 ⇒ 台账 3 行', () => {
    const r = runCli([])
    expect(r.status, r.stderr).toBe(0)
    expect(ledgerCount(r.stdout)).toBe(3)
  })

  it('★ --days 30 ⇒ 只计近 30 天（台账 2 行、参与行 0）', () => {
    const r = runCli(['--days', '30'])
    expect(r.status, r.stderr).toBe(0)
    expect(ledgerCount(r.stdout)).toBe(2)
    expect(participantCount(r.stdout)).toBe(0)
  })

  it('★ --user u2 ⇒ 只计该账号（台账 1 行）', () => {
    const r = runCli(['--user', 'u2'])
    expect(r.status, r.stderr).toBe(0)
    expect(ledgerCount(r.stdout)).toBe(1)
  })

  it('★ --user u1 --days 30 ⇒ 两过滤同时生效（台账 2 行）', () => {
    const r = runCli(['--user', 'u1', '--days', '30'])
    expect(r.status, r.stderr).toBe(0)
    expect(ledgerCount(r.stdout)).toBe(2)
  })

  it('★ --user u2 --days 30 ⇒ 交集为空（台账 0 行）', () => {
    const r = runCli(['--user', 'u2', '--days', '30'])
    expect(r.status, r.stderr).toBe(0)
    expect(ledgerCount(r.stdout)).toBe(0)
  })

  it('★ --days 0 ⇒ 用法错误（退出码 2，提示需要正数；绝不静默当成"全部"）', () => {
    const r = runCli(['--days', '0'])
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/正数/)
  })
})
