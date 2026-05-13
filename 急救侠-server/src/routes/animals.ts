import { Router } from 'express'
import db from '../db'
import { success, error } from '../types'

export const animalRouter = Router()

animalRouter.get('/', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM stray_animals ORDER BY created_at DESC LIMIT 20').all() as any[]
    res.json(success(rows.map((r: any) => ({ id: r.id, name: r.name, species: r.species, color: r.color, size: r.size, features: r.features, photos: r.photos, location: r.location, lat: r.lat, lng: r.lng, status: r.status, createdBy: r.created_by, createdAt: r.created_at }))))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

animalRouter.get('/:id', (req, res) => {
  try {
    const a = db.prepare('SELECT * FROM stray_animals WHERE id=?').get(req.params.id) as any
    if (!a) return res.json(error('动物不存在'))
    const care = db.prepare('SELECT * FROM animal_care_records WHERE animal_id=? ORDER BY created_at DESC').all(req.params.id) as any[]
    const health = db.prepare('SELECT * FROM animal_health_records WHERE animal_id=? ORDER BY created_at DESC').all(req.params.id) as any[]
    res.json(success({ id: a.id, name: a.name, species: a.species, color: a.color, size: a.size, features: a.features, photos: a.photos, location: a.location, lat: a.lat, lng: a.lng, status: a.status, createdBy: a.created_by, createdAt: a.created_at, careRecords: care.map((c: any) => ({ id: c.id, userId: c.user_id, userName: c.user_name, careType: c.care_type, description: c.description, photos: c.photos, lat: c.lat, lng: c.lng, createdAt: c.created_at })), healthRecords: health.map((h: any) => ({ id: h.id, userId: h.user_id, userName: h.user_name, checkType: h.check_type, findings: h.findings, vetName: h.vet_name, photos: h.photos, createdAt: h.created_at })) }))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

animalRouter.post('/', (req, res) => {
  try {
    const { name, species, color, size, features, photos, location, lat, lng, createdBy } = req.body
    if (!species) return res.json(error('物种不能为空'))
    const aid = 'sa_' + Date.now()
    db.prepare('INSERT INTO stray_animals (id,name,species,color,size,features,photos,location,lat,lng,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(aid, name||'', species, color||'', size||'', features||'', photos||'', location||'', lat||0, lng||0, createdBy||'')
    res.json(success({ id: aid }, '已创建档案'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

animalRouter.post('/:id/care', (req, res) => {
  try {
    const { userId, userName, careType, description, photos, lat, lng } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    db.prepare('INSERT INTO animal_care_records (id,animal_id,user_id,user_name,care_type,description,photos,lat,lng) VALUES (?,?,?,?,?,?,?,?,?)').run('acr_'+Date.now(), req.params.id, userId, userName||'', careType||'feeding', description||'', photos||'', lat||0, lng||0)
    res.json(success(null, '已记录'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})

animalRouter.post('/:id/health', (req, res) => {
  try {
    const { userId, userName, checkType, findings, vetName, photos } = req.body
    if (!userId) return res.json(error('userId 不能为空'))
    db.prepare('INSERT INTO animal_health_records (id,animal_id,user_id,user_name,check_type,findings,vet_name,photos) VALUES (?,?,?,?,?,?,?,?)').run('ahr_'+Date.now(), req.params.id, userId, userName||'', checkType||'general', findings||'', vetName||'', photos||'')
    res.json(success(null, '已记录'))
  } catch (e: any) { res.status(500).json(error(e.message)) }
})
