import { describe, it, expect } from 'vitest'
import { getLeaderboard, fetchLeaderboard } from '@/api/volunteer'

describe('Volunteer API', () => {
  it('getLeaderboard returns entries', () => {
    const entries = getLeaderboard()
    expect(entries.length).toBeGreaterThanOrEqual(1)
    expect(entries[0].name).toBeTruthy()
  })

  it('getLeaderboard entries have points', () => {
    getLeaderboard().forEach(e => {
      expect(typeof e.points).toBe('number')
      expect(typeof e.rescueCount).toBe('number')
    })
  })

  it('getLeaderboard supports rescue type', () => {
    const entries = getLeaderboard('rescue')
    expect(entries.length).toBeGreaterThanOrEqual(1)
  })

  it('fetchLeaderboard returns a promise', () => {
    expect(fetchLeaderboard()).toBeInstanceOf(Promise)
  })
})
