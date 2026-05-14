/**
 * 任务 API — Mock
 */

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
}

const MOCK_TASKS: RescueTask[] = [
  {
    id: 'task_001',
    type: 'cpr',
    title: '心脏骤停 · 深圳湾公园',
    description: '50岁男性游客跑步中突然倒地，无意识无呼吸。CPR 按压手 3 人已就位，AED 在途，预计 1 分钟到达',
    address: '深圳湾公园南门 · 大草坪',
    distance: 240,
    lat: 22.517, lng: 113.947,
    volunteersNeeded: 4, volunteersResponded: 3, volunteersEnRoute: 1,
    status: 'active', createdAt: new Date().toISOString(),
    sceneType: 'outdoor', patientAge: '50', patientGender: '男',
  },
  {
    id: 'task_002',
    type: 'aed',
    title: 'AED 需求 · 福田CBD',
    description: '35岁女性在办公室突然晕倒，同楼志愿者已在 CPR，需要最近的 AED 火速送达',
    address: '福田 CBD · 太平金融大厦 15F',
    distance: 380,
    lat: 22.543, lng: 114.085,
    volunteersNeeded: 2, volunteersResponded: 1, volunteersEnRoute: 1,
    status: 'active', createdAt: new Date(Date.now() - 120000).toISOString(),
    sceneType: 'office', patientAge: '35', patientGender: '女',
  },
  {
    id: 'task_003',
    type: 'assist',
    title: '交通事故 · 科技园',
    description: '外卖电动车与轿车碰撞，骑手腿部受伤大量出血，需要止血包扎和患者安抚',
    address: '南山区 · 科技园中区',
    distance: 520,
    lat: 22.538, lng: 113.956,
    volunteersNeeded: 3, volunteersResponded: 2, volunteersEnRoute: 0,
    status: 'active', createdAt: new Date(Date.now() - 300000).toISOString(),
    sceneType: 'road', patientAge: '28', patientGender: '男',
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
