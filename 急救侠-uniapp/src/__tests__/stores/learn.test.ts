import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLearnStore } from '@/stores/learn'

describe('Learn Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with lessons', () => {
    const store = useLearnStore()
    expect(store.lessons.length).toBeGreaterThanOrEqual(1)
    expect(store.trainings.length).toBeGreaterThanOrEqual(1)
  })

  it('computes featured lesson', () => {
    const store = useLearnStore()
    expect(store.featuredLesson).toBeTruthy()
  })

  it('defaults to knowledge tab', () => {
    const store = useLearnStore()
    expect(store.currentTab).toBe('knowledge')
  })

  it('setTab switches tabs', () => {
    const store = useLearnStore()
    store.setTab('training')
    expect(store.currentTab).toBe('training')
  })

  it('startTraining returns route', () => {
    const store = useLearnStore()
    const route = store.startTraining('cpr')
    expect(route).toBeTruthy()
  })
})
