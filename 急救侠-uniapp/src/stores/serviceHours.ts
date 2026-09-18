/**
 * 志愿服务时长 / 证明 — 状态层（F4 T03）。
 *
 * 范式照 `stores/gov.ts`：**显式记 `error`，不静默兜底** —— 每个 load/写操作失败时
 * 先写 `error` 再 `throw`（调用方决定是否 toast），绝不"吞掉错误返回空数据"。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  getMyHours,
  createCertificate as createCertificateApi,
  listMyCertificates,
  verifyCertificate as verifyCertificateApi,
  revokeCertificate as revokeCertificateApi,
} from '@/api/serviceHours'
import type {
  ServiceHoursBreakdownItem,
  ServiceHoursItem,
  ServiceCertificateListItem,
  ServiceCertificateView,
  ServiceCertificateVerifyView,
} from '@/api/serviceHours'

export interface LoadHoursOptions {
  page?: number
  pageSize?: number
  activityType?: string
}

export const useServiceHoursStore = defineStore('serviceHours', () => {
  // ---- 我的时长 ----
  const totalMinutes = ref(0)
  const breakdown = ref<ServiceHoursBreakdownItem[]>([])
  const items = ref<ServiceHoursItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)

  // ---- 我的证明 ----
  const certificates = ref<ServiceCertificateListItem[]>([])

  const loading = ref(false)
  const error = ref('')

  /** 拉取「我的时长」；失败显式记 `error` 并抛出（不静默兜底）。 */
  async function loadHours(opts: LoadHoursOptions = {}): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const v = await getMyHours({
        page: opts.page ?? page.value,
        pageSize: opts.pageSize ?? pageSize.value,
        activityType: opts.activityType,
      })
      totalMinutes.value = v.totalMinutes
      breakdown.value = v.breakdown
      items.value = v.items
      total.value = v.total
      page.value = v.page
      pageSize.value = v.pageSize
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载服务时长失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 翻页并重新加载（错误已记录于 `error`，此处不重复抛出）。 */
  function setPage(p: number): void {
    page.value = p
    void loadHours({ page: p }).catch(() => { /* 错误已记录于 error */ })
  }

  /** 拉取证明列表；失败显式记 `error` 并抛出。 */
  async function loadCertificates(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      certificates.value = await listMyCertificates()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载证明失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 选区间签发证明；成功后刷新列表。失败显式记 `error` 并抛出。 */
  async function createCertificate(periodFromMs: number, periodToMs: number): Promise<ServiceCertificateView> {
    error.value = ''
    try {
      const cert = await createCertificateApi(periodFromMs, periodToMs)
      await loadCertificates()
      return cert
    } catch (e) {
      error.value = e instanceof Error ? e.message : '生成证明失败'
      throw e
    }
  }

  /** 撤销本人证明；成功后刷新列表。失败显式记 `error` 并抛出。 */
  async function revokeCertificate(certNo: string, reason?: string): Promise<void> {
    error.value = ''
    try {
      await revokeCertificateApi(certNo, reason)
      await loadCertificates()
    } catch (e) {
      error.value = e instanceof Error ? e.message : '撤销证明失败'
      throw e
    }
  }

  /** 编号验真（公开）；失败显式记 `error` 并抛出。 */
  async function verify(certNo: string): Promise<ServiceCertificateVerifyView> {
    error.value = ''
    try {
      return await verifyCertificateApi(certNo)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '验真失败'
      throw e
    }
  }

  return {
    totalMinutes, breakdown, items, total, page, pageSize,
    certificates, loading, error,
    loadHours, setPage, loadCertificates, createCertificate, revokeCertificate, verify,
  }
})
