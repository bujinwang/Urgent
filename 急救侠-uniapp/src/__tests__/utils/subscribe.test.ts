import { describe, it, expect } from 'vitest'
import { requestSubscribe, subscribeToMissions } from '@/utils/subscribe'

describe('Subscribe Utils', () => {
  it('requestSubscribe resolves', async () => {
    const result = await requestSubscribe([])
    expect(result).toBeDefined()
  })

  it('subscribeToMissions resolves', async () => {
    const result = await subscribeToMissions()
    expect(result).toBeDefined()
  })
})
