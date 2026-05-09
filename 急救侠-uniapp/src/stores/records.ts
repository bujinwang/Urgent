import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getRescueRecords, getRecordById } from '@/api/records'
import type { RescueRecord } from '@/api/records'

export const useRecordsStore = defineStore('records', () => {
  const records = ref<RescueRecord[]>(getRescueRecords())
  const selected = ref<RescueRecord | null>(null)

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
    const found = getRecordById(id)
    if (found) selected.value = found
  }

  function refresh() {
    records.value = getRescueRecords()
  }

  return {
    records,
    selected,
    totalRescues,
    successCount,
    aedUsageCount,
    roleStats,
    selectRecord,
    refresh,
  }
})
