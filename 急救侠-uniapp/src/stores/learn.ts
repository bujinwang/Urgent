import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchLessons, fetchTrainings } from '@/api/learn'
import type { Lesson, Training } from '@/api/learn'

export const useLearnStore = defineStore('learn', () => {
  const lessons = ref<Lesson[]>([])
  const trainings = ref<Training[]>([])
  const currentTab = ref<'knowledge' | 'training'>('knowledge')
  const loading = ref(false)
  const error = ref('')

  /** 推荐课程（取第一个未完成的，若无则取第一个） */
  const featuredLesson = computed(() => {
    const undone = lessons.value.find((l) => !l.done)
    return undone || lessons.value[0]
  })

  const totalStudents = computed(() =>
    lessons.value.reduce((sum, l) => sum + l.students, 0)
  )

  const completedCount = computed(() =>
    lessons.value.filter((l) => l.done).length
  )

  function setTab(tab: 'knowledge' | 'training') {
    currentTab.value = tab
  }

  function startTraining(id: string): string | null {
    const training = trainings.value.find((t) => t.id === id)
    return training?.route || null
  }

  /** 拉取真实课程/训练。失败时显式记 `error` 并抛出（不静默兜底）。 */
  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const [l, t] = await Promise.all([fetchLessons(), fetchTrainings()])
      lessons.value = l
      trainings.value = t
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载学习内容失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  void refresh().catch(() => { /* 错误已记录于 error */ })

  return {
    lessons,
    trainings,
    currentTab,
    loading,
    error,
    featuredLesson,
    totalStudents,
    completedCount,
    setTab,
    startTraining,
    refresh,
  }
})
