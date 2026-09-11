import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchLeaderboard, type LeaderboardType, type VolunteerRankEntry } from '@/api/volunteer'
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
  const rawData = ref<VolunteerRankEntry[]>([])
  const currentTab = ref<LeaderboardType>('points')
  const loading = ref(false)
  const error = ref('')

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

  const myRank = computed(() => leaderboard.value.findIndex((e) => e.me) + 1)

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

  /** 拉取真实榜单；按姓名匹配标记「我」。失败显式记 error 并抛出。 */
  async function load(type: LeaderboardType): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const list = await fetchLeaderboard(type)
      const userStore = useUserStore()
      const myName = userStore.profile.name
      rawData.value = list.map((entry) => ({ ...entry, isMe: !!myName && entry.name === myName }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载排行榜失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 切换排行类型并重新加载数据 */
  function setTab(type: LeaderboardType) {
    currentTab.value = type
    void load(type).catch(() => { /* 错误已记录于 error */ })
  }

  async function refresh(): Promise<void> {
    await load(currentTab.value)
  }

  void load(currentTab.value).catch(() => { /* 错误已记录于 error */ })

  return { leaderboard, currentTab, loading, error, myRank, rankClass, setTab, refresh }
})
