import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile, getStats } from '@/api/user'
import { fetchUserOrgRoles, type UserOrgRole } from '@/api/org'

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
  volunteer_type?: string
}

function guestProfile(): UserProfile {
  return { id:'', name:'游客', avatar:'?', tier:'bronze', points:0, city:'', volunteerId:'', certifications:[], rescueCount:0, volunteer_type:'medical' }
}

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = !!uni.getStorageSync('jwt_token')
  const profile = ref<UserProfile>(isLoggedIn ? getProfile() : guestProfile())
  const stats = ref(isLoggedIn ? getStats() : { certifiedRescuers:0, networkedAeds:0, monthlyRescues:0, onlineVolunteers:0, aedsWithin1km:0 })
  const orgRoles = ref<UserOrgRole[]>([])

  const isOrgManager = computed(() => orgRoles.value.length > 0)

  const tierLabel = computed(() => {
    const map: Record<string, string> = { gold:'金牌',silver:'银牌',bronze:'铜牌',diamond:'钻石' }
    return map[profile.value.tier] || profile.value.tier
  })

  function awardPoints(amount: number, reason: string) {
    profile.value.points += amount
    const oldTier = profile.value.tier
    if (profile.value.points >= 5000) profile.value.tier = 'diamond'
    else if (profile.value.points >= 2500) profile.value.tier = 'gold'
    else if (profile.value.points >= 1000) profile.value.tier = 'silver'
    if (profile.value.tier !== oldTier) {
      uni.showToast({ title: `🎉 升级为${tierLabel.value}！`, icon: 'none' })
    }
  }

  function refresh() {
    if (isLoggedIn) { profile.value = getProfile(); stats.value = getStats() }
    loadOrgRoles()
  }

  async function loadOrgRoles() {
    if (!isLoggedIn) return
    try { orgRoles.value = await fetchUserOrgRoles(profile.value.id) } catch (_) { orgRoles.value = [] }
  }

  return { profile, stats, orgRoles, isOrgManager, tierLabel, awardPoints, refresh, loadOrgRoles }
})
