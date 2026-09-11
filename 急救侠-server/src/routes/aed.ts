import { Router, Request } from 'express'
import db, { get, all } from '../db'
import {
  success, error, AlertCode, CUSTODIAN_SLA_MS,
  CustodianNotifyInput, CustodianActionInput, ConsentRevokeInput,
  AedDevice, AedCheckin, AedDeviceInput, AedManager, AedMaintenance, AedPickup, AedAuditEvent, AedCertification,
} from '../types'
import type { AedCustodianAlert } from '../types'
import type {
  AedRow, AedCheckinRow, AedManagerRow, AedMaintenanceRow, AedPickupRow,
  AedAuditLogRow, AedCertificationRow, AedCustodianAlertRow, UserRow, CountRow,
} from '../types/rows'
import { authMiddleware, AuthPayload } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { logAudit } from '../services/aedAudit'
import { sendPushToUser, PUSH_TEMPLATES } from '../services/pushService'

export const aedRouter = Router()

/** 读取当前登录者 id（责任人联动各接口统一口径）。 */
function callerOf(req: Request): string {
  const a = (req as { auth?: AuthPayload }).auth
  return (a && (a.userId || a.openid)) || ''
}

/** 读取路由参数为字符串（`validate` 中间件会使 `req.params` 推导为 ParamsDictionary）。 */
function getParam(req: Request, name: string): string {
  const v = (req.params as Record<string, string | string[] | undefined>)[name]
  return Array.isArray(v) ? (v[0] || '') : (v || '')
}


function rowToDevice(row: AedRow): AedDevice {
  const checkins = all<AedCheckinRow>(
    'SELECT * FROM aed_checkins WHERE aed_id = ? ORDER BY date DESC',
    row.id
  )
  return {
    id: row.id, name: row.name, address: row.address,
    lat: row.lat, lng: row.lng, distance: row.distance,
    status: row.status, lastCheck: row.last_check,
    batteryLevel: row.battery_level,
    model: row.model || undefined,
    serialNumber: row.serial_number || undefined,
    batteryExpiry: row.battery_expiry || undefined,
    electrodeExpiry: row.electrode_expiry || undefined,
    lastMaintenance: row.last_maintenance || undefined,
    indoor: row.indoor === 1,
    floor: row.floor || undefined,
    openHours: row.open_hours || undefined,
    findingInstructions: row.finding_instructions || undefined,
    custodian: row.custodian_name ? {
      name: row.custodian_name,
      phone: row.custodian_phone,
      role: row.custodian_role,
    } : undefined,
    checkIns: checkins.map((ci: AedCheckinRow): AedCheckin => ({
      id: ci.id, aedId: ci.aed_id, userId: ci.user_id,
      userName: ci.user_name, photo: ci.photo,
      date: ci.date, status: ci.status,
      comment: ci.comment, findingTip: ci.finding_tip || undefined,
    })),
    reportedBy: row.reported_by || undefined,
    reportedAt: row.reported_at || undefined,
    isMobile: row.is_mobile === 1,
    linkedUserId: row.linked_user_id || undefined,
  }
}

/* ──── List & Detail ──── */

