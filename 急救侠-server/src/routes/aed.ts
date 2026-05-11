import { Router } from 'express'
import db from '../db'
import { success, error, AedDevice } from '../types'

export const aedRouter = Router()

aedRouter.get('/nearby', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM aed_devices ORDER BY distance ASC').all() as any[]
    const devices: AedDevice[] = rows.map(row => ({
      id: row.id, name: row.name, address: row.address,
      lat: row.lat, lng: row.lng, distance: row.distance,
      status: row.status, lastCheck: row.last_check, batteryLevel: row.battery_level,
    }))
    res.json(success(devices))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

aedRouter.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM aed_devices WHERE id = ?').get(req.params.id) as any
    if (!row) return res.json(error('AED 设备不存在'))
    const device: AedDevice = {
      id: row.id, name: row.name, address: row.address,
      lat: row.lat, lng: row.lng, distance: row.distance,
      status: row.status, lastCheck: row.last_check, batteryLevel: row.battery_level,
    }
    res.json(success(device))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
