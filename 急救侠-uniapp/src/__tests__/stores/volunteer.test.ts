import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useVolunteerStore } from '@/stores/volunteer'

describe('Volunteer Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with leaderboard', () => {
    const store = useVolunteerStore()
    expect(store.leaderboard.length).toBeGreaterThanOrEqual(1)
    expect(store.leaderboard[0].name).toBeTruthy()
  })

  it('supports points leaderboard', () => {
    const store = useVolunteerStore()
    expect(store.currentTab).toBe('points')
  })

  it('can switch to rescue tab', () => {
    const store = useVolunteerStore()
    store.setTab('rescue')
    expect(store.currentTab).toBe('rescue')
    expect(store.leaderboard.length).toBeGreaterThanOrEqual(1)
  })
})
