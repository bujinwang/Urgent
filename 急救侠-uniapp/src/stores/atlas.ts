import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAtlasCards, getAtlasCardById, getFeaturedCard } from '@/api/atlas'
import type { AtlasCard } from '@/api/atlas'

export const useAtlasStore = defineStore('atlas', () => {
  const cards = ref<AtlasCard[]>(getAtlasCards())

  /** 推荐卡片（featured 标记，始终为 CPR 心脏骤停） */
  const featuredCard = computed<AtlasCard>(() => getFeaturedCard())

  /** 带 badge 的新增卡片 */
  const newCards = computed<AtlasCard[]>(() =>
    cards.value.filter((c) => c.badge)
  )

  /** 根据 id 获取卡片路由并跳转 */
  function showDetail(id: string) {
    const card = getAtlasCardById(id)
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

  function refresh() {
    cards.value = getAtlasCards()
  }

  return {
    cards,
    featuredCard,
    newCards,
    showDetail,
    goAedPatrol,
    refresh,
  }
})
