import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/task'

describe('Task Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with active task', () => {
    const store = useTaskStore()
    expect(store.activeTask?.type).toBe('cpr')
    expect(store.activeTask?.status).toBe('active')
  })

  it('hasMission computed', () => {
    const store = useTaskStore()
    expect(store.hasMission).toBe(true)
  })

  it('acceptMission transitions to running', () => {
    const store = useTaskStore()
    store.acceptMission()
    expect(store.missionPhase).toBe('running')
  })

  it('arrive transitions to arrived', () => {
    const store = useTaskStore()
    store.arrive()
    expect(store.missionPhase).toBe('arrived')
  })

  it('finishMission resets state', () => {
    const store = useTaskStore()
    store.finishMission()
    expect(store.activeTask).toBeNull()
  })
})
