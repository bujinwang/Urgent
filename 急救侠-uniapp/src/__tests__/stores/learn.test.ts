import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { request } from '@/api/index'
import { useLearnStore } from '@/stores/learn'

const courses = [
  { id: 'course_001', title: 'CPR 基础', category: '知识库', duration: '15分钟', completed: false, progress: 0.5, icon: '❤️' },
  { id: 'course_002', title: 'AED 使用', category: '知识库', duration: '8分钟', completed: true, progress: 1, icon: '⚡' },
]

describe('Learn Store（真实接口）', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(request).mockReset() })

  it('从真实接口加载课程并映射', async () => {
    vi.mocked(request).mockResolvedValue(courses)
    const store = useLearnStore()
    await store.refresh()
    expect(store.lessons).toHaveLength(2)
    expect(store.lessons[0]).toMatchObject({ id: 1, title: 'CPR 基础', done: false })
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/learn/courses' })
  })

  it('computes featured lesson（首个未完成）', async () => {
    vi.mocked(request).mockResolvedValue(courses)
    const store = useLearnStore()
    await store.refresh()
    expect(store.featuredLesson?.title).toBe('CPR 基础')
    expect(store.completedCount).toBe(1)
  })

  it('startTraining 返回本地训练入口路由', async () => {
    vi.mocked(request).mockResolvedValue(courses)
    const store = useLearnStore()
    await store.refresh()
    expect(store.startTraining('cpr')).toBeTruthy()
    expect(store.startTraining('nope')).toBeNull()
  })
})
