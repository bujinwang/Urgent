import { z } from 'zod'

// ---- User ----
export const UserTier = z.enum(['bronze', 'silver', 'gold', 'diamond'])
export type UserTier = z.infer<typeof UserTier>

export const UserProfile = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  tier: UserTier,
  points: z.number(),
  city: z.string(),
  volunteerId: z.string(),
  certifications: z.array(z.string()),
  rescueCount: z.number(),
})
export type UserProfile = z.infer<typeof UserProfile>

export const Stats = z.object({
  certifiedRescuers: z.number(),
  networkedAeds: z.number(),
  monthlyRescues: z.number(),
  onlineVolunteers: z.number(),
  aedsWithin1km: z.number(),
})
export type Stats = z.infer<typeof Stats>

// ---- Task ----
export const TaskType = z.enum(['cpr', 'aed', 'assist'])
export type TaskType = z.infer<typeof TaskType>

export const RescueTask = z.object({
  id: z.string(),
  type: TaskType,
  address: z.string(),
  distance: z.number(),
  lat: z.number(),
  lng: z.number(),
  volunteersNeeded: z.number(),
  volunteersResponded: z.number(),
  status: z.enum(['pending', 'active', 'completed']),
  createdAt: z.string(),
})
export type RescueTask = z.infer<typeof RescueTask>

// ---- AED ----
export const AedStatus = z.enum(['available', 'in_use', 'maintenance'])
export type AedStatus = z.infer<typeof AedStatus>

export const AedCustodian = z.object({
  name: z.string(),
  phone: z.string(),
  role: z.string(),
})
export type AedCustodian = z.infer<typeof AedCustodian>

export const AedCheckin = z.object({
  id: z.string(),
  aedId: z.string(),
  userId: z.string(),
  userName: z.string(),
  photo: z.string(),
  date: z.string(),
  status: z.enum(['ok', 'issue']),
  comment: z.string(),
  findingTip: z.string().optional(),
})
export type AedCheckin = z.infer<typeof AedCheckin>

export const AedDevice = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  distance: z.number(),
  status: AedStatus,
  lastCheck: z.string(),
  batteryLevel: z.number(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  batteryExpiry: z.string().optional(),
  electrodeExpiry: z.string().optional(),
  lastMaintenance: z.string().optional(),
  indoor: z.boolean().optional(),
  floor: z.string().optional(),
  openHours: z.string().optional(),
  findingInstructions: z.string().optional(),
  custodian: AedCustodian.optional(),
  checkIns: z.array(AedCheckin).optional(),
  reportedBy: z.string().optional(),
  reportedAt: z.string().optional(),
  isMobile: z.boolean().optional(),
  linkedUserId: z.string().optional(),
})
export type AedDevice = z.infer<typeof AedDevice>

// ---- AED Lifecycle ----

export const AedManagerRole = z.enum(['primary', 'backup'])
export type AedManagerRole = z.infer<typeof AedManagerRole>

export const AedManager = z.object({
  id: z.string(),
  aedId: z.string(),
  userId: z.string(),
  userName: z.string(),
  role: AedManagerRole,
  assignedAt: z.string(),
})
export type AedManager = z.infer<typeof AedManager>

export const AedMaintenanceType = z.enum([
  'battery_replacement', 'electrode_replacement', 'inspection', 'repair', 'software_update', 'other'
])
export type AedMaintenanceType = z.infer<typeof AedMaintenanceType>

export const AedMaintenance = z.object({
  id: z.string(),
  aedId: z.string(),
  type: AedMaintenanceType,
  date: z.string(),
  performedBy: z.string(),
  notes: z.string(),
  nextDue: z.string(),
  createdAt: z.string(),
})
export type AedMaintenance = z.infer<typeof AedMaintenance>

// ---- AED Audit & Certification ----

