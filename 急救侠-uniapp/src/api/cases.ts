/**
 * 救援案例 API — 真实接口（GET /api/cases/list、GET /api/cases/:id）
 *
 * 已移除 mock 数据；后端为唯一数据源。后端结构缺少 timeline/heroes/duration，
 * 由显式映射函数用安全默认补齐（缺失项见交付映射表）。
 */

import { request } from './index'

export interface CaseHero {
  id: number
  avatar: string
  name: string
  role: string
  color: string
}

export interface CaseTimelineItem {
  time: string
  text: string
}

export interface RescueCase {
  id: string
  tag: string
  tagClass: 'success'
  title: string
  date: string
  location: string
  duration: string
  resultIcon: string
  resultTitle: string
  resultText: string
  timeline: CaseTimelineItem[]
  heroes: CaseHero[]
  /** 关联新闻 ID（后端未提供 → 始终 undefined） */
  newsId?: string
}

/** 后端 `/api/cases` 返回的原始结构。 */
export interface ApiRescueCase {
  id: string
  title: string
  summary: string
  date: string
  location: string
  result: string
  volunteers: string[]
  body?: string
  /** 关联新闻 ID（后端可空；无值时不互链） */
  newsId?: string
}

const HERO_COLORS = [
  'linear-gradient(135deg,#C0392B,#8B2A1F)',
  'linear-gradient(135deg,#1F8A5B,#147547)',
  'linear-gradient(135deg,#4A90E2,#2563EB)',
  'linear-gradient(135deg,#C8A656,#B8941A)',
]

/**
 * 后端案例 → 视图模型（显式映射，禁用 `as any`）。
 * 后端无 timeline/duration/resultIcon → 安全默认；heroes 由 `volunteers` 派生。
 */
export function mapRescueCase(raw: ApiRescueCase | null | undefined): RescueCase {
  if (!raw) throw new Error('救援案例不存在')
  const volunteers = raw.volunteers || []
  return {
    id: raw.id,
    tag: '✓ 救援案例',
    tagClass: 'success',
    title: raw.title,
    date: raw.date,
    location: raw.location,
    duration: '',
    resultIcon: '💚',
    resultTitle: raw.result || '救援记录',
    resultText: raw.summary,
    newsId: raw.newsId || undefined,
    timeline: [],
    heroes: volunteers.map((name, i) => ({
      id: i + 1,
      avatar: (name || '?').charAt(0),
      name,
      role: '参与救援',
      color: HERO_COLORS[i % HERO_COLORS.length],
    })),
  }
}

/** 获取案例列表。失败时抛出，由调用方呈现错误。 */
export async function fetchCases(): Promise<RescueCase[]> {
  const raw = await request<ApiRescueCase[]>({ url: '/cases/list' })
  return (raw || []).map(mapRescueCase)
}

/** 获取单个案例详情。 */
export async function fetchCaseByIdApi(id: string): Promise<RescueCase> {
  const raw = await request<ApiRescueCase | null>({ url: `/cases/${id}` })
  return mapRescueCase(raw)
}
