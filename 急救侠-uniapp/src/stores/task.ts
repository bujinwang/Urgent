import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getActiveTask, getTaskList } from '@/api/task'

export interface RescueTask {
  id: string
  type: 'cpr' | 'aed' | 'assist'
  address: string
  distance: number
  lat: number
  lng: number
  volunteersNeeded: number
  volunteersResponded: number
  status: 'pending' | 'active' | 'completed'
  createdAt: string
}

export const useTaskStore = defineStore('task', () => {
  const activeTask = ref<RescueTask | null>(getActiveTask())
  const tasks = ref<RescueTask[]>(getTaskList())
  const missionAccepted = ref(false)

  const hasMission = computed(() => activeTask.value !== null && !missionAccepted.value)

  function acceptMission() {
    missionAccepted.value = true
  }

  function finishMission() {
    missionAccepted.value = false
    activeTask.value = null
  }

  function refresh() {
    activeTask.value = getActiveTask()
    tasks.value = getTaskList()
  }

  return { activeTask, tasks, missionAccepted, hasMission, acceptMission, finishMission, refresh }
})
