import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchCases } from '@/api/cases'
import type { RescueCase } from '@/api/cases'

export const useCaseStore = defineStore('cases', () => {
  const items = ref<RescueCase[]>([])
  const selected = ref<RescueCase | null>(null)
  const loading = ref(false)
  const error = ref('')

  function selectCase(id: string) {
    const found = items.value.find((c) => c.id === id)
    if (found) selected.value = found
  }

  /** 后端未返回 newsId，按新闻 ID 关联案例当前不可用（见交付映射表）。 */
  function selectByNewsId(newsId: string) {
    const found = items.value.find((c) => c.newsId === newsId)
    if (found) selected.value = found
  }

  /** 拉取真实案例。失败时显式记 `error` 并抛出（不静默兜底）。 */
  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      items.value = await fetchCases()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载救援案例失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  void refresh().catch(() => { /* 错误已记录于 error */ })

  return { items, selected, loading, error, selectCase, selectByNewsId, refresh }
})
