import { describe, it, expect, vi } from 'vitest'
import { request } from '@/api/index'
import { fetchLessons, fetchTrainings, updateProgress, mapLesson, TRAININGS } from '@/api/learn'
import type { ApiCourse } from '@/api/learn'

const raw: ApiCourse = {
  id: 'course_001', title: 'CPR 基础', category: '知识库',
  duration: '15分钟', completed: false, progress: 0.5,
}

describe('Learn API（真实接口）', () => {
  it('fetchLessons 调用 /learn/courses', () => {
    void fetchLessons()
    expect(vi.mocked(request)).toHaveBeenCalledWith({ url: '/learn/courses' })
  })

  it('fetchTrainings 返回本地训练入口配置（后端无该端点）', async () => {
    const t = await fetchTrainings()
    expect(t.length).toBe(TRAININGS.length)
    expect(t[0].route).toBeTruthy()
  })

  it('updateProgress 调用 POST /learn/progress', () => {
    void updateProgress('course_001', 0.8)
    expect(vi.mocked(request)).toHaveBeenCalledWith({
      url: '/learn/progress', method: 'POST', data: { courseId: 'course_001', progress: 0.8 },
    })
  })

  it('mapLesson 显式映射（id←序号、students 默认 0）', () => {
    expect(mapLesson(raw, 0)).toMatchObject({
      id: 1, title: 'CPR 基础', duration: '15分钟', done: false, students: 0,
    })
  })
})
