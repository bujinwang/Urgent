import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchProfile, fetchStats } from '@/api/user'
import type { UserProfile, PlatformStats } from '@/api/user'
import { fetchUserOrgRoles, type UserOrgRole } from '@/api/org'

/** 未登录时的占位（中性值，非真实用户数据）。 */
const GUEST_PROFILE: UserProfile = {
  id: '', name: '游客', avatar: '?', tier: 'bronze', points: 0,
  city: '', volunteerId: '', certifications: [], rescueCount: 0,
  volunteer_type: 'medical',
}

/** 统计默认零值（未加载前；非伪造数据）。 */
const EMPTY_STATS: PlatformStats = {
  certifiedRescuers: 0, networkedAeds: 0, monthlyRescues: 0, onlineVolunteers: 0, aedsWithin1km: 0,
}

export const useUserStore = defineStore('user', () => {
  const token = uni.getStorageSync('jwt_token') || ''
  const isLoggedIn = !!token

  const profile = ref<UserProfile>({ ...GUEST_PROFILE })
  const stats = ref<PlatformStats>({ ...EMPTY_STATS })
  const orgRoles = ref<UserOrgRole[]>([])
  const error = ref('')
  const isOrgManager = computed(() => orgRoles.value.length > 0)
  const tierLabel = computed(() => {
    const labels: Record<string, string> = { gold: '金牌', silver: '银牌', bronze: '铜牌', diamond: '钻石' }
    return labels[profile.value.tier] || ''
  })

  /** 拉取当前用户资料（真实接口）。失败显式记 error 并抛出。 */
  async function loadProfile(): Promise<void> {
    try {
      profile.value = await fetchProfile()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载用户资料失败'
      throw e
    }
  }

  /** 拉取平台统计（真实接口）。失败显式记 error 并抛出。 */
  async function loadStats(): Promise<void> {
    try {
      stats.value = await fetchStats()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载统计失败'
      throw e
    }
  }

  async function refresh(): Promise<void> {
    if (!isLoggedIn) return
    await Promise.all([loadProfile(), loadStats()])
  }

  /** 积分流水（本地记录奖励理由，上限 50 条）——不再「接收却丢弃」`reason`。 */
  const pointLog = ref<Array<{ amount: number; reason: string; at: number }>>([])

  function awardPoints(amount: number, reason = '') {
    profile.value.points += amount
    const old = profile.value.tier
    if (profile.value.points >= 5000) profile.value.tier = 'diamond'
    else if (profile.value.points >= 2500) profile.value.tier = 'gold'
    else if (profile.value.points >= 1000) profile.value.tier = 'silver'
    pointLog.value.unshift({ amount, reason, at: Date.now() })
    if (pointLog.value.length > 50) pointLog.value.pop()
    if (profile.value.tier !== old) uni.showToast({ title: `🎉 升级为${tierLabel.value}！`, icon: 'none' })
  }

  async function loadOrgRoles(): Promise<void> {
    try {
      orgRoles.value = await fetchUserOrgRoles(profile.value.id)
    } catch {
      orgRoles.value = []
    }
  }

  // 首次使用自动加载（登录且非 demo 账号）
  if (isLoggedIn && !token.startsWith('demo_')) {
    void refresh().catch(() => { /* 错误已记录于 error */ })
  }
  if (isLoggedIn) void loadOrgRoles()

  return { profile, stats, orgRoles, isOrgManager, tierLabel, error, pointLog, awardPoints, refresh, loadProfile, loadStats, loadOrgRoles }
})
