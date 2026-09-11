import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchNewsList } from '@/api/news'
import type { NewsItem } from '@/api/news'

export const useNewsStore = defineStore('news', () => {
  const items = ref<NewsItem[]>([])
  const selected = ref<NewsItem | null>(null)
  const activeCategory = ref('recommend')
  const loading = ref(false)
  const error = ref('')

  const categories = [
    { id: 'recommend', label: '推荐' },
    { id: 'video', label: '视频' },
    { id: 'nearby', label: '附近' },
    { id: 'volunteer', label: '志愿者' },
  ]

  const filteredItems = computed(() => {
    if (activeCategory.value === 'recommend') return items.value
    return items.value.filter((n) => n.category === activeCategory.value)
  })

  function setCategory(id: string) {
    activeCategory.value = id
  }

  function selectNews(id: string) {
    const found = items.value.find((n) => n.id === id) || selected.value
    if (found && found.id === id) selected.value = found
  }

  /** 拉取真实动态。失败时显式记 `error` 并抛出（不静默兜底）。 */
  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      items.value = await fetchNewsList()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载动态失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  void refresh().catch(() => { /* 错误已记录于 error */ })

  return {
    items, selected, activeCategory, categories, loading, error,
    filteredItems, setCategory, selectNews, refresh,
  }
})
