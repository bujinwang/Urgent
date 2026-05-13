/**
 * 任务 API — Mock
 */

export interface RescueTask {
  id: string
  type: 'cpr' | 'aed' | 'assist'
  address: string
  distance: number
  lat: number
  lng: number
  volunteersNeeded: number
  volunteersResponded: number
  status: 'pending' | 'active' | 'completed'
  createdAt: string
}

const MOCK_TASKS: RescueTask[] = [
  {
    id: 'task_001',
    type: 'cpr',
    address: '深圳湾公园南门',
    distance: 100,
    lat: 22.517,
    lng: 113.947,
    volunteersNeeded: 3,
    volunteersResponded: 3,
    status: 'active',
    createdAt: new Date().toISOString(),
  },
]

export function getActiveTask(): RescueTask | null {
  return MOCK_TASKS.find((t) => t.status === 'active') || null
}

export function getTaskList(): RescueTask[] {
  return MOCK_TASKS
}


import { request } from './index'

export async function fetchActiveTask(): Promise<RescueTask | null> { return request({ url: '/task/active' }) }
export async function fetchTaskList(): Promise<RescueTask[]> { return request({ url: '/task/list' }) }
export async function acceptTaskApi(taskId: string) { return request({ url: '/task/accept', method: 'POST', data: { taskId } }) }
export async function completeTaskApi(taskId: string) { return request({ url: '/task/complete', method: 'POST', data: { taskId } }) }

export default function (params?: Record<string, unknown>) {
  return {
    code: 0,
    data: MOCK_TASKS,
    message: 'ok',
  }
}