export const AedAuditEvent = z.object({
  id: z.string(),
  aedId: z.string(),
  eventType: z.string(),
  description: z.string(),
  userId: z.string(),
  userName: z.string(),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
  createdAt: z.string(),
})
export type AedAuditEvent = z.infer<typeof AedAuditEvent>

export const AedCertificationType = z.enum(['manufacturer', 'platform'])
export type AedCertificationType = z.infer<typeof AedCertificationType>

export const AedCertification = z.object({
  id: z.string(),
  aedId: z.string(),
  type: AedCertificationType,
  name: z.string(),
  issuer: z.string(),
  issueDate: z.string(),
  expiryDate: z.string(),
  status: z.enum(['active', 'expiring', 'expired']),
  fileUrl: z.string().optional(),
  createdAt: z.string(),
})
export type AedCertification = z.infer<typeof AedCertification>

export const AedPickup = z.object({
  id: z.string(),
  aedId: z.string(),
  userId: z.string(),
  userName: z.string(),
  pickupTime: z.string(),
  returnTime: z.string().nullable().optional(),
  missionId: z.string().optional(),
  notes: z.string().optional(),
  isReturned: z.boolean(),
})
export type AedPickup = z.infer<typeof AedPickup>

export const AedDeviceInput = z.object({
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  status: AedStatus.optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  batteryExpiry: z.string().optional(),
  electrodeExpiry: z.string().optional(),
  indoor: z.boolean().optional(),
  floor: z.string().optional(),
  openHours: z.string().optional(),
  findingInstructions: z.string().optional(),
  custodianName: z.string().optional(),
  custodianPhone: z.string().optional(),
  custodianRole: z.string().optional(),
  reportedBy: z.string().optional(),
})

// ---- News ----
export const NewsItem = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['video', 'photo', 'live', 'story', 'article', 'map']),
  category: z.enum(['recommend', 'video', 'nearby', 'volunteer']),
  time: z.string(),
  location: z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
  tags: z.array(z.string()),
  isLive: z.boolean(),
  isUrgent: z.boolean(),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
})
export type NewsItem = z.infer<typeof NewsItem>

// ---- Learn ----
export const CourseItem = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  duration: z.string(),
  completed: z.boolean(),
  progress: z.number(),
  icon: z.string().optional(),
})
export type CourseItem = z.infer<typeof CourseItem>

// ---- Volunteer ----
export const VolunteerRank = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  tier: UserTier,
  points: z.number(),
  rescueCount: z.number(),
  city: z.string(),
  rank: z.number(),
})
export type VolunteerRank = z.infer<typeof VolunteerRank>

// ---- Records ----
export const RescueRecord = z.object({
  id: z.string(),
  type: z.string(),
  date: z.string(),
  location: z.string(),
  role: z.string(),
  squad: z.array(z.string()),
  result: z.string(),
})
export type RescueRecord = z.infer<typeof RescueRecord>

// ---- Case ----
export const RescueCase = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  date: z.string(),
  location: z.string(),
  result: z.string(),
  volunteers: z.array(z.string()),
  body: z.string().optional(),
})
export type RescueCase = z.infer<typeof RescueCase>

// ---- Atlas ----
export const AtlasCard = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  description: z.string(),
  steps: z.array(z.string()),
  icon: z.string().optional(),
  imageUrl: z.string().optional(),
})
export type AtlasCard = z.infer<typeof AtlasCard>

// ---- Coach ----
export const CoachSummary = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  tier: UserTier,
  city: z.string(),
  specialties: z.array(z.string()),
  rescueCount: z.number(),
  traineeCount: z.number(),
  available: z.boolean(),
})
export type CoachSummary = z.infer<typeof CoachSummary>

export const CoachDetail = CoachSummary.extend({
  certifications: z.array(z.string()),
  bio: z.string(),
  points: z.number(),
})
export type CoachDetail = z.infer<typeof CoachDetail>

// ---- Organization ----
export const OrgType = z.enum(['school', 'company'])
export type OrgType = z.infer<typeof OrgType>

