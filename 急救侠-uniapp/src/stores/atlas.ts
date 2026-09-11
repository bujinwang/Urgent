import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAtlasCards } from '@/api/atlas'
import type { AtlasCard } from '@/api/atlas'

export const useAtlasStore = defineStore('atlas', () => {
  const cards = ref<AtlasCard[]>([])
  const loading = ref(false)
  const error = ref('')

  /** 推荐卡片（CPR）；数据未就绪时为 undefined。 */
  const featuredCard = computed<AtlasCard | undefined>(() =>
    cards.value.find((c) => c.featured) || cards.value[0]
  )

  /** 带 badge 的卡片 */
  const newCards = computed<AtlasCard[]>(() => cards.value.filter((c) => c.badge))

  /** 根据 id 获取卡片路由并跳转 */
  function showDetail(id: string) {
    const card = cards.value.find((c) => c.id === id)
    if (!card) return
    if (card.id === 'aed') {
      uni.switchTab({ url: card.route })
    } else {
      uni.navigateTo({ url: card.route })
    }
  }

  /** 跳转到 AED 巡检快捷入口 */
  function goAedPatrol() {
    uni.switchTab({ url: '/pages/aed/index' })
  }

  /** 拉取真实卡片。失败时显式记 `error` 并抛出（不静默兜底）。 */
  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      cards.value = await fetchAtlasCards()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载急救图谱失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  void refresh().catch(() => { /* 错误已记录于 error */ })

  return { cards, loading, error, featuredCard, newCards, showDetail, goAedPatrol, refresh }
})
