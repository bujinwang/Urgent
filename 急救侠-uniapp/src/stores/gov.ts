/**
 * 政府数据监管看板 — 状态层（P2-8）
 *
 * 独立于业务用户态：令牌存 `gov_token`（与 `jwt_token` 分离）。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { govLogin, fetchGovMe, fetchGovDashboard, getGovToken } from '@/api/gov'
import type { GovViewer, GovDashboard } from '@/api/gov'

export const useGovStore = defineStore('gov', () => {
  const viewer = ref<GovViewer | null>(null)
  const dashboard = ref<GovDashboard | null>(null)
  const windowDays = ref(30)
  const district = ref('')
  const loading = ref(false)
  const error = ref('')

  const isLoggedIn = computed(() => !!getGovToken())
  /** 区域选择器选项：全域可见时含「全部区域」占位 */
  const districtOptions = computed<string[]>(() => {
    if (!viewer.value) return []
    return viewer.value.scopeAll ? ['', ...dashboard.value?.districts.map((d) => d.district) || []] : ['', ...viewer.value.districts]
  })

  /** 登录并落盘 gov_token。 */
  async function login(username: string, password: string): Promise<void> {
    const res = await govLogin(username, password)
    uni.setStorageSync('gov_token', res.token)
    viewer.value = res.viewer
  }

  /** 拉取当前身份（失败不抛，置空表示未授权）。 */
  async function loadMe(): Promise<void> {
    try {
      viewer.value = await fetchGovMe()
    } catch {
      viewer.value = null
    }
  }

  /** 拉取看板聚合；失败显式记 error 并抛出。 */
  async function loadDashboard(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      dashboard.value = await fetchGovDashboard({
        window: windowDays.value,
        district: district.value || undefined,
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载看板失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  function setWindow(days: number) {
    windowDays.value = days
    void loadDashboard().catch(() => { /* 错误已记录于 error */ })
  }

  function setDistrict(d: string) {
    district.value = d
    void loadDashboard().catch(() => { /* 错误已记录于 error */ })
  }

  function logout() {
    uni.removeStorageSync('gov_token')
    viewer.value = null
    dashboard.value = null
  }

  return {
    viewer, dashboard, windowDays, district, loading, error,
    isLoggedIn, districtOptions,
    login, loadMe, loadDashboard, setWindow, setDistrict, logout,
  }
})
