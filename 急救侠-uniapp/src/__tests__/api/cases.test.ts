import { describe, it, expect } from 'vitest'
import { getCasesList, getCaseById, fetchCases, fetchCaseByIdApi } from '@/api/cases'

describe('Cases API', () => {
  it('getCasesList returns cases', () => {
    const cases = getCasesList()
    expect(cases.length).toBeGreaterThanOrEqual(1)
  })

  it('getCaseById finds existing case', () => {
    const c = getCaseById('case_park')
    expect(c).toBeDefined()
    expect(c?.title).toBeTruthy()
  })

  it('getCaseById returns undefined for unknown', () => {
    expect(getCaseById('zzz')).toBeUndefined()
  })

  it('fetchCases returns a promise', () => {
    expect(fetchCases()).toBeInstanceOf(Promise)
  })

  it('fetchCaseByIdApi returns a promise', () => {
    expect(fetchCaseByIdApi('case_park')).toBeInstanceOf(Promise)
  })
})
