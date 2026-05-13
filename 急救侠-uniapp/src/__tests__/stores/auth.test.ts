import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'

describe('Auth Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with no token', () => {
    const store = useAuthStore()
    expect(store.token).toBe('mock-token-123')
    expect(store.isLoggedIn).toBe(true)
  })

  it('logout clears token', () => {
    const store = useAuthStore()
    store.logout()
    expect(store.token).toBe('')
  })

  it('provides authHeader', () => {
    const store = useAuthStore()
    const header = store.authHeader()
    expect(header.Authorization).toContain('Bearer')
  })
})