export const Organization = z.object({
  id: z.string(),
  name: z.string(),
  type: OrgType,
  adminUserId: z.string(),
  createdAt: z.string(),
})
export type Organization = z.infer<typeof Organization>

export const OrgMemberRole = z.enum(['admin', 'manager', 'member'])
export type OrgMemberRole = z.infer<typeof OrgMemberRole>

export const OrgMember = z.object({
  id: z.string(),
  orgId: z.string(),
  userId: z.string(),
  userName: z.string(),
  userAvatar: z.string(),
  userTier: UserTier,
  role: OrgMemberRole,
  joinedAt: z.string(),
  rescueCount: z.number(),
  activeCertificates: z.number(),
  expiringCertificates: z.number(),
})
export type OrgMember = z.infer<typeof OrgMember>

export const CertificateStatus = z.enum(['active', 'expiring', 'expired'])
export type CertificateStatus = z.infer<typeof CertificateStatus>

export const Certificate = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().optional(),
  type: z.string(),
  issuer: z.string(),
  issueDate: z.string(),
  expiryDate: z.string(),
  status: CertificateStatus,
  fileUrl: z.string().optional(),
})
export type Certificate = z.infer<typeof Certificate>

export const CertificateInput = z.object({
  userId: z.string(),
  type: z.string(),
  issuer: z.string().optional(),
  issueDate: z.string(),
  expiryDate: z.string(),
  fileUrl: z.string().optional(),
})
export type CertificateInput = z.infer<typeof CertificateInput>

export const OrgMemberInput = z.object({
  userId: z.string(),
  role: OrgMemberRole.optional(),
})
export type OrgMemberInput = z.infer<typeof OrgMemberInput>

export const OrgDashboard = z.object({
  org: Organization,
  totalMembers: z.number(),
  activeCertificates: z.number(),
  expiringCertificates: z.number(),
  expiredCertificates: z.number(),
})
export type OrgDashboard = z.infer<typeof OrgDashboard>

// ---- Input Validation Schemas ----

/** POST /api/auth/register */
export const AuthRegisterInput = z.object({
  phone: z.string().min(1, '手机号不能为空'),
  password: z.string().min(2, '密码长度至少 2 位'),
  name: z.string().optional(),
  interests: z.string().optional(),
  affiliation: z.string().optional(),
  isLeader: z.boolean().optional(),
})
export type AuthRegisterInput = z.infer<typeof AuthRegisterInput>

/** POST /api/auth/login */
export const AuthLoginInput = z.object({
  phone: z.string().min(1, '手机号不能为空'),
  password: z.string().min(2, '密码长度至少 2 位'),
})
export type AuthLoginInput = z.infer<typeof AuthLoginInput>

/** POST /api/auth/change-password */
export const AuthChangePasswordInput = z.object({
  phone: z.string().min(1, '手机号不能为空'),
  oldPassword: z.string().min(1, '旧密码不能为空'),
  newPassword: z.string().min(2, '新密码长度至少 2 位'),
})
export type AuthChangePasswordInput = z.infer<typeof AuthChangePasswordInput>

/** POST /api/auth/reset-password */
export const AuthResetPasswordInput = z.object({
  phone: z.string().min(1, '手机号不能为空'),
  newPassword: z.string().min(2, '新密码长度至少 2 位'),
})
export type AuthResetPasswordInput = z.infer<typeof AuthResetPasswordInput>

/** POST /api/push/register */
export const PushRegisterInput = z.object({
  templateId: z.string().min(1, 'templateId 不能为空'),
  accepted: z.boolean().optional(),
})
export type PushRegisterInput = z.infer<typeof PushRegisterInput>

// ---- AED 责任人联动（custodian linkage）----

export const CustodianAlertStatus = z.enum([
  'pending', 'sent', 'acknowledged', 'rejected', 'expired', 'unreachable',
])
export type CustodianAlertStatus = z.infer<typeof CustodianAlertStatus>

