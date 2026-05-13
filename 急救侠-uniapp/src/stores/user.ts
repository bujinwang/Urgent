import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getProfile, getStats, fetchProfile } from '@/api/user'
import { fetchUserOrgRoles, type UserOrgRole } from '@/api/org'

function guestProfile(): any {
  return { id:'', name:'游客', avatar:'?', tier:'', points:0, city:'', volunteerId:'', certifications:[], rescueCount:0, volunteer_type:'medical' }
}

export const useUserStore = defineStore('user', () => {
  const token = uni.getStorageSync('jwt_token') || ''
  const isLoggedIn = !!token

  const profile = ref(isLoggedIn ? getProfile() : guestProfile())
  const stats = ref(getStats())
  const orgRoles = ref<any[]>([])
  const isOrgManager = computed(() => orgRoles.value.length > 0)
  const tierLabel = computed(() => ({ gold:'金牌',silver:'银牌',bronze:'铜牌',diamond:'钻石' } as any)[profile.value.tier] || '')

  if (isLoggedIn && !token.startsWith('demo_')) {
    fetchProfile().then(p => { profile.value = p }).catch(() => {})
  }

  function awardPoints(amount: number) {
    profile.value.points += amount
    const old = profile.value.tier
    if (profile.value.points>=5000) profile.value.tier='diamond'
    else if (profile.value.points>=2500) profile.value.tier='gold'
    else if (profile.value.points>=1000) profile.value.tier='silver'
    if (profile.value.tier!==old) uni.showToast({ title: `🎉 升级为${tierLabel.value}！`, icon: 'none' })
  }

  if (isLoggedIn) loadOrgRoles()
  async function loadOrgRoles() {
    try { orgRoles.value = await fetchUserOrgRoles(profile.value.id) } catch (_) { orgRoles.value = [] }
  }

  return { profile, stats, orgRoles, isOrgManager, tierLabel, awardPoints, refresh: ()=>{}, loadOrgRoles }
})
