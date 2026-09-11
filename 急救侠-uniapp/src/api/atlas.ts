/**
 * 急救图谱 API — 真实接口（GET /api/atlas/cards）
 *
 * 已移除全部 mock 数据；后端为唯一数据源，失败时向调用方抛出，不做静默兜底。
 */

import { request } from './index'

/** 视图模型（页面消费）。 */
export interface AtlasCard {
  id: string
  num: string
  icon: string
  title: string
  desc: string
  featured?: boolean
  badge?: string
  route: string
}

/** 后端 `/api/atlas/cards` 返回的原始结构。 */
export interface ApiAtlasCard {
  id: string
  title: string
  category: string
  description: string
  steps: string[]
  icon?: string
  imageUrl?: string
}

/** 已知卡片的跳转路由（UI 配置表；后端不返回 route）。 */
const CARD_ROUTES: Record<string, string> = {
  cpr: '/pages/rescue/index',
  aed: '/pages/aed/index',
  choking: '/pages/guide/index?type=heimlich',
  bleeding: '/pages/guide/index?type=bleeding',
  fracture: '/pages/guide/index?type=fracture',
  epilepsy: '/pages/guide/index?type=seizure',
  psychological: '/pages/guide/index?type=psychological',
  transport: '/pages/guide/index?type=transport',
}

/**
 * 后端卡片 → 视图模型（显式映射，禁用 `as any`）。
 * `num` 由序号生成；`featured` 仅 CPR（后端无该字段）；`badge` 后端缺失故不设置。
 */
export function mapAtlasCard(raw: ApiAtlasCard | null | undefined, index: number): AtlasCard {
  if (!raw) throw new Error('图谱卡片不存在')
  return {
    id: raw.id,
    num: String(index + 1).padStart(2, '0'),
    icon: raw.icon || '📘',
    title: raw.title,
    desc: raw.description,
    featured: raw.id === 'cpr',
    route: CARD_ROUTES[raw.id] || '/pages/guide/index',
  }
}

/** 获取全部急救图谱卡片。失败时抛出，由调用方呈现错误。 */
export async function fetchAtlasCards(): Promise<AtlasCard[]> {
  const raw = await request<ApiAtlasCard[]>({ url: '/atlas/cards' })
  return (raw || []).map((card, index) => mapAtlasCard(card, index))
}
