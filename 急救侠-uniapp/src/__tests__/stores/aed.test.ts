import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAedStore } from '@/stores/aed'

describe('AED Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with AED list', () => {
    const store = useAedStore()
    expect(store.aeds.length).toBeGreaterThanOrEqual(1)
  })

  it('nearbyAeds sorted by distance', () => {
    const store = useAedStore()
    const sorted = store.nearbyAeds
    for (let i = 1; i < sorted.length; i++)
      expect(sorted[i].distance).toBeGreaterThanOrEqual(sorted[i-1].distance)
  })

  it('selectAed finds by id', () => {
    const store = useAedStore()
    store.selectAed('aed_001')
    expect(store.selectedAed?.id).toBe('aed_001')
  })

  it('selectAed null for unknown', () => {
    const store = useAedStore()
    store.selectAed('zzz')
    expect(store.selectedAed).toBeNull()
  })

  it('discoverAed works', () => {
    const store = useAedStore()
    const aed = store.aeds.find(a => !a.discovered)
    if (aed) {
      expect(store.discoverAed(aed.id)).toBe(true)
      expect(aed.discovered).toBe(true)
    }
  })

  it('discoveryProgress is number', () => {
    expect(typeof useAedStore().discoveryProgress).toBe('number')
  })

  it('refresh', () => {
    const store = useAedStore()
    store.refresh()
    expect(store.aeds.length).toBeGreaterThanOrEqual(1)
  })
})
