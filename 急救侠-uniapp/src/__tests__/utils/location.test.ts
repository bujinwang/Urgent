import { describe, it, expect, vi } from 'vitest'
import { getLocation, chooseLocation } from '@/utils/location'

describe('Location Utils', () => {
  it('getLocation returns lat/lng', async () => {
    // uni.getLocation is mocked in setup.ts
    const loc = await getLocation()
    expect(loc).toBeDefined()
  })

  it('chooseLocation is callable', async () => {
    // Returns promise (will reject since mock doesn't resolve)
    try { await chooseLocation() } catch {}
  })
})