export const UnlockAction = z.enum(['none', 'authorize', 'deny'])
export type UnlockAction = z.infer<typeof UnlockAction>

export const UnlockCommandStatus = z.enum(['not_issued', 'issued', 'acked'])
export type UnlockCommandStatus = z.infer<typeof UnlockCommandStatus>

/**
 * 对外返回的求助记录。
 * 语义为「责任人已确认授权」，**不含任何物理开锁含义**；时间戳为 UTC epoch ms，
 * 展示层自行转换为本地时区。为 PIPL 最小必要原则，此处**不返回**责任人手机号。
 */
export const AedCustodianAlert = z.object({
  id: z.string(),
  aedId: z.string(),
  pickupId: z.string(),
  status: CustodianAlertStatus,
  channel: z.string(),
  requesterUserId: z.string(),
  requesterUserName: z.string(),
  custodianUserId: z.string(),
  custodianName: z.string(),
  custodianRole: z.string(),
  notifyTimeMs: z.number(),
  firstSentTimeMs: z.number().nullable(),
  respondedTimeMs: z.number().nullable(),
  slaDeadlineMs: z.number(),
  responseLatencyMs: z.number().nullable(),
  slaMet: z.boolean().nullable(),
  unlockAction: UnlockAction,
  unlockCommandStatus: UnlockCommandStatus,
  deliveryState: z.string(),
  consentGranted: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
})
export type AedCustodianAlert = z.infer<typeof AedCustodianAlert>

/** POST /api/aed/:id/notify-custodian */
export const CustodianNotifyInput = z.object({
  pickupId: z.string().optional(),
  missionId: z.string().optional(),
  notes: z.string().optional(),
  consentGranted: z.boolean(),           // PIPL：必须显式 true
  consentVersion: z.string().optional(), // 默认 'v1'
})
export type CustodianNotifyInput = z.infer<typeof CustodianNotifyInput>

/** POST /api/aed/:id/unlock —— 责任人「确认授权 / 拒绝」（confirm=authorize） */
export const CustodianActionInput = z.object({
  alertId: z.string().min(1, 'alertId 不能为空'),
  action: z.enum(['authorize', 'deny']),
  notes: z.string().optional(),
})
export type CustodianActionInput = z.infer<typeof CustodianActionInput>

/** POST /api/aed/:id/custodian-alerts/:alertId/revoke-consent */
export const ConsentRevokeInput = z.object({
  reason: z.string().optional(),
})
export type ConsentRevokeInput = z.infer<typeof ConsentRevokeInput>

/**
 * 业务错误码（与 HTTP 200 一并返回，前端据 code 分支）。
 * 鉴权失败由 authMiddleware 返回 HTTP 401；NOT_CUSTODIAN 同时映射 HTTP 403。
 */
export const AlertCode = {
  NO_CUSTODIAN: 4001,       // 设备无责任人（不阻断急救）
  ALERT_NOT_FOUND: 4002,
  NOT_CUSTODIAN: 4003,      // 调用者非该设备责任人
  ALREADY_RESPONDED: 4004,  // 已响应，且与本次动作不同
  ALERT_EXPIRED: 4005,
  CONSENT_REQUIRED: 4006,   // 未同意 PIPL
  DEVICE_NOT_FOUND: 4007,
  PICKUP_NOT_FOUND: 4008,
} as const
export type AlertCode = (typeof AlertCode)[keyof typeof AlertCode]

/** SLA 固定 120s（本期）。 */
export const CUSTODIAN_SLA_MS = 120000

// ---- API Response ----
export const ApiResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    code: z.number(),
    data: dataSchema.optional(),
    message: z.string(),
  })

export type ApiResponse<T> = {
  code: number
  data?: T
  message: string
}

export function success<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: 0, data, message }
}

export function error(message: string, code = -1): ApiResponse<never> {
  return { code, message }
}
