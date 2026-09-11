/**
 * 学习训练 API — 课程走真实接口（GET /api/learn/courses）；训练入口为本地 UI 配置。
 *
 * 说明：后端**没有** `/learn/trainings` 端点，`TRAININGS` 是纯前端的训练入口路由配置
 * （导航目标为本机页面），不属于服务端业务数据，故保留于前端（见交付映射表）。
 */

import { request } from './index'

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

/** 后端 `/api/learn/courses` 返回的原始结构。 */
export interface ApiCourse {
  id: string
  title: string
  category: string
  duration: string
  completed: boolean
  progress: number
  icon?: string
}

/**
 * 后端课程 → 视图模型（显式映射，禁用 `as any`）。
 * 后端 id 为字符串且无 students → id 用序号（稳定、匹配数字型 `Lesson.id`），students 默认 0。
 */
export function mapLesson(raw: ApiCourse, index: number): Lesson {
  return {
    id: index + 1,
    thumb: raw.icon || '📘',
    title: raw.title,
    duration: raw.duration,
    students: 0,
    done: !!raw.completed,
  }
}

/** 获取课程列表。失败时抛出，由调用方呈现错误。 */
export async function fetchLessons(): Promise<Lesson[]> {
  const raw = await request<ApiCourse[]>({ url: '/learn/courses' })
  return (raw || []).map((c, i) => mapLesson(c, i))
}

/** 训练入口（本地 UI 路由配置，非服务端数据）。 */
export const TRAININGS: Training[] = [
  { id: 'cpr', icon: '❤️', title: '节拍器训练', desc: '110 BPM 按压节奏 · 全流程演习', route: '/pages/rescue/index?mode=drill' },
  { id: 'aed', icon: '⚡', title: 'AED 模拟', desc: '设备操作流程 · 演习', route: '/pages/aed/index' },
  { id: 'heimlich', icon: '🫁', title: '海姆立克', desc: '分人群手法练习 · 演习', route: '/pages/guide/index?type=heimlich' },
  { id: 'scenario', icon: '🎯', title: '场景模拟', desc: '地铁站情境挑战 · 演习', route: '/pages/guide/index?type=bleeding' },
]

/** 获取训练入口（本地配置）。 */
export async function fetchTrainings(): Promise<Training[]> {
  return TRAININGS.map((t) => ({ ...t }))
}

/** 更新课程进度（真实接口）。 */
export async function updateProgress(courseId: string, progress: number) {
  return request({ url: '/learn/progress', method: 'POST', data: { courseId, progress } })
}
