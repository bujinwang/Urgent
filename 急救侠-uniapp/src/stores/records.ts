import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchRecords } from '@/api/records'
import type { RescueRecord } from '@/api/records'

export const useRecordsStore = defineStore('records', () => {
  const records = ref<RescueRecord[]>([])
  const selected = ref<RescueRecord | null>(null)
  const loading = ref(false)
  const error = ref('')

  const totalRescues = computed(() => records.value.length)
  const successCount = computed(() => records.value.filter((r) => r.outcome === 'success').length)
  const aedUsageCount = computed(() => records.value.filter((r) => r.aedUsed).length)

  /** 按角色分类统计 */
  const roleStats = computed(() => {
    const map: Record<string, number> = {}
    records.value.forEach((r) => {
      map[r.role] = (map[r.role] || 0) + 1
    })
    return map
  })

  function selectRecord(id: string) {
    const found = records.value.find((r) => r.id === id)
    if (found) selected.value = found
  }

  /** 拉取真实记录。失败时显式记 `error` 并抛出（不静默兜底）。 */
  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      records.value = await fetchRecords()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载救援记录失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  void refresh().catch(() => { /* 错误已记录于 error */ })

  return {
    records,
    selected,
    loading,
    error,
    totalRescues,
    successCount,
    aedUsageCount,
    roleStats,
    selectRecord,
    refresh,
  }
})
