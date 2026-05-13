import { describe, it, expect } from 'vitest'
import { getAtlasCards, fetchAtlasCards } from '@/api/atlas'

describe('Atlas API', () => {
  it('getAtlasCards returns cards', () => {
    const cards = getAtlasCards()
    expect(cards.length).toBeGreaterThanOrEqual(1)
    expect(cards[0].title).toBeTruthy()
  })

  it('fetchAtlasCards returns a promise', () => {
    expect(fetchAtlasCards()).toBeInstanceOf(Promise)
  })
})
