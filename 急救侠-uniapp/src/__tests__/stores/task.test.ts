import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useTaskStore } from '@/stores/task'

const rawActive = {
  id: 'task_001', type: 'cpr', address: '深圳湾公园南门', distance: 100,
  lat: 22.517, lng: 113.947, volunteersNeeded: 3, volunteersResponded: 3,
  status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
}
const rawList = [rawActive]

/** 任务 store 首次创建会自动拉取（active + list 两个请求），这里同步喂两次 mock。 */
async function mountStore() {
  vi.mocked(request).mockResolvedValueOnce(rawActive).mockResolvedValueOnce(rawList)
  const store = useTaskStore()
  await new Promise((r) => setTimeout(r, 0))
  return store
}

describe('Task Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载活跃任务与列表', async () => {
    const store = await mountStore()
    expect(store.activeTask?.id).toBe('task_001')
    expect(store.tasks).toHaveLength(1)
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/task/active' })
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/task/list' })
  })

  it('hasMission computed 依赖活跃任务', async () => {
    const store = await mountStore()
    expect(store.hasMission).toBe(true)
  })

  it('任务相位机：acceptMission → running、arrive → arrived、finishMission → 复位', async () => {
    const store = await mountStore()
    store.acceptMission()
    expect(store.missionAccepted).toBe(true)
    expect(store.missionPhase).toBe('running')
    expect(store.runningDistance).toBe(100)
    expect(store.hasMission).toBe(false)

    store.arrive()
    expect(store.missionPhase).toBe('arrived')

    store.finishMission()
    expect(store.missionAccepted).toBe(false)
    expect(store.missionPhase).toBe('idle')
    expect(store.activeTask).toBeNull()
    expect(store.runningDistance).toBe(240)
  })
})
