import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNewsStore } from '@/stores/news'

describe('News Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with news items', () => {
    const store = useNewsStore()
    expect(store.items.length).toBeGreaterThanOrEqual(1)
  })

  it('initially shows all items (recommend)', () => {
    const store = useNewsStore()
    expect(store.activeCategory).toBe('recommend')
  })

  it('setCategory filters items', () => {
    const store = useNewsStore()
    store.setCategory('video')
    expect(store.activeCategory).toBe('video')
  })

  it('selectNews finds by id', () => {
    const store = useNewsStore()
    const first = store.items[0]
    store.selectNews(first.id)
    expect(store.selected?.id).toBe(first.id)
  })

  it('filteredItems respects category', () => {
    const store = useNewsStore()
    store.setCategory('video')
    store.filteredItems.forEach(n => {
      expect(n.category).toBe('video')
    })
  })
})
