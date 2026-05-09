import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getLeaderboard, type LeaderboardType, type VolunteerRankEntry } from '@/api/volunteer'
import { useUserStore } from '@/stores/user'

export interface LeaderboardItem {
  id: number
  avatar: string
  name: string
  meta: string
  score: string
  me: boolean
  color: string
}

export const useVolunteerStore = defineStore('volunteer', () => {
  const rawData = ref<VolunteerRankEntry[]>(getLeaderboard('points'))
  const currentTab = ref<LeaderboardType>('points')

  /** 合并用户 profile 后的排行榜展示数据 */
  const leaderboard = computed<LeaderboardItem[]>(() => {
    const userStore = useUserStore()
    return rawData.value.map((entry, i) => {
      if (entry.isMe) {
        return {
          id: entry.id,
          avatar: userStore.profile.avatar,
          name: userStore.profile.name,
          meta: `${userStore.profile.volunteerId} · ${userStore.profile.rescueCount}次`,
          score: currentTab.value === 'points'
            ? userStore.profile.points.toLocaleString()
            : String(userStore.profile.rescueCount),
          me: true,
          color: 'linear-gradient(135deg,var(--rescue-red),var(--rescue-red-deep))',
        }
      }
      return {
        id: entry.id,
        avatar: entry.avatar,
        name: entry.name,
        meta: `${entry.volunteerId} · ${entry.rescueCount}次`,
        score: currentTab.value === 'points'
          ? entry.points.toLocaleString()
          : String(entry.rescueCount),
        me: false,
        color: leaderboardColor(i),
      }
    })
  })

  const myRank = computed(() => {
    return leaderboard.value.findIndex((e) => e.me) + 1
  })

  function leaderboardColor(index: number): string {
    const colors = [
      'linear-gradient(135deg,#C0392B,#8B2A1F)',
      'linear-gradient(135deg,#1F8A5B,#147547)',
      'linear-gradient(135deg,#4A90E2,#2563EB)',
      'linear-gradient(135deg,#C8A656,#B8941A)',
      'linear-gradient(135deg,var(--rescue-red-soft),#C0392B)',
      'linear-gradient(135deg,#6B7280,#4B5563)',
      'linear-gradient(135deg,#8E6F47,#6B5030)',
      'linear-gradient(135deg,#475569,#334155)',
      'linear-gradient(135deg,#78716C,#57534E)',
      'linear-gradient(135deg,#9CA3AF,#6B7280)',
    ]
    return colors[index] || 'linear-gradient(135deg,#6B7280,#4B5563)'
  }

  function rankClass(index: number) {
    if (index === 0) return 'top1'
    if (index === 1) return 'top2'
    if (index === 2) return 'top3'
    return ''
  }

  /** 切换排行类型并重新加载数据 */
  function setTab(type: LeaderboardType) {
    currentTab.value = type
    rawData.value = getLeaderboard(type)
  }

  function refresh() {
    rawData.value = getLeaderboard(currentTab.value)
  }

  return { leaderboard, currentTab, myRank, rankClass, setTab, refresh }
})
