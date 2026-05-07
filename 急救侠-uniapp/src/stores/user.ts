import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile, getStats } from '@/api/user'

export interface UserProfile {
  id: string
  name: string
  avatar: string
  tier: 'bronze' | 'silver' | 'gold' | 'diamond'
  points: number
  city: string
  volunteerId: string
  certifications: string[]
  rescueCount: number
}

export const useUserStore = defineStore('user', () => {
  const profile = ref<UserProfile>(getProfile())
  const stats = ref(getStats())

  const tierLabel = computed(() => {
    const map: Record<string, string> = {
      gold: '金牌', silver: '银牌', bronze: '铜牌', diamond: '钻石',
    }
    return map[profile.value.tier] || profile.value.tier
  })

  function awardPoints(amount: number, reason: string) {
    profile.value.points += amount
    // 模拟：跨阈值升级
    const oldTier = profile.value.tier
    if (profile.value.points >= 5000) profile.value.tier = 'diamond'
    else if (profile.value.points >= 2500) profile.value.tier = 'gold'
    else if (profile.value.points >= 1000) profile.value.tier = 'silver'
    if (profile.value.tier !== oldTier) {
      uni.showToast({ title: `🎉 升级为${tierLabel.value}！`, icon: 'none' })
    }
  }

  function refresh() {
    profile.value = getProfile()
    stats.value = getStats()
  }

  return { profile, stats, tierLabel, awardPoints, refresh }
})
