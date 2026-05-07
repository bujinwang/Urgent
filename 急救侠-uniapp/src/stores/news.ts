import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getNewsList, getNewsByCategory, getNewsById } from '@/api/news'
import type { NewsItem } from '@/api/news'

export const useNewsStore = defineStore('news', () => {
  const items = ref<NewsItem[]>(getNewsList())
  const selected = ref<NewsItem | null>(null)
  const activeCategory = ref('recommend')

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
    const found = getNewsById(id)
    if (found) selected.value = found
  }

  function refresh() {
    items.value = getNewsList()
  }

  return {
    items, selected, activeCategory, categories,
    filteredItems, setCategory, selectNews, refresh,
  }
})
