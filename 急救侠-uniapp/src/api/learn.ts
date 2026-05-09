/**
 * 学习训练 API — Mock
 */

export interface Lesson {
  id: number
  thumb: string
  title: string
  duration: string
  students: number
  done: boolean
}

export interface Training {
  id: string
  icon: string
  title: string
  desc: string
  route: string
}

const MOCK_LESSONS: Lesson[] = [
  { id: 1, thumb: 'CPR', title: '成人心肺复苏 (CPR)', duration: '20min', students: 12840, done: true },
  { id: 2, thumb: 'AED', title: 'AED 使用与电极片贴法', duration: '8min', students: 9620, done: true },
  { id: 3, thumb: '🧒', title: '婴儿/儿童 CPR 差异', duration: '12min', students: 5430, done: false },
  { id: 4, thumb: '🫁', title: '海姆立克急救法全解', duration: '6min', students: 8120, done: false },
]

const MOCK_TRAININGS: Training[] = [
  { id: 'cpr', icon: '❤️', title: '节拍器训练', desc: '110 BPM 按压节奏 · 全流程演习', route: '/pages/rescue/index?mode=drill' },
  { id: 'aed', icon: '⚡', title: 'AED 模拟', desc: '设备操作流程 · 演习', route: '/pages/aed/index' },
  { id: 'heimlich', icon: '🫁', title: '海姆立克', desc: '分人群手法练习 · 演习', route: '/pages/guide/index?type=heimlich' },
  { id: 'scenario', icon: '🎯', title: '场景模拟', desc: '地铁站情境挑战 · 演习', route: '/pages/guide/index?type=bleeding' },
]

export function getLessons(): Lesson[] {
  return MOCK_LESSONS.map((l) => ({ ...l }))
}

export function getTrainings(): Training[] {
  return MOCK_TRAININGS.map((t) => ({ ...t }))
}

export default function (params?: Record<string, unknown>) {
  return {
    code: 0,
    data: { lessons: MOCK_LESSONS, trainings: MOCK_TRAININGS },
    message: 'ok',
  }
}
