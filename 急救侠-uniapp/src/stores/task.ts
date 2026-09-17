import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchActiveTask, fetchTaskList, acceptTaskApi, completeTaskApi } from '@/api/task'

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

  /**
   * 归因留痕：把「接受任务」上报服务端（F4 §1.1 调用点接线）。
   *
   * ⚠️ 失败**不抛出** —— 急救优先，归因失败不能阻断本地导航；仅显式记 `error`（不静默兜底）。
   * 这条 `acceptTaskApi()` 调用是 F4「可归因率 > 0」的**唯一真实来源**：删掉它，
   * 后端 `/task/accept` 永远不会被调用、参与行永远不会产生（T19 调用点守卫）。
   */
  async function attributeAccept(taskId: string): Promise<void> {
    try {
      await acceptTaskApi(taskId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '任务归因失败'
    }
  }

  /**
   * 任务闭合：上报服务端触发时长入账（F4 §5.1 时序）。
   *
   * 幂等：服务端靠 `ended_at_ms IS NULL` 守卫去重，**可安全重复调用**（arrive / finishMission 都会触发）。
   * 失败同样不抛出（仅记 `error`），避免阻断导航。
   */
  async function closeMission(taskId: string): Promise<void> {
    try {
      await completeTaskApi(taskId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '任务闭合失败'
    }
  }

  /** 确认接受 → 进入跑动导航 */
  function acceptMission() {
    missionAccepted.value = true
    missionPhase.value = 'running'
    const baseDist = activeTask.value?.distance ?? 240
    runningDistance.value = baseDist
    runningTimeRemaining.value = Math.round(baseDist / 2.4)
    const taskId = activeTask.value?.id
    if (taskId) void attributeAccept(taskId)
  }

  function updateRunning(distance: number, time: number) {
    runningDistance.value = distance
    runningTimeRemaining.value = time
  }

  function arrive() {
    missionPhase.value = 'arrived'
    const taskId = activeTask.value?.id
    if (taskId) void closeMission(taskId)
  }

  function finishMission() {
    const taskId = activeTask.value?.id
    missionAccepted.value = false
    missionPhase.value = 'idle'
    activeTask.value = null
    runningDistance.value = 240
    runningTimeRemaining.value = 100
    if (taskId) void closeMission(taskId)
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
