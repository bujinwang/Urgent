import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getCaseById, getCaseByNewsId, getCasesList } from '@/api/cases'
import type { RescueCase } from '@/api/cases'

export const useCaseStore = defineStore('cases', () => {
  const items = ref<RescueCase[]>(getCasesList())
  const selected = ref<RescueCase | null>(null)

  function selectCase(id: string) {
    const found = getCaseById(id)
    if (found) selected.value = found
  }

  function selectByNewsId(newsId: string) {
    const found = getCaseByNewsId(newsId)
    if (found) selected.value = found
  }

  function refresh() {
    items.value = getCasesList()
  }

  return { items, selected, selectCase, selectByNewsId, refresh }
})
