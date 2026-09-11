import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchAedList } from '@/api/aed'
import type { AedDevice, CheckInRecord } from '@/api/aed'
import { useUserStore } from '@/stores/user'

export const useAedStore = defineStore('aed', () => {
  const aeds = ref<AedDevice[]>([])
  const selectedAed = ref<AedDevice | null>(null)
  const loading = ref(false)
  const error = ref('')

  const totalCount = computed(() => aeds.value.length)
  const discoveredCount = computed(() => aeds.value.filter((a) => a.discovered).length)
  const verifiedCount = computed(() => aeds.value.filter((a) => a.verified).length)

  const nearbyAeds = computed(() =>
    [...aeds.value].sort((a, b) => a.distance - b.distance)
  )

  const discoveryProgress = computed(() =>
    totalCount.value > 0 ? Math.round((discoveredCount.value / totalCount.value) * 100) : 0
  )

  function selectAed(id: string) {
    const found = aeds.value.find((a) => a.id === id)
    if (found) selectedAed.value = found
  }

  function discoverAed(id: string) {
    const aed = aeds.value.find((a) => a.id === id)
    if (aed && !aed.discovered) {
      aed.discovered = true
      const userStore = useUserStore()
      userStore.awardPoints(10, `发现 AED：${aed.name}`)
      return true
    }
    return false
  }

  /** 打卡验证（拍照 + 状态 + 找设备提示） */
  function checkInAed(id: string, photo: string, status: 'ok' | 'issue', comment: string, findingTip?: string): boolean {
    const aed = aeds.value.find((a) => a.id === id)
    if (!aed) return false

    const userStore = useUserStore()
    const record: CheckInRecord = {
      id: 'ci_' + Date.now(),
      userId: userStore.profile.id,
      userName: userStore.profile.name,
      photo,
      date: new Date().toISOString().slice(0, 10),
      status,
      comment,
      findingTip,
    }
    aed.checkIns.unshift(record)
    aed.verified = status === 'ok'
    aed.lastCheck = record.date

    const isFirst = aed.checkIns.length === 1
    const points = isFirst ? 30 : 15
    userStore.awardPoints(points, `AED 打卡：${aed.name}`)

    return true
  }

  /** 导航到 AED */
  function navigateToAed(aed: AedDevice) {
    uni.openLocation({
      latitude: aed.lat,
      longitude: aed.lng,
      name: aed.name,
      address: aed.address,
      scale: 18,
    })
  }

  /** 拉取真实 AED 列表。失败时显式记 `error` 并抛出（不静默兜底）。 */
  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const list = await fetchAedList()
      const oldMap = new Map(aeds.value.map((a) => [a.id, a]))
      for (const a of list) {
        const old = oldMap.get(a.id)
        if (old) {
          a.discovered = old.discovered
          a.verified = old.verified
          a.checkIns = old.checkIns
        }
      }
      aeds.value = list
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载 AED 失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  void refresh().catch(() => { /* 错误已记录于 error */ })

  return {
    aeds,
    selectedAed,
    loading,
    error,
    totalCount,
    discoveredCount,
    verifiedCount,
    nearbyAeds,
    discoveryProgress,
    selectAed,
    discoverAed,
    checkInAed,
    navigateToAed,
    refresh,
  }
})
