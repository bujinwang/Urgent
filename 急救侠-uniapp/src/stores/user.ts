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

  function refresh() {
    profile.value = getProfile()
    stats.value = getStats()
  }

  return { profile, stats, tierLabel, refresh }
})
