import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchMyAeds, fetchAedLifecycle, addMaintenance, checkinAed,
  type AedLifecycle,
} from '@/api/aed-lifecycle'

export const useAedMgrStore = defineStore('aedMgr', () => {
  const myAeds = ref<any[]>([])
  const lifecycle = ref<AedLifecycle | null>(null)
  const loading = ref(false)

  const aedsNeedingAttention = computed(() =>
    myAeds.value.filter(a =>
      a.status === 'maintenance' ||
      (a.activePickups && a.activePickups > 0) ||
      (a.electrodeExpiry && new Date(a.electrodeExpiry) < new Date(Date.now() + 90 * 86400000))
    )
  )

  function statusLabel(s: string) { return { available:'可用',in_use:'使用中',maintenance:'维护中' }[s]||s }
  function statusColor(s: string) { return { available:'#34D277',in_use:'#4A90E2',maintenance:'#F59E0B' }[s]||'#6B7280' }
  function mtTypeLabel(t: string) {
    return { battery_replacement:'更换电池',electrode_replacement:'更换电极片',inspection:'巡检',repair:'维修',software_update:'软件升级',other:'其他' }[t]||t
  }

  async function loadMyAeds(userId: string) {
    loading.value = true
    try { myAeds.value = await fetchMyAeds(userId) } catch (_) { myAeds.value = [] }
    finally { loading.value = false }
  }
  async function loadLifecycle(aedId: string) {
    try { lifecycle.value = await fetchAedLifecycle(aedId) } catch (_) { lifecycle.value = null }
  }
  async function recordMaintenance(aedId: string, data: { type:string;date:string;performedBy?:string;notes?:string;nextDue?:string }) {
    await addMaintenance(aedId, data); await loadLifecycle(aedId)
  }

  return { myAeds,lifecycle,loading,aedsNeedingAttention,statusLabel,statusColor,mtTypeLabel,loadMyAeds,loadLifecycle,recordMaintenance }
})