aedRouter.get('/nearby', (_req, res) => {
  try {
    const rows = all<AedRow>('SELECT * FROM aed_devices ORDER BY distance ASC')
    res.json(success(rows.map(rowToDevice)))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /api/aed/mine?userId=xxx — devices managed by this user
aedRouter.get('/mine', (req, res) => {
  try {
    const userId = (req.query.userId as string) || ''
    const rows = all<AedRow>(`
      SELECT DISTINCT ad.* FROM aed_devices ad
      JOIN aed_managers am ON am.aed_id = ad.id
      WHERE am.user_id = ?
      ORDER BY ad.distance ASC
    `, userId)
    const devices: Array<AedDevice & { activePickups: number }> =
      rows.map(rowToDevice).map(device => ({ ...device, activePickups: 0 }))
    // Attach pending alerts
    for (const d of devices) {
      const pickups = get<CountRow>(
        "SELECT COUNT(*) as cnt FROM aed_pickups WHERE aed_id = ? AND return_time IS NULL",
        d.id
      )
      d.activePickups = pickups?.cnt ?? 0
    }
    res.json(success(devices))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

aedRouter.get('/:id', (req, res) => {
  try {
    const row = get<AedRow>('SELECT * FROM aed_devices WHERE id = ?', req.params.id)
    if (!row) return res.json(error('AED 设备不存在'))
    res.json(success(rowToDevice(row)))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Admin CRUD ──── */

// POST /api/aed — add device
aedRouter.post('/', (req, res) => {
  try {
    const input = req.body as Record<string, any>
    const id = 'aed_' + Date.now()
    db.prepare(`
      INSERT INTO aed_devices (id, name, address, lat, lng, status, last_check,
        model, serial_number, battery_expiry, electrode_expiry, last_maintenance,
        indoor, floor, open_hours, finding_instructions,
        custodian_name, custodian_phone, custodian_role, reported_by, reported_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id, input.name, input.address, input.lat, input.lng, input.status || 'available',
      input.model || '', input.serialNumber || '', input.batteryExpiry || '',
      input.electrodeExpiry || '', input.lastMaintenance || '',
      input.indoor ? 1 : 0, input.floor || '', input.openHours || '',
      input.findingInstructions || '',
      input.custodianName || '', input.custodianPhone || '', input.custodianRole || '',
      input.reportedBy || '',
    )
    const row = get<AedRow>('SELECT * FROM aed_devices WHERE id = ?', id)!
    logAudit(id, 'device_created', `新增 AED: ${input.name}`, input.reportedBy || '', input.reportedBy || '')
    res.json(success(rowToDevice(row), 'AED 添加成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// PUT /api/aed/:id — update device
aedRouter.put('/:id', (req, res) => {
  try {
    const existing = get<AedRow>('SELECT * FROM aed_devices WHERE id = ?', req.params.id)
    if (!existing) return res.json(error('AED 设备不存在'))
    const input = req.body as Record<string, any>
    db.prepare(`
      UPDATE aed_devices SET
        name = ?, address = ?, lat = ?, lng = ?, status = ?,
        model = ?, serial_number = ?, battery_expiry = ?, electrode_expiry = ?,
        last_maintenance = ?, indoor = ?, floor = ?, open_hours = ?,
        finding_instructions = ?,
        custodian_name = ?, custodian_phone = ?, custodian_role = ?,
        reported_by = ?, reported_at = datetime('now')
      WHERE id = ?
    `).run(
      input.name ?? existing.name, input.address ?? existing.address,
      input.lat ?? existing.lat, input.lng ?? existing.lng,
      input.status ?? existing.status,
      input.model ?? existing.model, input.serialNumber ?? existing.serial_number,
      input.batteryExpiry ?? existing.battery_expiry,
      input.electrodeExpiry ?? existing.electrode_expiry,
      input.lastMaintenance ?? existing.last_maintenance,
      input.indoor != null ? (input.indoor ? 1 : 0) : existing.indoor,
      input.floor ?? existing.floor, input.openHours ?? existing.open_hours,
      input.findingInstructions ?? existing.finding_instructions,
      input.custodianName ?? existing.custodian_name,
      input.custodianPhone ?? existing.custodian_phone,
      input.custodianRole ?? existing.custodian_role,
      input.reportedBy ?? existing.reported_by,
      req.params.id,
    )
    if (input.lastCheck) {
      db.prepare('UPDATE aed_devices SET last_check = ? WHERE id = ?').run(input.lastCheck, req.params.id)
    }
    const row = get<AedRow>('SELECT * FROM aed_devices WHERE id = ?', req.params.id)!
    if (input.status && input.status !== existing.status) {
      logAudit(req.params.id, 'status_change', `状态变更: ${existing.status} → ${input.status}`, input.reportedBy || existing.reported_by, input.reportedBy || existing.reported_by, existing.status, input.status)
    }
    res.json(success(rowToDevice(row), 'AED 更新成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// DELETE /api/aed/:id — delete device
aedRouter.delete('/:id', (req, res) => {
  try {
    const existing = get<{ name: string }>('SELECT name FROM aed_devices WHERE id = ?', req.params.id)
    db.prepare('DELETE FROM aed_checkins WHERE aed_id = ?').run(req.params.id)
    db.prepare('DELETE FROM aed_devices WHERE id = ?').run(req.params.id)
    logAudit(req.params.id, 'device_deleted', `删除 AED: ${existing?.name || req.params.id}`, '', '')
    res.json(success(null, 'AED 已删除'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Checkins ──── */

// GET /api/aed/:id/checkins
aedRouter.get('/:id/checkins', (req, res) => {
  try {
    const rows = all<AedCheckinRow>(
      'SELECT * FROM aed_checkins WHERE aed_id = ? ORDER BY date DESC',
      req.params.id
    )
    const checkins: AedCheckin[] = rows.map(ci => ({
      id: ci.id, aedId: ci.aed_id, userId: ci.user_id,
      userName: ci.user_name, photo: ci.photo,
      date: ci.date, status: ci.status,
      comment: ci.comment, findingTip: ci.finding_tip || undefined,
    }))
    res.json(success(checkins))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/aed/:id/checkins — add checkin
aedRouter.post('/:id/checkins', (req, res) => {
  try {
    const { userId, userName, photo, status, comment, findingTip } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    const cid = 'ci_' + Date.now()
    db.prepare(
      'INSERT INTO aed_checkins (id, aed_id, user_id, user_name, photo, date, status, comment, finding_tip) VALUES (?, ?, ?, ?, ?, datetime(\'now\'), ?, ?, ?)'
    ).run(cid, req.params.id, userId, userName || '', photo || '', status || 'ok', comment || '', findingTip || '')
    db.prepare('UPDATE aed_devices SET last_check = datetime(\'now\') WHERE id = ?').run(req.params.id)
    logAudit(req.params.id, 'checkin', `志愿者 ${userName || userId} 打卡: ${status || 'ok'}`, userId, userName || '')
    res.json(success({ id: cid }, '打卡成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Managers ──── */

// GET /api/aed/:id/managers
aedRouter.get('/:id/managers', (req, res) => {
  try {
    const rows = all<AedManagerRow>(
      'SELECT * FROM aed_managers WHERE aed_id = ? ORDER BY role',
      req.params.id
    )
    const managers: AedManager[] = rows.map(r => ({
      id: r.id, aedId: r.aed_id, userId: r.user_id,
      userName: r.user_name, role: r.role, assignedAt: r.assigned_at,
    }))
    res.json(success(managers))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/aed/:id/managers
aedRouter.post('/:id/managers', (req, res) => {
  try {
    const { userId, userName, role } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    const mid = 'am_' + Date.now()
    db.prepare('INSERT OR IGNORE INTO aed_managers (id, aed_id, user_id, user_name, role) VALUES (?, ?, ?, ?, ?)').run(mid, req.params.id, userId, userName || '', role || 'primary')
    logAudit(req.params.id, 'manager_assigned', `指派管理者: ${userName || userId} (${role || 'primary'})`, userId, userName || '')
    res.json(success({ id: mid }, '管理者添加成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// DELETE /api/aed/:id/managers/:managerId
aedRouter.delete('/:id/managers/:managerId', (req, res) => {
  try {
    const mgr = get<AedManagerRow>('SELECT * FROM aed_managers WHERE id = ?', req.params.managerId)
    db.prepare('DELETE FROM aed_managers WHERE id = ?').run(req.params.managerId)
    if (mgr) logAudit(req.params.id, 'manager_removed', `移除管理者: ${mgr.user_name || mgr.user_id}`, mgr.user_id, mgr.user_name)
    res.json(success(null, '管理者已移除'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Maintenance ──── */

// GET /api/aed/:id/maintenance
aedRouter.get('/:id/maintenance', (req, res) => {
  try {
    const rows = all<AedMaintenanceRow>(
      'SELECT * FROM aed_maintenance WHERE aed_id = ? ORDER BY date DESC',
      req.params.id
    )
    const records: AedMaintenance[] = rows.map(r => ({
      id: r.id, aedId: r.aed_id, type: r.type,
      date: r.date, performedBy: r.performed_by,
      notes: r.notes, nextDue: r.next_due, createdAt: r.created_at,
    }))
    res.json(success(records))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/aed/:id/maintenance
aedRouter.post('/:id/maintenance', (req, res) => {
  try {
    const { type, date, performedBy, notes, nextDue } = req.body
    if (!type || !date) return res.json(error('type 和 date 不能为空'))
    const mid = 'mt_' + Date.now()
    db.prepare(
      'INSERT INTO aed_maintenance (id, aed_id, type, date, performed_by, notes, next_due) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(mid, req.params.id, type, date, performedBy || '', notes || '', nextDue || '')
    // Update device last_maintenance
    db.prepare('UPDATE aed_devices SET last_maintenance = ? WHERE id = ?').run(date, req.params.id)
    logAudit(req.params.id, 'maintenance', `${type}: ${notes || '无备注'} (执行人: ${performedBy || '-'})`, performedBy || '', performedBy || '')
    res.json(success({ id: mid }, '维护记录已添加'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Pickups ──── */

// GET /api/aed/:id/pickups
aedRouter.get('/:id/pickups', (req, res) => {
  try {
    const rows = all<AedPickupRow>(
      'SELECT * FROM aed_pickups WHERE aed_id = ? ORDER BY pickup_time DESC',
      req.params.id
    )
    const pickups: AedPickup[] = rows.map(r => ({
      id: r.id, aedId: r.aed_id, userId: r.user_id,
      userName: r.user_name, pickupTime: r.pickup_time,
      returnTime: r.return_time || null,
      missionId: r.mission_id || undefined,
      notes: r.notes || undefined,
      isReturned: r.return_time != null,
    }))
    res.json(success(pickups))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/aed/:id/pickups — pickup AED
aedRouter.post('/:id/pickups', (req, res) => {
  try {
    const { userId, userName, missionId, notes } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    const pid = 'pu_' + Date.now()
    db.prepare(
      'INSERT INTO aed_pickups (id, aed_id, user_id, user_name, mission_id, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(pid, req.params.id, userId, userName || '', missionId || '', notes || '')
    // Update device status
    db.prepare("UPDATE aed_devices SET status = 'in_use' WHERE id = ?").run(req.params.id)
    logAudit(req.params.id, 'pickup', `AED 被 ${userName || userId} 取用${missionId ? ' (任务: '+missionId+')' : ''}`, userId, userName || '', 'available', 'in_use')
    res.json(success({ id: pid }, 'AED 已取用'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// PUT /api/aed/:id/pickups/:pickupId — return AED
aedRouter.put('/:id/pickups/:pickupId', (req, res) => {
  try {
    db.prepare(
      'UPDATE aed_pickups SET return_time = datetime(\'now\'), notes = notes || ? WHERE id = ?'
    ).run(req.body.notes ? ' | 归还备注: ' + req.body.notes : '', req.params.pickupId)
    // Check if any active pickups remain
    const active = get<CountRow>(
      'SELECT COUNT(*) as cnt FROM aed_pickups WHERE aed_id = ? AND return_time IS NULL',
      req.params.id
    )?.cnt ?? 0
    if (active === 0) {
      db.prepare("UPDATE aed_devices SET status = 'available' WHERE id = ?").run(req.params.id)
    }
    logAudit(req.params.id, 'return', 'AED 已归还', '', '', 'in_use', active === 0 ? 'available' : 'in_use')
    res.json(success(null, 'AED 已归还'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Audit Log ──── */

// GET /api/aed/:id/audit
aedRouter.get('/:id/audit', (req, res) => {
  try {
    const rows = all<AedAuditLogRow>(
      'SELECT * FROM aed_audit_log WHERE aed_id = ? ORDER BY created_at DESC LIMIT 50',
      req.params.id
    )
    const events: AedAuditEvent[] = rows.map(r => ({
      id: r.id, aedId: r.aed_id, eventType: r.event_type,
      description: r.description, userId: r.user_id, userName: r.user_name,
      oldValue: r.old_value || undefined, newValue: r.new_value || undefined,
      createdAt: r.created_at,
    }))
    res.json(success(events))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Certifications ──── */

// GET /api/aed/:id/certifications
aedRouter.get('/:id/certifications', (req, res) => {
  try {
    const rows = all<AedCertificationRow>(
      'SELECT * FROM aed_certifications WHERE aed_id = ? ORDER BY expiry_date ASC',
      req.params.id
    )
    const certs: AedCertification[] = rows.map(r => ({
      id: r.id, aedId: r.aed_id, type: r.type, name: r.name,
      issuer: r.issuer, issueDate: r.issue_date, expiryDate: r.expiry_date,
      status: r.status, fileUrl: r.file_url || undefined, createdAt: r.created_at,
    }))
    res.json(success(certs))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/aed/:id/certifications
aedRouter.post('/:id/certifications', (req, res) => {
  try {
    const { type, name, issuer, issueDate, expiryDate, fileUrl, userId, userName } = req.body
    if (!name || !issueDate || !expiryDate) return res.json(error('name, issueDate, expiryDate 不能为空'))
    const cid = 'ac_' + Date.now()
    db.prepare(
      'INSERT INTO aed_certifications (id, aed_id, type, name, issuer, issue_date, expiry_date, file_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(cid, req.params.id, type || 'manufacturer', name, issuer || '', issueDate, expiryDate, fileUrl || '')
    logAudit(req.params.id, 'certification_added', `添加认证: ${name} (${type || 'manufacturer'})`, userId || '', userName || '')
    res.json(success({ id: cid }, '认证添加成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// DELETE /api/aed/:id/certifications/:certId
aedRouter.delete('/:id/certifications/:certId', (req, res) => {
  try {
    const cert = get<{ name: string }>('SELECT name FROM aed_certifications WHERE id = ?', req.params.certId)
    db.prepare('DELETE FROM aed_certifications WHERE id = ?').run(req.params.certId)
    if (cert) logAudit(req.params.id, 'certification_removed', `移除认证: ${cert.name}`, '', '')
    res.json(success(null, '认证已删除'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /api/aed/:id/lifecycle — full lifecycle overview
aedRouter.get('/:id/lifecycle', (req, res) => {
  try {
    const device = rowToDevice(get<AedRow>('SELECT * FROM aed_devices WHERE id = ?', req.params.id)!)
    const managers = all<AedManagerRow>('SELECT * FROM aed_managers WHERE aed_id = ?', req.params.id)
    const maintenance = all<AedMaintenanceRow>('SELECT * FROM aed_maintenance WHERE aed_id = ? ORDER BY date DESC', req.params.id)
    const pickups = all<AedPickupRow>('SELECT * FROM aed_pickups WHERE aed_id = ? ORDER BY pickup_time DESC LIMIT 10', req.params.id)
    const activePickups = get<CountRow>('SELECT COUNT(*) as cnt FROM aed_pickups WHERE aed_id = ? AND return_time IS NULL', req.params.id)?.cnt ?? 0
    const auditLog = all<AedAuditLogRow>('SELECT * FROM aed_audit_log WHERE aed_id = ? ORDER BY created_at DESC LIMIT 20', req.params.id)
    const certifications = all<AedCertificationRow>('SELECT * FROM aed_certifications WHERE aed_id = ? ORDER BY expiry_date ASC', req.params.id)

    res.json(success({
      device,
      managers: managers.map((r: AedManagerRow) => ({ id: r.id, userId: r.user_id, userName: r.user_name, role: r.role, assignedAt: r.assigned_at })),
      maintenance: maintenance.map((r: AedMaintenanceRow) => ({ id: r.id, type: r.type, date: r.date, performedBy: r.performed_by, notes: r.notes, nextDue: r.next_due })),
      recentPickups: pickups.map((r: AedPickupRow) => ({
        id: r.id, userId: r.user_id, userName: r.user_name,
        pickupTime: r.pickup_time, returnTime: r.return_time, isReturned: r.return_time != null,
      })),
      activePickups: activePickups,
      auditLog: auditLog.map((r: AedAuditLogRow) => ({
        id: r.id, eventType: r.event_type, description: r.description,
        userId: r.user_id, userName: r.user_name, createdAt: r.created_at,
      })),
      certifications: certifications.map((r: AedCertificationRow) => ({
        id: r.id, type: r.type, name: r.name, issuer: r.issuer,
        issueDate: r.issue_date, expiryDate: r.expiry_date, status: r.status,
      })),
    }))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Custodian linkage（AED 责任人实时联动 + 「确认授权」）────
 *
 * 语义：责任人「**确认授权**」，**不做物理开锁**；接口名为 unlock 仅为兼容指令生命周期，
 * 物理执行由未来 IoT 网关凭 unlock_token 承接。任何 UI / 响应禁止出现「已远程开锁」。
 * 通知范围：primary + backup **并行推送**，谁先确认谁生效（首个确认者锁定 alert）。
 */

/** 仍处于「待处理」的 alert 状态（超时惰性置 expired 的判定范围）。 */
const CUSTODIAN_PENDING_STATUSES: Array<AedCustodianAlertRow['status']> = ['pending', 'sent', 'unreachable']

function genAlertId(): string {
  return 'ca_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function genUnlockToken(): string {
  return 'ut_' + Math.random().toString(36).slice(2, 18)
}

/** 责任人身份锚点：该设备的**全部**管理者（primary 优先，其次 backup）。 */
function resolveCustodians(aedId: string): AedManagerRow[] {
  return all<AedManagerRow>(
    "SELECT * FROM aed_managers WHERE aed_id = ? ORDER BY CASE role WHEN 'primary' THEN 0 ELSE 1 END",
    aedId
  )
}

/** 行 → 对外的 camelCase 领域对象（不返回责任人手机号）。 */
function rowToAlert(row: AedCustodianAlertRow): AedCustodianAlert {
  return {
    id: row.id,
    aedId: row.aed_id,
    pickupId: row.pickup_id,
    status: row.status,
    channel: row.channel,
    requesterUserId: row.requester_user_id,
    requesterUserName: row.requester_user_name,
    custodianUserId: row.custodian_user_id,
    custodianName: row.custodian_name,
    custodianRole: row.custodian_role,
    notifyTimeMs: row.notify_time_ms,
    firstSentTimeMs: row.first_sent_time_ms,
    respondedTimeMs: row.responded_time_ms,
    slaDeadlineMs: row.sla_deadline_ms,
    responseLatencyMs: row.response_latency_ms,
    slaMet: row.sla_met === null ? null : row.sla_met === 1,
    unlockAction: row.unlock_action,
    unlockCommandStatus: row.unlock_command_status,
    deliveryState: row.delivery_state,
    consentGranted: row.consent_granted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * 惰性过期：任何读写 alert 前调用。超过 SLA 且仍未响应 → 置 `expired` 并写审计。
 * **不提前返回**：超时后迟到的「确认授权」仍受理（急救安全优先，届时 sla_met=0）。
 */
function refreshExpiry(row: AedCustodianAlertRow): AedCustodianAlertRow {
  if (CUSTODIAN_PENDING_STATUSES.includes(row.status) && Date.now() > row.sla_deadline_ms) {
    const now = Date.now()
    db.prepare("UPDATE aed_custodian_alerts SET status = 'expired', updated_at = ? WHERE id = ?").run(now, row.id)
    logAudit(row.aed_id, 'custodian_unreachable', `责任人超时未响应（SLA ${CUSTODIAN_SLA_MS}ms）`, '', '')
    return { ...row, status: 'expired', updated_at: now }
  }
  return row
}

// POST /api/aed/:id/notify-custodian — 急救者通知责任人（需 PIPL 同意）
aedRouter.post('/:id/notify-custodian', authMiddleware, validate(CustodianNotifyInput), async (req, res) => {
  try {
    const callerId = callerOf(req)
    const aedId = getParam(req, 'id')
    const body = req.body as CustodianNotifyInput

    // PIPL：必须显式同意
    if (body.consentGranted !== true) {
      return res.json(error('需先同意信息共享', AlertCode.CONSENT_REQUIRED))
    }

    const device = get<AedRow>('SELECT * FROM aed_devices WHERE id = ?', aedId)
    if (!device) return res.status(404).json(error('AED 设备不存在', AlertCode.DEVICE_NOT_FOUND))

    const managers = resolveCustodians(aedId)
    if (managers.length === 0) {
      // 不阻断急救：不落 alert，前端展示「直接取用并留痕」兜底指引
      return res.json(error('设备暂无责任人，可直接取用并留痕', AlertCode.NO_CUSTODIAN))
    }
    // 规格修正：primary + backup 并行推送；canonical（快照）取 primary，无则首个
    const canonical = managers[0]

    const now = Date.now()
    // KPI 起点：有 pickupId 时取「取用时刻」与 now 的较早值
    let notifyTimeMs = now
    if (body.pickupId) {
      const pickup = get<AedPickupRow>('SELECT * FROM aed_pickups WHERE id = ?', body.pickupId)
      if (!pickup) return res.status(404).json(error('取用记录不存在', AlertCode.PICKUP_NOT_FOUND))
      const parsed = Date.parse(pickup.pickup_time.replace(' ', 'T') + 'Z')
      if (!Number.isNaN(parsed)) notifyTimeMs = Math.min(now, parsed)
    }

    const requester = get<UserRow>('SELECT * FROM users WHERE id = ?', callerId)
    const alertId = genAlertId()
    const slaDeadlineMs = notifyTimeMs + CUSTODIAN_SLA_MS

    db.prepare(`INSERT INTO aed_custodian_alerts (
      id, aed_id, pickup_id, requester_user_id, requester_user_name, requester_user_phone,
      custodian_user_id, custodian_name, custodian_phone_snapshot, custodian_role,
      channel, status, notify_time_ms, sla_deadline_ms,
      consent_granted, consent_version, consent_at_ms, notes, created_at, updated_at
    ) VALUES (?,?,?,?,?,?, ?,?,?,?, ?,?,?,?, ?,?,?,?,?,?)`).run(
      alertId, aedId, body.pickupId || '', callerId, requester?.name || '', '',
      canonical.user_id, canonical.user_name || '', '', canonical.role,
      'push', 'pending', notifyTimeMs, slaDeadlineMs,
      1, body.consentVersion || 'v1', now, body.notes || '', now, now
    )

    // 定向推送：全部责任人并行（谁先确认谁生效）。最小必要字段（PIPL）
    const pushData = {
      thing1: { value: 'AED 求助' },
      thing2: { value: device.name },
      thing3: { value: requester?.name || '急救者' },
      thing4: { value: device.address || '' },
    }
    let delivered = false
    let anyHasSubscription = false
    for (const m of managers) {
      const r = await sendPushToUser(m.user_id, {
        templateId: PUSH_TEMPLATES.aedCustodianRequest,
        page: `pages/aed/custodian-alert?alertId=${alertId}&aedId=${aedId}`,
        data: pushData,
      })
      if (r.ok) delivered = true
      if (r.reason !== 'no_subscription') anyHasSubscription = true
    }

    const status: AedCustodianAlertRow['status'] = delivered ? 'sent' : 'unreachable'
    const deliveryState: AedCustodianAlertRow['delivery_state'] = delivered
      ? 'delivered'
      : anyHasSubscription ? 'failed' : 'no_subscription'

    db.prepare(
      'UPDATE aed_custodian_alerts SET status = ?, first_sent_time_ms = ?, delivery_state = ?, updated_at = ? WHERE id = ?'
    ).run(status, delivered ? now : null, deliveryState, now, alertId)

    logAudit(
      aedId,
      'custodian_notified',
      delivered
        ? `已通知责任人（${managers.length} 名，投递：${deliveryState}）`
        : `通知责任人未送达（${deliveryState}）`,
      callerId,
      requester?.name || ''
    )

    res.json(success({
      alertId,
      status,
      channel: 'push',
      custodian: { name: canonical.user_name || '', role: canonical.role },
      notifyTimeMs,
      slaDeadlineMs,
      commandStatus: 'not_issued',
      consentGranted: true,
      deliveryState,
    }, '已通知责任人'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/aed/:id/unlock — 责任人「确认授权 / 拒绝」（幂等；不做物理开锁）
aedRouter.post('/:id/unlock', authMiddleware, validate(CustodianActionInput), (req, res) => {
  try {
    const callerId = callerOf(req)
    const aedId = getParam(req, 'id')
    const body = req.body as CustodianActionInput

    const found = get<AedCustodianAlertRow>(
      'SELECT * FROM aed_custodian_alerts WHERE id = ? AND aed_id = ?',
      body.alertId, aedId
    )
    if (!found) return res.status(404).json(error('求助记录不存在', AlertCode.ALERT_NOT_FOUND))

    // 强校验责任人：primary / backup 均可
    const isCustodian = get<{ one: number }>(
      'SELECT 1 AS one FROM aed_managers WHERE aed_id = ? AND user_id = ? LIMIT 1',
      aedId, callerId
    )
    if (!isCustodian) return res.status(403).json(error('非该设备责任人', AlertCode.NOT_CUSTODIAN))

    // 惰性过期（不提前返回：允许事后授权）
    const alert = refreshExpiry(found)
    const now = Date.now()

    // 幂等 / 首确认锁定：
    // - 同一命令者重试同一动作 → 幂等 200（不覆盖 responded_time_ms，不重复计数）
    // - 其它人（或不同动作）→ 「该求助已响应」409（谁先确认谁生效）
    if (alert.responded_time_ms != null) {
      if (alert.responder_user_id === callerId && alert.unlock_action === body.action) {
        return res.json(success({
          alertId: alert.id,
          status: alert.status,
          unlockAction: alert.unlock_action,
          commandStatus: alert.unlock_command_status,
          unlockToken: alert.unlock_action === 'authorize' ? alert.unlock_token : undefined,
          respondedTimeMs: alert.responded_time_ms,
          responseLatencyMs: alert.response_latency_ms,
          slaMet: alert.sla_met === 1,
          idempotent: true,
        }, '该求助已响应'))
      }
      return res.status(409).json(error('该求助已被他人确认', AlertCode.ALREADY_RESPONDED))
    }

    const responseLatencyMs = now - alert.notify_time_ms
    const slaMet = responseLatencyMs <= CUSTODIAN_SLA_MS && alert.status !== 'expired'
    const unlockToken = body.action === 'authorize' ? genUnlockToken() : ''
    const newStatus: AedCustodianAlertRow['status'] = body.action === 'authorize' ? 'acknowledged' : 'rejected'
    const commandStatus: AedCustodianAlertRow['unlock_command_status'] = body.action === 'authorize' ? 'issued' : 'not_issued'

    db.prepare(`UPDATE aed_custodian_alerts SET
      status = ?, responded_time_ms = ?, response_latency_ms = ?, sla_met = ?,
      unlock_action = ?, unlock_command_status = ?, unlock_token = ?, responder_user_id = ?,
      notes = COALESCE(?, notes), updated_at = ?
      WHERE id = ?`).run(
      newStatus, now, responseLatencyMs, slaMet ? 1 : 0,
      body.action, commandStatus, unlockToken, callerId,
      body.notes ?? null, now,
      alert.id
    )

    const responder = get<UserRow>('SELECT * FROM users WHERE id = ?', callerId)
    if (body.action === 'authorize') {
      logAudit(aedId, 'custodian_acknowledged', `责任人 ${responder?.name || callerId} 已确认授权（用时 ${responseLatencyMs}ms）`, callerId, responder?.name || '')
      logAudit(aedId, 'unlock_issued', '已签发授权令牌（交由后续 IoT 网关承接，本期不执行物理操作）', callerId, responder?.name || '')
    } else {
      logAudit(aedId, 'custodian_rejected', `责任人 ${responder?.name || callerId} 已拒绝`, callerId, responder?.name || '')
    }

    res.json(success({
      alertId: alert.id,
      status: newStatus,
      unlockAction: body.action,
      commandStatus,
      unlockToken: body.action === 'authorize' ? unlockToken : undefined,
      respondedTimeMs: now,
      responseLatencyMs,
      slaMet,
    }, body.action === 'authorize' ? '责任人已确认授权，请取用 AED' : '责任人已拒绝'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /api/aed/custodian-alerts/pending — 责任人待处理求助（收件箱）
aedRouter.get('/custodian-alerts/pending', authMiddleware, (req, res) => {
  try {
    const callerId = callerOf(req)
    // 规格修正：primary + backup 均可在收件箱看到自己名下设备待处理的求助
    const rows = all<AedCustodianAlertRow>(`
      SELECT ca.* FROM aed_custodian_alerts ca
      JOIN aed_managers am ON am.aed_id = ca.aed_id
      WHERE am.user_id = ? AND ca.status IN ('pending','sent','unreachable')
      ORDER BY ca.notify_time_ms DESC
    `, callerId)
    const alerts = rows.map(r => rowToAlert(refreshExpiry(r)))
    res.json(success(alerts))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /api/aed/:id/custodian-alerts/:alertId — 状态回读（惰性过期）
aedRouter.get('/:id/custodian-alerts/:alertId', authMiddleware, (req, res) => {
  try {
    const row = get<AedCustodianAlertRow>(
      'SELECT * FROM aed_custodian_alerts WHERE id = ? AND aed_id = ?',
      getParam(req, 'alertId'), getParam(req, 'id')
    )
    if (!row) return res.status(404).json(error('求助记录不存在', AlertCode.ALERT_NOT_FOUND))
    res.json(success(rowToAlert(refreshExpiry(row))))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/aed/:id/custodian-alerts/:alertId/revoke-consent — 撤回信息共享（PIPL）
aedRouter.post('/:id/custodian-alerts/:alertId/revoke-consent', authMiddleware, validate(ConsentRevokeInput), (req, res) => {
  try {
    const callerId = callerOf(req)
    const aedId = getParam(req, 'id')
    const row = get<AedCustodianAlertRow>(
      'SELECT * FROM aed_custodian_alerts WHERE id = ? AND aed_id = ?',
      getParam(req, 'alertId'), aedId
    )
    if (!row) return res.status(404).json(error('求助记录不存在', AlertCode.ALERT_NOT_FOUND))

    // 仅「急救者本人」或「该设备责任人」可撤回
    const isRequester = row.requester_user_id === callerId
    const isCustodian = !!get<{ one: number }>(
      'SELECT 1 AS one FROM aed_managers WHERE aed_id = ? AND user_id = ? LIMIT 1',
      aedId, callerId
    )
    if (!isRequester && !isCustodian) {
      return res.status(403).json(error('无权撤回该求助的信息共享', AlertCode.NOT_CUSTODIAN))
    }

    const now = Date.now()
    db.prepare(
      'UPDATE aed_custodian_alerts SET consent_granted = 0, consent_revoked_at_ms = ?, updated_at = ? WHERE id = ?'
    ).run(now, now, row.id)
    logAudit(aedId, 'custodian_consent_revoked', '急救者撤回信息共享同意', callerId, '')

    res.json(success({ alertId: row.id, consentGranted: false, revokedAtMs: now }, '已撤回信息共享'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
