import { Router } from 'express'
import db from '../db'
import { success, error, AedDevice, AedCheckin, AedDeviceInput, AedManager, AedMaintenance, AedPickup, AedAuditEvent, AedCertification } from '../types'

export const aedRouter = Router()

/** Write audit log entry */
function logAudit(aedId: string, eventType: string, description: string, userId: string, userName: string, oldValue?: string, newValue?: string) {
  try {
    db.prepare(
      'INSERT INTO aed_audit_log (id, aed_id, event_type, description, user_id, user_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('al_' + Date.now(), aedId, eventType, description, userId, userName, oldValue || '', newValue || '')
  } catch (_) { /* non-critical */ }
}

function rowToDevice(row: any): AedDevice {
  const checkins = db.prepare(
    'SELECT * FROM aed_checkins WHERE aed_id = ? ORDER BY date DESC'
  ).all(row.id) as any[]
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
    checkIns: checkins.map((ci: any): AedCheckin => ({
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
    const rows = db.prepare('SELECT * FROM aed_devices ORDER BY distance ASC').all() as any[]
    res.json(success(rows.map(rowToDevice)))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /api/aed/mine?userId=xxx — devices managed by this user
aedRouter.get('/mine', (req, res) => {
  try {
    const userId = (req.query.userId as string) || ''
    const rows = db.prepare(`
      SELECT DISTINCT ad.* FROM aed_devices ad
      JOIN aed_managers am ON am.aed_id = ad.id
      WHERE am.user_id = ?
      ORDER BY ad.distance ASC
    `).all(userId) as any[]
    const devices = rows.map(rowToDevice)
    // Attach pending alerts
    for (const d of devices) {
      const pickups = db.prepare(
        "SELECT COUNT(*) as cnt FROM aed_pickups WHERE aed_id = ? AND return_time IS NULL"
      ).get(d.id) as any
      ;(d as any).activePickups = pickups.cnt
    }
    res.json(success(devices))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

aedRouter.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM aed_devices WHERE id = ?').get(req.params.id) as any
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
    const row = db.prepare('SELECT * FROM aed_devices WHERE id = ?').get(id) as any
    logAudit(id, 'device_created', `新增 AED: ${input.name}`, input.reportedBy || '', input.reportedBy || '')
    res.json(success(rowToDevice(row), 'AED 添加成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// PUT /api/aed/:id — update device
aedRouter.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM aed_devices WHERE id = ?').get(req.params.id) as any
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
    const row = db.prepare('SELECT * FROM aed_devices WHERE id = ?').get(req.params.id) as any
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
    const existing = db.prepare('SELECT name FROM aed_devices WHERE id = ?').get(req.params.id) as any
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
    const rows = db.prepare(
      'SELECT * FROM aed_checkins WHERE aed_id = ? ORDER BY date DESC'
    ).all(req.params.id) as any[]
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
    const rows = db.prepare(
      'SELECT * FROM aed_managers WHERE aed_id = ? ORDER BY role'
    ).all(req.params.id) as any[]
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
    const mgr = db.prepare('SELECT * FROM aed_managers WHERE id = ?').get(req.params.managerId) as any
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
    const rows = db.prepare(
      'SELECT * FROM aed_maintenance WHERE aed_id = ? ORDER BY date DESC'
    ).all(req.params.id) as any[]
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
    const rows = db.prepare(
      'SELECT * FROM aed_pickups WHERE aed_id = ? ORDER BY pickup_time DESC'
    ).all(req.params.id) as any[]
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
    const active = db.prepare(
      'SELECT COUNT(*) as cnt FROM aed_pickups WHERE aed_id = ? AND return_time IS NULL'
    ).get(req.params.id) as any
    if (active.cnt === 0) {
      db.prepare("UPDATE aed_devices SET status = 'available' WHERE id = ?").run(req.params.id)
    }
    logAudit(req.params.id, 'return', 'AED 已归还', '', '', 'in_use', active.cnt === 0 ? 'available' : 'in_use')
    res.json(success(null, 'AED 已归还'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Audit Log ──── */

// GET /api/aed/:id/audit
aedRouter.get('/:id/audit', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM aed_audit_log WHERE aed_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.params.id) as any[]
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
    const rows = db.prepare(
      'SELECT * FROM aed_certifications WHERE aed_id = ? ORDER BY expiry_date ASC'
    ).all(req.params.id) as any[]
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
    const cert = db.prepare('SELECT name FROM aed_certifications WHERE id = ?').get(req.params.certId) as any
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
    const device = rowToDevice(db.prepare('SELECT * FROM aed_devices WHERE id = ?').get(req.params.id) as any)
    const managers = db.prepare('SELECT * FROM aed_managers WHERE aed_id = ?').all(req.params.id) as any[]
    const maintenance = db.prepare('SELECT * FROM aed_maintenance WHERE aed_id = ? ORDER BY date DESC').all(req.params.id) as any[]
    const pickups = db.prepare('SELECT * FROM aed_pickups WHERE aed_id = ? ORDER BY pickup_time DESC LIMIT 10').all(req.params.id) as any[]
    const activePickups = db.prepare('SELECT COUNT(*) as cnt FROM aed_pickups WHERE aed_id = ? AND return_time IS NULL').get(req.params.id) as any
    const auditLog = db.prepare('SELECT * FROM aed_audit_log WHERE aed_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id) as any[]
    const certifications = db.prepare('SELECT * FROM aed_certifications WHERE aed_id = ? ORDER BY expiry_date ASC').all(req.params.id) as any[]

    res.json(success({
      device,
      managers: managers.map((r: any) => ({ id: r.id, userId: r.user_id, userName: r.user_name, role: r.role, assignedAt: r.assigned_at })),
      maintenance: maintenance.map((r: any) => ({ id: r.id, type: r.type, date: r.date, performedBy: r.performed_by, notes: r.notes, nextDue: r.next_due })),
      recentPickups: pickups.map((r: any) => ({
        id: r.id, userId: r.user_id, userName: r.user_name,
        pickupTime: r.pickup_time, returnTime: r.return_time, isReturned: r.return_time != null,
      })),
      activePickups: activePickups.cnt,
      auditLog: auditLog.map((r: any) => ({
        id: r.id, eventType: r.event_type, description: r.description,
        userId: r.user_id, userName: r.user_name, createdAt: r.created_at,
      })),
      certifications: certifications.map((r: any) => ({
        id: r.id, type: r.type, name: r.name, issuer: r.issuer,
        issueDate: r.issue_date, expiryDate: r.expiry_date, status: r.status,
      })),
    }))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
