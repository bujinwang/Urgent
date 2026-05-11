import { Router } from 'express'
import db from '../db'
import { success, error, NewsItem } from '../types'

export const newsRouter = Router()

newsRouter.get('/list', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM news ORDER BY time DESC').all() as any[]
    const items: NewsItem[] = rows.map(row => ({
      id: row.id, title: row.title, type: row.type, category: row.category,
      time: row.time,
      location: { name: row.location_name, lat: row.location_lat, lng: row.location_lng },
      tags: JSON.parse(row.tags),
      isLive: !!row.is_live, isUrgent: !!row.is_urgent,
      body: row.body, imageUrl: row.image_url, videoUrl: row.video_url,
    }))
    res.json(success(items))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

newsRouter.get('/category/:cat', (req, res) => {
  try {
    const cat = req.params.cat
    const rows = db.prepare('SELECT * FROM news WHERE category = ? ORDER BY time DESC').all(cat) as any[]
    const items: NewsItem[] = rows.map(row => ({
      id: row.id, title: row.title, type: row.type, category: row.category,
      time: row.time,
      location: { name: row.location_name, lat: row.location_lat, lng: row.location_lng },
      tags: JSON.parse(row.tags),
      isLive: !!row.is_live, isUrgent: !!row.is_urgent,
      body: row.body, imageUrl: row.image_url, videoUrl: row.video_url,
    }))
    res.json(success(items))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})

newsRouter.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id) as any
    if (!row) return res.json(error('新闻不存在'))
    const item: NewsItem = {
      id: row.id, title: row.title, type: row.type, category: row.category,
      time: row.time,
      location: { name: row.location_name, lat: row.location_lat, lng: row.location_lng },
      tags: JSON.parse(row.tags),
      isLive: !!row.is_live, isUrgent: !!row.is_urgent,
      body: row.body, imageUrl: row.image_url, videoUrl: row.video_url,
    }
    res.json(success(item))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
