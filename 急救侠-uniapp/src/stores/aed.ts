import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getNearbyAeds, getAedById, getDiscoveredCount, getTotalCount } from '@/api/aed'
import type { AedDevice, CheckInRecord } from '@/api/aed'
import { useUserStore } from '@/stores/user'

export const useAedStore = defineStore('aed', () => {
  const aeds = ref<AedDevice[]>(getNearbyAeds())
  const selectedAed = ref<AedDevice | null>(null)
  const totalCount = ref(getTotalCount())

  const discoveredCount = computed(() => aeds.value.filter((a) => a.discovered).length)
  const verifiedCount = computed(() => aeds.value.filter((a) => a.verified).length)

  const nearbyAeds = computed(() =>
    [...aeds.value].sort((a, b) => a.distance - b.distance)
  )

  const discoveryProgress = computed(() =>
    totalCount.value > 0 ? Math.round((discoveredCount.value / totalCount.value) * 100) : 0
  )

  function selectAed(id: string) {
    const found = getAedById(id)
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

    // 首次打卡额外奖励
    const isFirst = aed.checkIns.length === 1
    const points = isFirst ? 30 : 15
    userStore.awardPoints(points, `AED 打卡：${aed.name}`)

    // 通知责任人
    if (aed.custodian) {
      uni.showToast({ title: `演习 · 已模拟通知责任人 ${aed.custodian.name}`, icon: 'none', duration: 2500 })
    }

    return true
  }

  /** 通知责任人 */
  function notifyCustodian(id: string) {
    const aed = aeds.value.find((a) => a.id === id)
    if (!aed || !aed.custodian) return false
    uni.showModal({
      title: '演习模式 · 通知责任人',
      content: `将向 ${aed.custodian.name}（${aed.custodian.phone}）发送设备检查通知。\n\n真实场景下，该责任人会收到短信和 App 推送。`,
      showCancel: false,
      confirmText: '知道了',
    })
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

  function refresh() {
    aeds.value = getNearbyAeds()
    totalCount.value = getTotalCount()
  }

  return {
    aeds,
    selectedAed,
    totalCount,
    discoveredCount,
    verifiedCount,
    nearbyAeds,
    discoveryProgress,
    selectAed,
    discoverAed,
    checkInAed,
    notifyCustodian,
    navigateToAed,
    refresh,
  }
})
