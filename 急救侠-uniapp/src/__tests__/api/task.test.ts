import { describe, it, expect, vi } from 'vitest'
import { request } from '@/api/index'
import { fetchActiveTask, fetchTaskList, acceptTaskApi, completeTaskApi, mapRescueTask } from '@/api/task'
import type { ApiRescueTask } from '@/api/task'

const raw: ApiRescueTask = {
  id: 'task_001', type: 'cpr', address: '深圳湾公园南门', distance: 100,
  lat: 22.517, lng: 113.947, volunteersNeeded: 3, volunteersResponded: 3,
  status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
}

describe('Task API（真实接口）', () => {
  it('fetchActiveTask 调用 /task/active', () => {
    void fetchActiveTask()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/task/active' })
  })

  it('fetchTaskList 调用 /task/list', () => {
    void fetchTaskList()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/task/list' })
  })

  it('accept/complete 调用 POST 端点', () => {
    void acceptTaskApi('task_001')
    void completeTaskApi('task_001')
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/task/accept', method: 'POST', data: { taskId: 'task_001' } })
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/task/complete', method: 'POST', data: { taskId: 'task_001' } })
  })

  it('mapRescueTask 显式映射（title←address、enRoute 派生）', () => {
    const t = mapRescueTask(raw)
    expect(t).toMatchObject({
      id: 'task_001', type: 'cpr', title: '深圳湾公园南门',
      status: 'active', volunteersEnRoute: 0,
    })
  })
})
