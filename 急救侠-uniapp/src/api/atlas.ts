/**
 * 急救图谱 API — Mock
 *
 * 8 张静态急救知识卡片，覆盖常见急症处理。
 * 每张卡片对应一条急救指南。
 */

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

const MOCK_CARDS: AtlasCard[] = [
  {
    id: 'cpr',
    num: '01',
    icon: '❤️',
    title: '心脏骤停',
    desc: 'CPR + AED 全流程',
    featured: true,
    route: '/pages/rescue/index',
  },
  {
    id: 'choking',
    num: '02',
    icon: '🫁',
    title: '异物窒息',
    desc: '海姆立克急救法',
    badge: '分人群',
    route: '/pages/guide/index?type=heimlich',
  },
  {
    id: 'aed',
    num: '03',
    icon: '⚡',
    title: 'AED 使用',
    desc: '自动体外除颤器',
    route: '/pages/aed/index',
  },
  {
    id: 'bleeding',
    num: '04',
    icon: '🩸',
    title: '出血止血',
    desc: '加压包扎+止血带',
    route: '/pages/guide/index?type=bleeding',
  },
  {
    id: 'fracture',
    num: '05',
    icon: '🦴',
    title: '骨折固定',
    desc: '原位固定与搬运',
    route: '/pages/guide/index?type=fracture',
  },
  {
    id: 'epilepsy',
    num: '06',
    icon: '🧠',
    title: '癫痫急救',
    desc: '保护与侧卧位',
    route: '/pages/guide/index?type=seizure',
  },
  {
    id: 'psychological',
    num: '07',
    icon: '💬',
    title: '心理干预',
    desc: '情绪安抚与陪伴',
    badge: '新增',
    route: '/pages/guide/index?type=psychological',
  },
  {
    id: 'transport',
    num: '08',
    icon: '🚑',
    title: '伤员搬运',
    desc: '轴线翻身与平移',
    badge: '新增',
    route: '/pages/guide/index?type=transport',
  },
]

export function getAtlasCards(): AtlasCard[] {
  return MOCK_CARDS.map((c) => ({ ...c }))
}

export function getAtlasCardById(id: string): AtlasCard | undefined {
  return MOCK_CARDS.find((c) => c.id === id)
}

/** 获取推荐卡片（featured 标记的，始终为 CPR） */
export function getFeaturedCard(): AtlasCard {
  return MOCK_CARDS.find((c) => c.featured) || MOCK_CARDS[0]
}

export default function () {
  return { code: 0, data: MOCK_CARDS, message: 'ok' }
}
