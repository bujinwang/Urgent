import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCaseStore } from '@/stores/cases'

describe('Cases Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with cases', () => {
    const store = useCaseStore()
    expect(store.items.length).toBeGreaterThanOrEqual(1)
    expect(store.items[0].id).toBeTruthy()
  })

  it('selectCase finds by id', () => {
    const store = useCaseStore()
    store.selectCase('case_park')
    expect(store.selected?.id).toBe('case_park')
  })

  it('selectCase null for unknown', () => {
    const store = useCaseStore()
    store.selectCase('zzz')
    expect(store.selected).toBeNull()
  })
})
