import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchActiveTask, fetchTaskList, acceptTaskApi, arriveTaskApi, completeTaskApi, abandonTaskApi } from '@/api/task'

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
   * 归因留痕：把「接受任务」（**报名**）上报服务端（F4 §1.1 调用点接线）。
   *
   * ⚠️ 失败**不抛出** —— 急救优先，归因失败不能阻断本地导航；仅显式记 `error`（不静默兜底）。
   * 这条 `acceptTaskApi()` 调用是 F4「可归因率 > 0」的**唯一真实来源**：删掉它，
   * 后端 `/task/accept` 永远不会被调用、参与行永远不会产生（T19 调用点守卫）。
   */
  async function reportAccept(taskId: string): Promise<void> {
    try {
      await acceptTaskApi(taskId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '任务归因失败'
    }
  }

  /** 上报「**到达现场**」（★ v1.2 = 服务时长起点）；幂等，失败不抛出。 */
  async function reportArrive(taskId: string): Promise<void> {
    try {
      await arriveTaskApi(taskId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '到达上报失败'
    }
  }

  /** 上报「**结束服务**」（★ v1.2 = 服务时长终点，按人闭合）；幂等，失败不抛出。 */
  async function reportEnd(taskId: string): Promise<void> {
    try {
      await completeTaskApi(taskId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '结束服务失败'
    }
  }

  /** 上报「**放弃 / 中途退出**」（★ v1.2：作废留痕、不入账）；失败不抛出。 */
  async function reportAbandon(taskId: string): Promise<void> {
    try {
      await abandonTaskApi(taskId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '放弃任务失败'
    }
  }

  /** 确认接受（**报名**）→ 进入跑动导航。 */
  function acceptMission() {
    missionAccepted.value = true
    missionPhase.value = 'running'
    const baseDist = activeTask.value?.distance ?? 240
    runningDistance.value = baseDist
    runningTimeRemaining.value = Math.round(baseDist / 2.4)
    const taskId = activeTask.value?.id
    if (taskId) void reportAccept(taskId)
  }

  function updateRunning(distance: number, time: number) {
    runningDistance.value = distance
    runningTimeRemaining.value = time
  }

  /**
   * 到达现场（跑动结束）→ 记**服务起点**。
   *
   * ★ v1.2 更正：此前错调 `/complete`（把「到达」当「结束」，导致**赶路被计时、救人反而不计**）。
   * 现在改为 `/arrive`，**只记起点**，不闭合、不入账。
   */
  function arrive() {
    missionPhase.value = 'arrived'
    const taskId = activeTask.value?.id
    if (taskId) void reportArrive(taskId)
  }

  /**
   * 「结束服务」—— 由 **arrived 页**的退出动作调用（★ v1.2 新增）。
   *
   * 记**服务终点**并按人闭合入账（= `round((ended − arrived)/60000)`）。幂等，可安全重复调用。
   * ⚠️ 必须**先于** `finishMission()` 调用：后者会清空 `activeTask`，导致取不到 `taskId`。
   */
  function endService() {
    const taskId = activeTask.value?.id
    if (taskId) void reportEnd(taskId)
  }

  /**
   * 「放弃 / 中途退出」—— 由 **running 页**的退出动作调用（★ v1.2 新增）。
   *
   * 后端作废参与行并留痕，**不写台账**（放弃不计入时长）。
   */
  function abandonMission() {
    const taskId = activeTask.value?.id
    if (taskId) void reportAbandon(taskId)
  }

  /**
   * 纯**本地**状态重置（★ v1.2 降级）。
   *
   * ⚠️ 此前它隐式调用 `/complete`，把「结束 / 放弃 / 拒绝」三种不同退出**都当成了闭合** ——
   * 这正是 §11.1 缺陷的核心。现在它**只清本地状态、不发任何请求**；
   * 三种退出各自由调用方决定：`endService()`（结束）/ `abandonMission()`（放弃）/ 不发（拒绝）。
   */
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
    acceptMission, updateRunning, arrive, endService, abandonMission, finishMission, refresh,
  }
})
