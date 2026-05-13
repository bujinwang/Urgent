import { describe, it, expect } from 'vitest'
import { getLessons, getTrainings, fetchLessons, fetchTrainings, updateProgress } from '@/api/learn'

describe('Learn API', () => {
  it('getLessons returns lessons', () => {
    const lessons = getLessons()
    expect(lessons.length).toBeGreaterThanOrEqual(1)
  })

  it('getTrainings returns trainings', () => {
    const trainings = getTrainings()
    expect(trainings.length).toBeGreaterThanOrEqual(1)
  })

  it('fetchLessons returns a promise', () => {
    expect(fetchLessons()).toBeInstanceOf(Promise)
  })

  it('fetchTrainings returns a promise', () => {
    expect(fetchTrainings()).toBeInstanceOf(Promise)
  })

  it('updateProgress returns a promise', () => {
    expect(updateProgress('course_001', 0.8)).toBeInstanceOf(Promise)
  })
})
