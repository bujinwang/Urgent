import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchActiveTask, fetchTaskList } from '@/api/task'

export interface RescueTask {
  id: string
  type: 'cpr' | 'aed' | 'assist'
  title: string
  description: string
  address: string
  distance: number
  lat: number
  lng: number
  volunteersNeeded: number
  volunteersResponded: number
  volunteersEnRoute: number
  status: 'pending' | 'active' | 'completed'
  createdAt: string
  sceneType: string
  patientAge?: string
  patientGender?: string
  liveCount?: number
}

export type MissionPhase = 'idle' | 'confirming' | 'running' | 'arrived'

export const useTaskStore = defineStore('task', () => {
  const activeTask = ref<RescueTask | null>(null)
  const tasks = ref<RescueTask[]>([])
  const missionAccepted = ref(false)
  const missionPhase = ref<MissionPhase>('idle')
  const runningDistance = ref(240)
  const runningTimeRemaining = ref(100)
  const loading = ref(false)
  const error = ref('')

  const hasMission = computed(() => activeTask.value !== null && !missionAccepted.value)

  function showConfirm() {
    missionPhase.value = 'confirming'
  }

  function hideConfirm() {
    if (missionPhase.value === 'confirming') {
      missionPhase.value = 'idle'
    }
  }

  /** 确认接受 → 进入跑动导航 */
  function acceptMission() {
    missionAccepted.value = true
    missionPhase.value = 'running'
    const baseDist = activeTask.value?.distance ?? 240
    runningDistance.value = baseDist
    runningTimeRemaining.value = Math.round(baseDist / 2.4)
  }

  function updateRunning(distance: number, time: number) {
    runningDistance.value = distance
    runningTimeRemaining.value = time
  }

  function arrive() {
    missionPhase.value = 'arrived'
  }

  function finishMission() {
    missionAccepted.value = false
    missionPhase.value = 'idle'
    activeTask.value = null
    runningDistance.value = 240
    runningTimeRemaining.value = 100
  }

  /** 拉取真实任务。失败时显式记 `error` 并抛出（不静默兜底）。 */
  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const [a, l] = await Promise.all([fetchActiveTask(), fetchTaskList()])
      activeTask.value = a
      tasks.value = l
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载任务失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  void refresh().catch(() => { /* 错误已记录于 error */ })

  return {
    activeTask, tasks, missionAccepted, missionPhase,
    runningDistance, runningTimeRemaining, loading, error,
    hasMission, showConfirm, hideConfirm,
    acceptMission, updateRunning, arrive, finishMission, refresh,
  }
})
