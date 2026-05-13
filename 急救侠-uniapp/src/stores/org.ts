import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchDashboard, fetchMembers, fetchCertificates, fetchExpiringCertificates,
  addCertificate, removeCertificate,
  type OrgDashboard, type OrgMember, type Certificate,
} from '@/api/org'

export const useOrgStore = defineStore('org', () => {
  const orgId = ref('')
  const dashboard = ref<OrgDashboard | null>(null)
  const members = ref<OrgMember[]>([])
  const certificates = ref<Certificate[]>([])
  const expiringCerts = ref<Certificate[]>([])
  const loading = ref(false)

  const certificateTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      CPR: 'CPR 心肺复苏',
      AED: 'AED 操作',
      'First Aid': '急救基础',
      BLS: '基础生命支持',
    }
    return map[type] || type
  }

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      active: '有效',
      expiring: '即将到期',
      expired: '已过期',
    }
    return map[status] || status
  }

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      active: '#34D277',
      expiring: '#F59E0B',
      expired: '#EF4444',
    }
    return map[status] || '#6B7280'
  }

  const daysUntilExpiry = (dateStr: string): number => {
    const now = new Date()
    const expiry = new Date(dateStr)
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }

  async function loadDashboard(id: string) {
    orgId.value = id
    loading.value = true
    try {
      dashboard.value = await fetchDashboard(id)
    } catch (_) { dashboard.value = null }
    finally { loading.value = false }
  }

  async function loadMembers() {
    if (!orgId.value) return
    try {
      members.value = await fetchMembers(orgId.value)
    } catch (_) { members.value = [] }
  }

  async function loadCertificates() {
    if (!orgId.value) return
    try {
      certificates.value = await fetchCertificates(orgId.value)
    } catch (_) { certificates.value = [] }
  }

  async function loadExpiringCerts() {
    if (!orgId.value) return
    try {
      expiringCerts.value = await fetchExpiringCertificates(orgId.value)
    } catch (_) { expiringCerts.value = [] }
  }

  async function addCert(data: {
    userId: string; type: string; issuer?: string
    issueDate: string; expiryDate: string; fileUrl?: string
  }) {
    if (!orgId.value) return
    await addCertificate(orgId.value, data)
    await loadCertificates()
    await loadDashboard(orgId.value)
  }

  async function removeCert(certId: string) {
    if (!orgId.value) return
    await removeCertificate(orgId.value, certId)
    await loadCertificates()
    await loadDashboard(orgId.value)
  }

  return {
    orgId,
    dashboard,
    members,
    certificates,
    expiringCerts,
    loading,
    certificateTypeLabel,
    statusLabel,
    statusColor,
    daysUntilExpiry,
    loadDashboard,
    loadMembers,
    loadCertificates,
    loadExpiringCerts,
    addCert,
    removeCert,
  }
})
