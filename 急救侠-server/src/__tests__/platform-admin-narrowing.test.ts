/**
 * 平台管理员「收窄」机制回归。
 *
 * 把「收窄落地后不得再调用 backfillPlatformAdmins()」从**注释里的规则**变成**机制**：
 * 收窄脚本执行后置位 `app_meta.platform_admin_narrowing_done`，回填函数据此永久停用。
 *
 * 本文件断言两件事：
 * 1. 机制有效 —— 标记置位后回填返回 0，被降级的队长**不会被静默重新提权**；
 * 2. 机制不误伤 —— 标记未置位时回填仍照常生效（首次保权不受影响）。
 *
 * 另覆盖 CLI 的纯决策逻辑 `planDowngrade`（独立于 DB 与进程副作用）。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { db } from './setup'
import {
  backfillPlatformAdmins,
  getMeta,
  setMeta,
  PLATFORM_ADMIN_NARROWING_DONE_KEY,
} from '../db'
import { planDowngrade, type DowngradeSnapshot } from '../scripts/narrow-plan'

const KEY = PLATFORM_ADMIN_NARROWING_DONE_KEY

/** 插入一名「历史队长」（is_leader=1 且默认非平台管理员）。 */
function insertLegacyLeader(id: string, name: string): void {
  db.prepare(`INSERT INTO users (id, name, is_leader, is_platform_admin) VALUES (?, ?, 1, 0)`).run(
    id,
    name
  )
}

/** 读取某账号的 is_platform_admin。 */
function adminFlag(id: string): number {
  const row = db.prepare('SELECT is_platform_admin FROM users WHERE id = ?').get(id) as
    | { is_platform_admin: number }
    | undefined
  return row ? row.is_platform_admin : -1
}

describe('app_meta 表与迁移 037', () => {
  it('canonical schema 含 app_meta，且迁移 037 被记录', () => {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'")
      .get() as { name: string } | undefined
    expect(table?.name).toBe('app_meta')

    const applied = db
      .prepare('SELECT id FROM _migrations WHERE id = ?')
      .get('037_add_app_meta') as { id: string } | undefined
    expect(applied?.id).toBe('037_add_app_meta')
  })

  it('getMeta 对不存在的键返回 null；setMeta upsert 可覆盖', () => {
    expect(getMeta('__definitely_missing__')).toBeNull()
    setMeta('demo_key', 'v1')
    expect(getMeta('demo_key')).toBe('v1')
    setMeta('demo_key', 'v2')
    expect(getMeta('demo_key')).toBe('v2')
  })
})

describe('收窄标记把回填从「规则」变为「机制」', () => {
  beforeEach(() => {
    db.exec('DELETE FROM users')
    db.exec('DELETE FROM app_meta')
  })
  afterEach(() => {
    // 兜底清理，避免污染同文件后续用例（全局 afterEach 亦会 resetSchema）。
    db.exec('DELETE FROM app_meta')
  })

  it('标记置位后：回填返回 0、不打 warn，被降级队长仍为 0（不被静默提权）', () => {
    insertLegacyLeader('u_narrowed', '被收窄的队长')
    // 模拟「运营已收窄」：标记置位。
    setMeta(KEY, '1')
    expect(getMeta(KEY)).toBe('1')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let count: number
    try {
      count = backfillPlatformAdmins()
    } finally {
      warn.mockRestore()
    }

    expect(count).toBe(0)
    expect(warn).not.toHaveBeenCalled()
    // 核心：降级不会被回填静默撤销。
    expect(adminFlag('u_narrowed')).toBe(0)
  })

  it('标记未置位时：回填仍照常生效（首次保权不受影响）', () => {
    insertLegacyLeader('u_legacy', '收窄前队长')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let count: number
    try {
      count = backfillPlatformAdmins()
    } finally {
      warn.mockRestore()
    }

    expect(count).toBe(1)
    expect(adminFlag('u_legacy')).toBe(1)
  })

  it('「先降级、再回填」的完整时序：账号保持 0（端到端机制证明）', () => {
    // 1) 队长先被保权为平台管理员（快照：is_leader=1, is_platform_admin=1）
    db.prepare(`INSERT INTO users (id, name, is_leader, is_platform_admin) VALUES (?, ?, 1, 1)`).run(
      'u_ops',
      '运营账号'
    )
    expect(adminFlag('u_ops')).toBe(1)

    // 2) 运营执行收窄：降级为普通用户 + 置位标记
    db.prepare('UPDATE users SET is_platform_admin = 0 WHERE id = ?').run('u_ops')
    setMeta(KEY, '1')
    expect(adminFlag('u_ops')).toBe(0)

    // 3) 之后任何一次回填都不再把它提权（即便它仍是 is_leader=1）
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(backfillPlatformAdmins()).toBe(0)
    } finally {
      warn.mockRestore()
    }
    expect(adminFlag('u_ops')).toBe(0)
  })
})

describe('CLI 决策逻辑 planDowngrade（纯函数，独立于 DB）', () => {
  const snapshot: DowngradeSnapshot = {
    existingIds: ['u1', 'u2', 'u3'],
    adminIds: ['u1', 'u2'],
  }

  it('空列表被拒，targets 为空', () => {
    const p = planDowngrade([], snapshot)
    expect(p.ok).toBe(false)
    expect(p.targets).toEqual([])
    expect(p.reason).toContain('用法错误')
  })

  it('含未知 id 被拒，且 targets 为空（整体中止，不半途生效）', () => {
    const p = planDowngrade(['u1', 'ghost'], snapshot)
    expect(p.ok).toBe(false)
    expect(p.reason).toContain('ghost')
    expect(p.targets).toEqual([])
  })

  it('会清零时默认被拒（自锁保护），加 --force 时放行', () => {
    const rejected = planDowngrade(['u1', 'u2'], snapshot)
    expect(rejected.ok).toBe(false)
    expect(rejected.wouldLeaveZero).toBe(true)
    expect(rejected.reason).toContain('--force')

    const forced = planDowngrade(['u1', 'u2'], snapshot, { force: true })
    expect(forced.ok).toBe(true)
    expect(forced.targets).toEqual(['u1', 'u2'])
    expect(forced.wouldLeaveZero).toBe(true)
  })

  it('正常情形返回正确目标集（去空白/去重）', () => {
    const p = planDowngrade([' u2 ', 'u2'], snapshot)
    expect(p.ok).toBe(true)
    expect(p.targets).toEqual(['u2'])
    expect(p.wouldLeaveZero).toBe(false)
  })
})
