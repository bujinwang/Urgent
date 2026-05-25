import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getNewsList, getNewsByCategory, getNewsById, fetchNewsList, fetchNewsById } from '@/api/news'
import type { NewsItem } from '@/api/news'

export const useNewsStore = defineStore('news', () => {
  const items = ref<NewsItem[]>(getNewsList())
  const selected = ref<NewsItem | null>(null)
  const activeCategory = ref('recommend')
  const loading = ref(false)

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
    const found = items.value.find((n) => n.id === id) || getNewsById(id)
    if (found) selected.value = found
  }

  async function refresh() {
    loading.value = true
    try {
      items.value = await fetchNewsList()
    } catch {
      items.value = getNewsList()
    }
    loading.value = false
  }

  return {
    items, selected, activeCategory, categories, loading,
    filteredItems, setCategory, selectNews, refresh,
  }
})
