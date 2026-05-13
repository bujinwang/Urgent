import { Router } from 'express'
import db from '../db'
import {
  success, error,
  Organization, OrgMember, Certificate, CertificateInput, OrgDashboard,
} from '../types'

export const orgRouter = Router()

/* ──── Organization ──── */

// GET /api/org/:id — org info + dashboard
orgRouter.get('/:id', (req, res) => {
  try {
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(req.params.id) as any
    if (!org) return res.json(error('机构不存在'))

    const members = db.prepare('SELECT COUNT(*) as cnt FROM organization_members WHERE org_id = ?').get(req.params.id) as any
    const certs = db.prepare(
      "SELECT status, COUNT(*) as cnt FROM certificates WHERE user_id IN (SELECT user_id FROM organization_members WHERE org_id = ?) GROUP BY status"
    ).all(req.params.id) as any[]

    let active = 0, expiring = 0, expired = 0
    for (const c of certs) {
      if (c.status === 'active') active = c.cnt
      else if (c.status === 'expiring') expiring = c.cnt
      else if (c.status === 'expired') expired = c.cnt
    }

    const dash: OrgDashboard = {
      org: { id: org.id, name: org.name, type: org.type, adminUserId: org.admin_user_id, createdAt: org.created_at },
      totalMembers: members.cnt,
      activeCertificates: active,
      expiringCertificates: expiring,
      expiredCertificates: expired,
    }
    res.json(success(dash))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/org — create organization
orgRouter.post('/', (req, res) => {
  try {
    const { name, type, adminUserId } = req.body
    if (!name || !adminUserId) return res.json(error('name 和 adminUserId 不能为空'))
    const id = 'org_' + Date.now()
    db.prepare('INSERT INTO organizations (id, name, type, admin_user_id) VALUES (?, ?, ?, ?)').run(id, name, type || 'company', adminUserId)
    // Auto-add admin as member
    const mid = 'om_' + Date.now() + '_0'
    db.prepare('INSERT OR IGNORE INTO organization_members (id, org_id, user_id, role) VALUES (?, ?, ?, ?)').run(mid, id, adminUserId, 'admin')
    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as any
    res.json(success({ id: org.id, name: org.name, type: org.type, adminUserId: org.admin_user_id, createdAt: org.created_at }))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Members ──── */

// GET /api/org/:id/members — list members
orgRouter.get('/:id/members', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT om.*, u.name as user_name, u.avatar as user_avatar, u.tier as user_tier,
             u.rescue_count as rescue_count
      FROM organization_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.org_id = ?
      ORDER BY om.role = 'admin' DESC, om.role = 'manager' DESC, om.joined_at ASC
    `).all(req.params.id) as any[]

    const members: OrgMember[] = rows.map(row => {
      const certCounts = db.prepare(
        "SELECT status, COUNT(*) as cnt FROM certificates WHERE user_id = ? GROUP BY status"
      ).all(row.user_id) as any[]
      let active = 0, expiring = 0
      for (const c of certCounts) {
        if (c.status === 'active') active = c.cnt
        else if (c.status === 'expiring') expiring = c.cnt
      }
      return {
        id: row.id, orgId: row.org_id, userId: row.user_id,
        userName: row.user_name, userAvatar: row.user_avatar,
        userTier: row.user_tier, role: row.role, joinedAt: row.joined_at,
        rescueCount: row.rescue_count,
        activeCertificates: active,
        expiringCertificates: expiring,
      }
    })

    res.json(success(members))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/org/:id/members — add member
orgRouter.post('/:id/members', (req, res) => {
  try {
    const { userId, role } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    const mid = 'om_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    db.prepare('INSERT OR IGNORE INTO organization_members (id, org_id, user_id, role) VALUES (?, ?, ?, ?)').run(mid, req.params.id, userId, role || 'member')
    res.json(success({ id: mid, orgId: req.params.id, userId, role: role || 'member' }, '添加成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// DELETE /api/org/:id/members/:userId — remove member
orgRouter.delete('/:id/members/:userId', (req, res) => {
  try {
    db.prepare('DELETE FROM organization_members WHERE org_id = ? AND user_id = ?').run(req.params.id, req.params.userId)
    res.json(success(null, '移除成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

/* ──── Certificates ──── */

// GET /api/org/:id/certificates — list all member certificates
orgRouter.get('/:id/certificates', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT c.*, u.name as user_name
      FROM certificates c
      JOIN users u ON u.id = c.user_id
      WHERE c.user_id IN (SELECT user_id FROM organization_members WHERE org_id = ?)
      ORDER BY CASE c.status WHEN 'expired' THEN 0 WHEN 'expiring' THEN 1 ELSE 2 END, c.expiry_date ASC
    `).all(req.params.id) as any[]

    // Update status dynamically based on current date
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const certs: Certificate[] = rows.map(row => {
      const expiry = new Date(row.expiry_date)
      let status = row.status
      if (expiry < now) status = 'expired'
      else if (expiry <= thirtyDays) status = 'expiring'
      else status = 'active'

      // Update DB if status changed
      if (status !== row.status) {
        db.prepare('UPDATE certificates SET status = ? WHERE id = ?').run(status, row.id)
      }

      return {
        id: row.id, userId: row.user_id, userName: row.user_name,
        type: row.type, issuer: row.issuer,
        issueDate: row.issue_date, expiryDate: row.expiry_date,
        status: status as any, fileUrl: row.file_url,
      }
    })

    res.json(success(certs))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /api/org/:id/certificates/expiring — expiring within 30 days
orgRouter.get('/:id/certificates/expiring', (req, res) => {
  try {
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    const rows = db.prepare(`
      SELECT c.*, u.name as user_name
      FROM certificates c
      JOIN users u ON u.id = c.user_id
      WHERE c.user_id IN (SELECT user_id FROM organization_members WHERE org_id = ?)
        AND c.expiry_date >= ? AND c.expiry_date <= ? AND c.status != 'expired'
      ORDER BY c.expiry_date ASC
    `).all(req.params.id, today, thirtyDays) as any[]

    const certs: Certificate[] = rows.map(row => ({
      id: row.id, userId: row.user_id, userName: row.user_name,
      type: row.type, issuer: row.issuer,
      issueDate: row.issue_date, expiryDate: row.expiry_date,
      status: 'expiring', fileUrl: row.file_url,
    }))
    res.json(success(certs))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// POST /api/org/:id/certificates — add certificate
orgRouter.post('/:id/certificates', (req, res) => {
  try {
    const { userId, type, issuer, issueDate, expiryDate, fileUrl } = req.body
    if (!userId || !type || !issueDate || !expiryDate) {
      return res.json(error('userId, type, issueDate, expiryDate 不能为空'))
    }
    const cid = 'cert_' + Date.now()
    db.prepare(
      'INSERT INTO certificates (id, user_id, type, issuer, issue_date, expiry_date, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(cid, userId, type, issuer || '', issueDate, expiryDate, fileUrl || '')

    // Notify all organizations this user belongs to
    const userOrgs = db.prepare(
      'SELECT om.org_id, o.name as org_name FROM organization_members om JOIN organizations o ON o.id = om.org_id WHERE om.user_id = ?'
    ).all(userId) as any[]
    const userName = (db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any)?.name || userId
    for (const org of userOrgs) {
      db.prepare(
        'INSERT INTO notifications (id, org_id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)'
      ).run('n_' + Date.now() + '_' + Math.random().toString(36).slice(2,6), org.org_id, userId, 'certificate',
        `${userName} 获得新证书`,
        `${userName} 获得了 ${type} 认证 (${issuer || '未知机构'})，有效期至 ${expiryDate}`)
    }

    res.json(success({ id: cid }, '证书添加成功'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// GET /api/org/:id/notifications — list notifications
orgRouter.get('/:id/notifications', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT * FROM notifications WHERE org_id = ? ORDER BY created_at DESC LIMIT 30'
    ).all(req.params.id) as any[]
    res.json(success(rows.map(r => ({
      id: r.id, orgId: r.org_id, userId: r.user_id,
      type: r.type, title: r.title, message: r.message,
      isRead: r.is_read === 1, createdAt: r.created_at,
    }))))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// PUT /api/org/:id/notifications/:nid/read — mark as read
orgRouter.put('/:id/notifications/:nid/read', (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.nid)
    res.json(success(null, '已标记为已读'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

// DELETE /api/org/:id/certificates/:certId — delete certificate
orgRouter.delete('/:id/certificates/:certId', (req, res) => {
  try {
    db.prepare('DELETE FROM certificates WHERE id = ?').run(req.params.certId)
    res.json(success(null, '证书已删除'))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
