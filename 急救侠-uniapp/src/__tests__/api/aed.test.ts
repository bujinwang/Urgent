import { describe, it, expect } from 'vitest'
import { getNearbyAeds, getAedById, fetchAedList, fetchAedById } from '@/api/aed'

describe('AED API', () => {
  it('getNearbyAeds returns devices', () => {
    const list = getNearbyAeds()
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0].id).toBeTruthy()
  })

  it('getAedById finds existing device', () => {
    const aed = getAedById('aed_001')
    expect(aed).toBeDefined()
    expect(aed?.name).toBeTruthy()
  })

  it('getAedById returns undefined for unknown', () => {
    const aed = getAedById('nonexistent')
    expect(aed).toBeUndefined()
  })

  it('fetchAedList returns a promise', () => {
    expect(fetchAedList()).toBeInstanceOf(Promise)
  })

  it('fetchAedById returns a promise', () => {
    expect(fetchAedById('aed_001')).toBeInstanceOf(Promise)
  })
})
