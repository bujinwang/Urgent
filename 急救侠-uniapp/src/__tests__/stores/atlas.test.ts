import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAtlasStore } from '@/stores/atlas'

describe('Atlas Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with cards', () => {
    const store = useAtlasStore()
    expect(store.cards.length).toBeGreaterThanOrEqual(1)
  })

  it('has a featured card', () => {
    const store = useAtlasStore()
    const featured = store.cards.find(c => c.featured)
    expect(featured).toBeTruthy()
  })

  it('refresh', () => {
    const store = useAtlasStore()
    store.refresh()
    expect(store.cards.length).toBeGreaterThanOrEqual(1)
  })
})
