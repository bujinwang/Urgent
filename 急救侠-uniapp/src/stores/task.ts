import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getActiveTask, getTaskList } from '@/api/task'

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
}

export type MissionPhase = 'idle' | 'confirming' | 'running' | 'arrived'

export const useTaskStore = defineStore('task', () => {
  const activeTask = ref<RescueTask | null>(getActiveTask())
  const tasks = ref<RescueTask[]>(getTaskList())
  const missionAccepted = ref(false)
  const missionPhase = ref<MissionPhase>('idle')
  const runningDistance = ref(240)
  const runningTimeRemaining = ref(100)

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
    // 使用实际任务距离，而非硬编码
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

  function refresh() {
    activeTask.value = getActiveTask()
    tasks.value = getTaskList()
  }

  return {
    activeTask, tasks, missionAccepted, missionPhase,
    runningDistance, runningTimeRemaining,
    hasMission, showConfirm, hideConfirm,
    acceptMission, updateRunning, arrive, finishMission, refresh,
  }
})
