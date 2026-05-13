import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile, getStats, fetchProfile } from '@/api/user'
import { fetchUserOrgRoles, type UserOrgRole } from '@/api/org'

export interface UserProfile {
  id: string; name: string; avatar: string
  tier: 'bronze'|'silver'|'gold'|'diamond'; points: number
  city: string; volunteerId: string; certifications: string[]
  rescueCount: number; volunteer_type?: string
}

function guestProfile(): UserProfile {
  return { id:'', name:'游客', avatar:'?', tier:'' as any, points:0, city:'', volunteerId:'', certifications:[], rescueCount:0, volunteer_type:'medical' }
}

export const useUserStore = defineStore('user', () => {
  const token = uni.getStorageSync('jwt_token') || ''
  const isLoggedIn = !!token
  const profile = ref<UserProfile>(guestProfile())
  const stats = ref(getStats())
  const orgRoles = ref<UserOrgRole[]>([])
  const isOrgManager = computed(() => orgRoles.value.length > 0)
  const tierLabel = computed(() => ({ gold:'金牌',silver:'银牌',bronze:'铜牌',diamond:'钻石' } as any)[profile.value.tier] || profile.value.tier)

  async function init() {
    if (!isLoggedIn) return
    if (token.startsWith('demo_')) { profile.value = getProfile(); await loadOrgRoles(); return }
    try { profile.value = await fetchProfile(); await loadOrgRoles() } catch { profile.value = getProfile() }
  }
  init()

  function awardPoints(amount: number, reason: string) {
    profile.value.points += amount
    const old = profile.value.tier
    if (profile.value.points>=5000) profile.value.tier='diamond'
    else if (profile.value.points>=2500) profile.value.tier='gold'
    else if (profile.value.points>=1000) profile.value.tier='silver'
    if (profile.value.tier!==old) uni.showToast({ title: `🎉 升级为${tierLabel.value}！`, icon: 'none' })
  }

  async function loadOrgRoles() {
    if (!isLoggedIn) return
    try { orgRoles.value = await fetchUserOrgRoles(profile.value.id) } catch (_) { orgRoles.value = [] }
  }

  return { profile, stats, orgRoles, isOrgManager, tierLabel, awardPoints, refresh: init, loadOrgRoles }
})
