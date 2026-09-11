import db from '../db'

/**
 * Write an AED audit log entry.
 *
 * 抽自 `routes/aed.ts` 的内联实现，**行为保持不变**（同一张 `aed_audit_log` 表、
 * 同一 id 前缀 `al_`、失败静默）。供 aed 路由与「责任人联动」路由共用，避免重复。
 *
 * @param aedId       设备 id
 * @param eventType   事件类型（如 custodian_notified / custodian_acknowledged ...）
 * @param description 可读描述
 * @param userId      触发者 id
 * @param userName    触发者姓名
 * @param oldValue    变更前值（可选）
 * @param newValue    变更后值（可选）
 */
export function logAudit(
  aedId: string,
  eventType: string,
  description: string,
  userId: string,
  userName: string,
  oldValue?: string,
  newValue?: string,
): void {
  try {
    db.prepare(
      'INSERT INTO aed_audit_log (id, aed_id, event_type, description, user_id, user_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      'al_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      aedId, eventType, description, userId, userName, oldValue || '', newValue || ''
    )
  } catch (_) { /* non-critical */ }
}
