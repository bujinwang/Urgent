import { describe, it, expect } from 'vitest'
import { getActiveTask, getTaskList, fetchActiveTask, fetchTaskList, acceptTaskApi, completeTaskApi } from '@/api/task'

describe('Task API', () => {
  it('getActiveTask returns a task or null', () => {
    const task = getActiveTask()
    if (task) {
      expect(task.status).toBe('active')
    }
  })

  it('getTaskList returns array', () => {
    expect(Array.isArray(getTaskList())).toBe(true)
  })

  it('fetchActiveTask returns a promise', () => {
    expect(fetchActiveTask()).toBeInstanceOf(Promise)
  })

  it('fetchTaskList returns a promise', () => {
    expect(fetchTaskList()).toBeInstanceOf(Promise)
  })

  it('acceptTaskApi returns a promise', () => {
    expect(acceptTaskApi('task_001')).toBeInstanceOf(Promise)
  })

  it('completeTaskApi returns a promise', () => {
    expect(completeTaskApi('task_001')).toBeInstanceOf(Promise)
  })
})
