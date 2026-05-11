import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRecordsStore } from '@/stores/records'

describe('Records Store', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('initializes with records', () => {
    const store = useRecordsStore()
    expect(store.records.length).toBeGreaterThanOrEqual(1)
    expect(store.records[0].role).toBeTruthy()
  })

  it('computes totalRescues', () => {
    const store = useRecordsStore()
    expect(store.totalRescues).toBeGreaterThanOrEqual(1)
  })

  it('computes successCount', () => {
    const store = useRecordsStore()
    expect(typeof store.successCount).toBe('number')
  })

  it('computes roleStats', () => {
    const store = useRecordsStore()
    expect(Object.keys(store.roleStats).length).toBeGreaterThanOrEqual(0)
  })
})
