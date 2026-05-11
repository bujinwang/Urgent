import { Router } from 'express'
import db from '../db'
import { success, error, AtlasCard } from '../types'

export const atlasRouter = Router()

atlasRouter.get('/cards', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM atlas_cards').all() as any[]
    const cards: AtlasCard[] = rows.map(row => ({
      id: row.id, title: row.title, category: row.category,
      description: row.description, steps: JSON.parse(row.steps),
      icon: row.icon, imageUrl: row.image_url,
    }))
    res.json(success(cards))
  } catch (e: any) {
    res.status(500).json(error(e.message || '服务器错误'))
  }
})
