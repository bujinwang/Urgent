/**
 * 新闻/动态 API — 真实接口（GET /api/news/list、/api/news/category/:cat、/api/news/:id）
 *
 * 已移除 mock 数据。后端结构无 excerpt/coverImage/stats/featured 等展示字段，
 * 由显式映射函数补齐（缺失项见交付映射表）。
 */

import { request } from './index'

export interface NewsAuthor {
  name: string
  avatar: string
  isVolunteer: boolean
  rescueCount?: number
  badge?: string
}

export interface NewsStats {
  views: number
  likes: number
  comments: number
  shares?: number
}

export interface LiveStats {
  volunteers: number
  duration: string
  status: 'ongoing' | 'completed'
}

export interface NewsItem {
  id: string
  type: 'video' | 'photo' | 'live' | 'story' | 'article' | 'map'
  title: string
  excerpt: string
  body?: string
  coverImage?: string
  videoUrl?: string
  videoDuration?: string
  photos?: string[]
  mapCenter?: { lat: number; lng: number }
  mapMarkers?: Array<{ lat: number; lng: number; label: string }>
  location: { name: string; distance?: number }
  time: string
  author?: NewsAuthor
  stats: NewsStats
  tags: string[]
  isLive?: boolean
  liveStats?: LiveStats
  featured?: boolean
  category: 'recommend' | 'video' | 'nearby' | 'volunteer'
  /** 关联救援案例 ID（后端未提供 → 始终 undefined） */
  caseId?: string
}

/** 后端 `/api/news` 返回的原始结构。 */
export interface ApiNewsItem {
  id: string
  title: string
  type: string
  category: string
  time: string
  location: { name: string; lat?: number; lng?: number }
  tags: string[]
  isLive: boolean
  isUrgent: boolean
  body?: string
  imageUrl?: string
  videoUrl?: string
}

const NEWS_TYPES: readonly string[] = ['video', 'photo', 'live', 'story', 'article', 'map']
const NEWS_CATEGORIES: readonly string[] = ['recommend', 'video', 'nearby', 'volunteer']

function asNewsType(t: string): NewsItem['type'] {
  return NEWS_TYPES.includes(t) ? (t as NewsItem['type']) : 'article'
}

function asNewsCategory(c: string): NewsItem['category'] {
  return NEWS_CATEGORIES.includes(c) ? (c as NewsItem['category']) : 'recommend'
}

/** 后端新闻 → 视图模型（显式映射，禁用 `as any`）。 */
export function mapNewsItem(raw: ApiNewsItem): NewsItem {
  const body = raw.body || ''
  return {
    id: raw.id,
    type: asNewsType(raw.type),
    title: raw.title,
    excerpt: body ? body.slice(0, 60) : '',
    body: raw.body,
    coverImage: raw.imageUrl,
    videoUrl: raw.videoUrl,
    location: { name: raw.location?.name || '' },
    time: raw.time,
    // 后端不返回阅读/点赞等统计 → 置 0（非伪造）
    stats: { views: 0, likes: 0, comments: 0 },
    tags: raw.tags || [],
    isLive: !!raw.isLive,
    category: asNewsCategory(raw.category),
  }
}

/** 获取全部动态。失败时抛出，由调用方呈现错误。 */
export async function fetchNewsList(): Promise<NewsItem[]> {
  const raw = await request<ApiNewsItem[]>({ url: '/news/list' })
  return (raw || []).map(mapNewsItem)
}

/** 按分类获取动态（后端端点：GET /news/category/:cat）。 */
export async function fetchNewsByCategory(cat: string): Promise<NewsItem[]> {
  const raw = await request<ApiNewsItem[]>({ url: `/news/category/${cat}` })
  return (raw || []).map(mapNewsItem)
}

/** 获取单条动态详情。 */
export async function fetchNewsById(id: string): Promise<NewsItem> {
  const raw = await request<ApiNewsItem>({ url: `/news/${id}` })
  return mapNewsItem(raw)
}
