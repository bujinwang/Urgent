import { describe, it, expect } from 'vitest'
import { getRescueRecords, fetchRecords } from '@/api/records'

describe('Records API', () => {
  it('getRescueRecords returns records', () => {
    const records = getRescueRecords()
    expect(records.length).toBeGreaterThanOrEqual(1)
    expect(records[0].role).toBeTruthy()
    expect(records[0].squad).toBeInstanceOf(Array)
  })

  it('fetchRecords returns a promise', () => {
    expect(fetchRecords()).toBeInstanceOf(Promise)
  })
})
