/**
 * AED 生命周期 API
 */

import { request } from './index'

export interface AedManager {
  id: string; aedId: string; userId: string; userName: string
  role: 'primary' | 'backup'; assignedAt: string
}

export interface AedMaintenance {
  id: string; aedId: string; type: string; date: string
  performedBy: string; notes: string; nextDue: string; createdAt: string
}

export interface AedPickup {
  id: string; aedId: string; userId: string; userName: string
  pickupTime: string; returnTime?: string | null; missionId?: string
  notes?: string; isReturned: boolean
}

export interface AedAuditEvent {
  id: string; eventType: string; description: string
  userId: string; userName: string; createdAt: string
}

export interface AedCert {
  id: string; type: string; name: string; issuer: string
  issueDate: string; expiryDate: string; status: string
}

export interface AedLifecycle {
  device: any; managers: AedManager[]; maintenance: AedMaintenance[]
  recentPickups: AedPickup[]; activePickups: number
  auditLog: AedAuditEvent[]; certifications: AedCert[]
}

export async function fetchMyAeds(userId: string): Promise<any[]> {
  return request({ url: `/aed/mine?userId=${userId}` })
}

export async function fetchAedLifecycle(aedId: string): Promise<AedLifecycle> {
  return request({ url: `/aed/${aedId}/lifecycle` })
}

export async function addMaintenance(aedId: string, data: {
  type: string; date: string; performedBy?: string; notes?: string; nextDue?: string
}): Promise<{ id: string }> {
  return request({ url: `/aed/${aedId}/maintenance`, method: 'POST', data })
}

export async function checkinAed(aedId: string, data: {
  userId: string; userName?: string; photo?: string; status?: string; comment?: string; findingTip?: string
}): Promise<{ id: string }> {
  return request({ url: `/aed/${aedId}/checkins`, method: 'POST', data })
}
