/**
 * 任务 API — Mock
 */

interface RescueTask {
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

export default function (params?: Record<string, unknown>) {
  return {
    code: 0,
    data: MOCK_TASKS,
    message: 'ok',
  }
}
