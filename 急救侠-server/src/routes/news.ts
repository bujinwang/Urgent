import { Router } from 'express'
import db, { get, all } from '../db'
import { success, error, NewsItem } from '../types'
import type { NewsRow } from '../types/rows'

export const newsRouter = Router()

newsRouter.get('/list', (_req, res) => {
  try {
    const rows = all<NewsRow>('SELECT * FROM news ORDER BY time DESC')
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
    const rows = all<NewsRow>('SELECT * FROM news WHERE category = ? ORDER BY time DESC', cat)
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
    const row = get<NewsRow>('SELECT * FROM news WHERE id = ?', req.params.id)
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
