import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLessons, getTrainings } from '@/api/learn'
import type { Lesson, Training } from '@/api/learn'

export const useLearnStore = defineStore('learn', () => {
  const lessons = ref<Lesson[]>(getLessons())
  const trainings = ref<Training[]>(getTrainings())
  const currentTab = ref<'knowledge' | 'training'>('knowledge')

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

  function refresh() {
    lessons.value = getLessons()
    trainings.value = getTrainings()
  }

  return {
    lessons,
    trainings,
    currentTab,
    featuredLesson,
    totalStudents,
    completedCount,
    setTab,
    startTraining,
    refresh,
  }
})
