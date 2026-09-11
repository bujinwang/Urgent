/**
 * 任务 API — 真实接口（GET /api/task/active、/api/task/list、POST /api/task/accept|complete）
 *
 * 已移除 mock 数据。后端结构无 title/description/sceneType 等展示字段，
 * 由显式映射函数补齐（缺失项见交付映射表）。
 */

import { request } from './index'

export interface RescueTask {
  id: string
  type: 'cpr' | 'aed' | 'assist'
  title: string
  description: string
  address: string
  distance: number
  lat: number
  lng: number
  volunteersNeeded: number
  volunteersResponded: number
  volunteersEnRoute: number
  status: 'pending' | 'active' | 'completed'
  createdAt: string
  sceneType: string
  patientAge?: string
  patientGender?: string
  /** 现场直播人数（后端未提供 → 可选） */
  liveCount?: number
}

/** 后端 `/api/task` 返回的原始结构。 */
export interface ApiRescueTask {
  id: string
  type: string
  address: string
  distance: number
  lat: number
  lng: number
  volunteersNeeded: number
  volunteersResponded: number
  status: string
  createdAt: string
}

const TASK_TYPES: readonly string[] = ['cpr', 'aed', 'assist']
const TASK_STATUS: readonly string[] = ['pending', 'active', 'completed']

function asTaskType(t: string): RescueTask['type'] {
  return TASK_TYPES.includes(t) ? (t as RescueTask['type']) : 'assist'
}

function asTaskStatus(s: string): RescueTask['status'] {
  return TASK_STATUS.includes(s) ? (s as RescueTask['status']) : 'pending'
}

/** 后端任务 → 视图模型（显式映射，禁用 `as any`）。 */
export function mapRescueTask(raw: ApiRescueTask): RescueTask {
  const needed = raw.volunteersNeeded || 0
  const responded = raw.volunteersResponded || 0
  return {
    id: raw.id,
    type: asTaskType(raw.type),
    title: raw.address,          // 后端无 title → 以地址代标题
    description: '',
    address: raw.address,
    distance: raw.distance,
    lat: raw.lat,
    lng: raw.lng,
    volunteersNeeded: needed,
    volunteersResponded: responded,
    volunteersEnRoute: Math.max(0, needed - responded),
    status: asTaskStatus(raw.status),
    createdAt: raw.createdAt,
    sceneType: '',
  }
}

/** 获取当前活跃任务（无则 null）。失败时抛出，由调用方呈现错误。 */
export async function fetchActiveTask(): Promise<RescueTask | null> {
  const raw = await request<ApiRescueTask | null>({ url: '/task/active' })
  return raw ? mapRescueTask(raw) : null
}

/** 获取任务列表。 */
export async function fetchTaskList(): Promise<RescueTask[]> {
  const raw = await request<ApiRescueTask[]>({ url: '/task/list' })
  return (raw || []).map(mapRescueTask)
}

/** 接受任务（真实接口）。 */
export async function acceptTaskApi(taskId: string) {
  return request({ url: '/task/accept', method: 'POST', data: { taskId } })
}

/** 完成任务（真实接口）。 */
export async function completeTaskApi(taskId: string) {
  return request({ url: '/task/complete', method: 'POST', data: { taskId } })
}
