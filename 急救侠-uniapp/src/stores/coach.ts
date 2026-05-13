import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchCoaches, fetchCoachDetail, type CoachSummary, type CoachDetail } from '@/api/coach'

export const useCoachStore = defineStore('coach', () => {
  const list = ref<CoachSummary[]>([])
  const detail = ref<CoachDetail | null>(null)
  const loading = ref(false)

  const availableCoaches = computed(() =>
    list.value.filter((c) => c.available)
  )

  function tierLabel(tier: string) {
    const map: Record<string, string> = { gold: '金牌', silver: '银牌', bronze: '铜牌', diamond: '钻石' }
    return map[tier] || tier
  }

  function tierColor(tier: string): string {
    const map: Record<string, string> = { gold: '#D4A017', silver: '#8BA3B5', bronze: '#B87333', diamond: '#4A90E2' }
    return map[tier] || '#6B7280'
  }

  function specialtyLabel(key: string): string {
    const map: Record<string, string> = {
      CPR: '心肺复苏',
      AED: 'AED操作',
      'First Aid': '急救基础',
      'Trauma Care': '创伤护理',
      'Emergency Response': '应急响应',
    }
    return map[key] || key
  }

  async function loadList() {
    loading.value = true
    try {
      list.value = await fetchCoaches()
    } catch (_) {
      /* fallback to empty */
    } finally {
      loading.value = false
    }
  }

  async function loadDetail(id: string) {
    loading.value = true
    try {
      detail.value = await fetchCoachDetail(id)
    } catch (_) {
      detail.value = null
    } finally {
      loading.value = false
    }
  }

  return {
    list,
    detail,
    loading,
    availableCoaches,
    tierLabel,
    tierColor,
    specialtyLabel,
    loadList,
    loadDetail,
  }
})
