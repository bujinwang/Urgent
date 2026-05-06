import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface LeaderboardEntry {
  id: number
  avatar: string
  name: string
  meta: string
  score: string
  me: boolean
}

export const useVolunteerStore = defineStore('volunteer', () => {
  const leaderboard = ref<LeaderboardEntry[]>([
    { id: 1, avatar: '张', name: '张医生', meta: 'SZ-001 · 32次', score: '5,890', me: false },
    { id: 2, avatar: '李', name: '李护士', meta: 'SZ-005 · 28次', score: '4,720', me: false },
    { id: 3, avatar: '王', name: '王教练', meta: 'SZ-018 · 19次', score: '3,450', me: false },
    { id: 4, avatar: '赵', name: '赵老师', meta: 'SZ-007 · 15次', score: '2,980', me: false },
    { id: 5, avatar: '陆', name: '陆远', meta: 'SZ-012 · 12次', score: '2,340', me: true },
    { id: 6, avatar: '陈', name: '陈同学', meta: 'SZ-031 · 9次', score: '1,890', me: false },
  ])

  const currentTab = ref<'monthly' | 'count'>('monthly')

  const myRank = computed(() => {
    return leaderboard.value.findIndex((e) => e.me) + 1
  })

  function rankClass(index: number) {
    if (index === 0) return 'top1'
    if (index === 1) return 'top2'
    if (index === 2) return 'top3'
    return ''
  }

  return { leaderboard, currentTab, myRank, rankClass }
})
