/**
 * 组织管理 API
 */

import { request, requestFull, type FullResponse } from './index'

export interface Organization {
  id: string
  name: string
  type: 'school' | 'company'
  adminUserId: string
  createdAt: string
}

export interface OrgMember {
  id: string
  orgId: string
  userId: string
  userName: string
  userAvatar: string
  userTier: 'bronze' | 'silver' | 'gold' | 'diamond'
  role: 'admin' | 'manager' | 'member'
  joinedAt: string
  rescueCount: number
  activeCertificates: number
  expiringCertificates: number
}

export interface Certificate {
  id: string
  userId: string
  userName?: string
  type: string
  issuer: string
  issueDate: string
  expiryDate: string
  status: 'active' | 'expiring' | 'expired'
  fileUrl?: string
}

export interface OrgDashboard {
  org: Organization
  totalMembers: number
  activeCertificates: number
  expiringCertificates: number
  expiredCertificates: number
}

/** 获取机构 Dashboard */
export async function fetchDashboard(orgId: string): Promise<OrgDashboard> {
  return request({ url: `/org/${orgId}` })
}

/** 获取成员列表 */
export async function fetchMembers(orgId: string): Promise<OrgMember[]> {
  return request({ url: `/org/${orgId}/members` })
}

/** 获取证书列表 */
export async function fetchCertificates(orgId: string): Promise<Certificate[]> {
  return request({ url: `/org/${orgId}/certificates` })
}

/** 获取即将到期证书 */
export async function fetchExpiringCertificates(orgId: string): Promise<Certificate[]> {
  return request({ url: `/org/${orgId}/certificates/expiring` })
}

/** 添加证书 */
export async function addCertificate(orgId: string, data: {
  userId: string
  type: string
  issuer?: string
  issueDate: string
  expiryDate: string
  fileUrl?: string
}): Promise<{ id: string }> {
  return request({ url: `/org/${orgId}/certificates`, method: 'POST', data })
}

/**
 * 添加证书（**完整响应**版）—— 与 `addCertificate` 同一端点，但透出 `code` / `statusCode`。
 *
 * 为什么另开一个函数：`POST /org/:id/certificates` 在 P0-1 后要求调用者是本机构
 * admin/manager，否则 **403**；而 `request()` 对 403 **不抛错**（只 warn）⇒ 调用方
 * 无法判定成败，会弹出“已发证”这种假成功提示。需要判定的调用点改用本函数。
 */
export async function addCertificateFull(orgId: string, data: {
  userId: string
  type: string
  issuer?: string
  issueDate: string
  expiryDate: string
  fileUrl?: string
}): Promise<FullResponse<{ id: string }>> {
  return requestFull({ url: `/org/${orgId}/certificates`, method: 'POST', data })
}

/** 删除证书 */
export async function removeCertificate(orgId: string, certId: string): Promise<void> {
  return request({ url: `/org/${orgId}/certificates/${certId}`, method: 'DELETE' })
}

export interface UserOrgRole {
  orgId: string
  orgName: string
  orgType: 'school' | 'company'
  role: 'admin' | 'manager'
}

/** 查询用户的机构管理角色 */
export async function fetchUserOrgRoles(userId: string): Promise<UserOrgRole[]> {
  return request({ url: `/user/org-roles?userId=${userId}` })
}
