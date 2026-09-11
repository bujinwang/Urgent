/**
 * 平台管理员「收窄」的**纯决策逻辑**。
 *
 * 从 CLI（`narrow-platform-admins.ts`）中抽出，原因有二：
 * 1. 决策规则（空列表 / 未知 id / 会清零）应可**独立单测**，不受 DB 与进程副作用影响；
 * 2. 本模块**不 import `db`**，因此可被测试安全导入（CLI 顶层会 `initDb()` 并可能
 *    `process.exit()`，直接 import CLI 会产生副作用）。
 *
 * 本函数为**纯函数**：只依据入参快照做判定，不读写数据库、不打印、不退出。
 * 「当前状态」由调用方以 {@link DowngradeSnapshot} 显式注入。
 */

/** 决策所需的当前状态快照（由调用方从数据库读取后注入）。 */
export interface DowngradeSnapshot {
  /** `users` 表中全部已存在的用户 id。 */
  existingIds: string[]
  /** 当前 `is_platform_admin = 1` 的用户 id。 */
  adminIds: string[]
}

/** 收窄计划的判定结果。 */
export interface DowngradePlan {
  /** 是否允许执行；`false` 时 CLI 应以退出码 2 中止。 */
  ok: boolean
  /** `ok = false` 时的原因（面向运维的中文提示）；`ok = true` 时为空串。 */
  reason: string
  /** 通过校验后待降级的用户 id（去重、去空白）；被拒时恒为 `[]`（不半途生效）。 */
  targets: string[]
  /** 执行后平台管理员总数是否会变为 0（自锁保护触发条件）。 */
  wouldLeaveZero: boolean
}

/**
 * 规划一次 `--downgrade` 操作。
 *
 * 规则（按优先级）：
 * 1. 空列表 → 拒绝（用法错误）。
 * 2. 含未知 id → 拒绝，且 `targets` 为空（**整体中止，避免半途生效**）。
 * 3. 会导致平台管理员清零 → 未加 `--force` 时拒绝；加 `--force` 时放行（自锁保护）。
 * 4. 其余 → 放行，`targets` 为去重后的 id 集合。
 *
 * @param ids      待降级的用户 id（可能含空白/重复）
 * @param snapshot 当前数据库状态快照
 * @param options  `force` 为 `true` 时放行「会清零」的操作
 */
export function planDowngrade(
  ids: string[],
  snapshot: DowngradeSnapshot,
  options: { force?: boolean } = {}
): DowngradePlan {
  const unique = Array.from(new Set(ids.map((s) => s.trim()).filter((s) => s.length > 0)))

  if (unique.length === 0) {
    return {
      ok: false,
      reason: '用法错误：--downgrade 需要至少一个用户 id（逗号分隔，如 --downgrade u_1,u_2）',
      targets: [],
      wouldLeaveZero: false,
    }
  }

  const existing = new Set(snapshot.existingIds)
  const unknown = unique.filter((id) => !existing.has(id))
  if (unknown.length > 0) {
    return {
      ok: false,
      reason: `存在未知用户 id：${unknown.join(', ')}（已整体中止，未做任何修改）`,
      targets: [],
      wouldLeaveZero: false,
    }
  }

  // 剩余管理员 = 当前管理员中「不在本次降级名单里」的那些。
  // 若为空，说明本次操作会把平台管理员清零（自锁）。
  const downgradeSet = new Set(unique)
  const remainingAdmins = snapshot.adminIds.filter((id) => !downgradeSet.has(id))
  const wouldLeaveZero = remainingAdmins.length === 0

  if (wouldLeaveZero && !options.force) {
    return {
      ok: false,
      reason:
        '该操作会导致平台管理员数量变为 0（自锁保护）；如确需清零请追加 --force。',
      targets: unique,
      wouldLeaveZero: true,
    }
  }

  return { ok: true, reason: '', targets: unique, wouldLeaveZero }
}
