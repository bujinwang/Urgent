import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLessons, getTrainings, fetchLessons, fetchTrainings } from '@/api/learn'
import type { Lesson, Training } from '@/api/learn'

export const useLearnStore = defineStore('learn', () => {
  const lessons = ref<Lesson[]>(getLessons())
  const trainings = ref<Training[]>(getTrainings())
  const currentTab = ref<'knowledge' | 'training'>('knowledge')
  const loading = ref(false)

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

  async function refresh() {
    loading.value = true
    try {
      const [l, t] = await Promise.all([fetchLessons(), fetchTrainings()])
      lessons.value = l
      trainings.value = t
    } catch {
      lessons.value = getLessons()
      trainings.value = getTrainings()
    }
    loading.value = false
  }

  return {
    lessons,
    trainings,
    currentTab,
    loading,
    featuredLesson,
    totalStudents,
    completedCount,
    setTab,
    startTraining,
    refresh,
  }
})
