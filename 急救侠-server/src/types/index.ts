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
  /** 所选榜单维度（points|rescue）下的位次（1-based） */
  position: z.number().optional(),
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
  /** 关联新闻 ID（可空；无可靠数据来源时为空，前端据此降级为无互链） */
  newsId: z.string().optional(),
})

// ---- 政府数据监管看板（P2-8）----

export const GovLoginInput = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
})
export type GovLoginInput = z.infer<typeof GovLoginInput>

export const GovViewerInput = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(6, '密码至少 6 位'),
  name: z.string().optional(),
  orgName: z.string().optional(),
  scopeAll: z.boolean().optional(),
  scopeDistricts: z.array(z.string()).optional(),
})
export type GovViewerInput = z.infer<typeof GovViewerInput>

export const GovViewerUpdateInput = z.object({
  name: z.string().optional(),
  orgName: z.string().optional(),
  scopeAll: z.boolean().optional(),
  scopeDistricts: z.array(z.string()).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6, '密码至少 6 位').optional(),
})
export type GovViewerUpdateInput = z.infer<typeof GovViewerUpdateInput>

/** 聚合元信息 */
export interface GovMeta {
  from: number
  to: number
  windowDays: number
  district: string | null
  generatedAt: number
  dataGaps: string[]
}
export interface GovTrendPoint {
  date: string
  p95Ms: number | null
  count: number
}
export interface GovChannelRow {
  channel: string
  count: number
  ratio: number
}
export interface GovResponseTime {
  hasData: boolean
  sampleSize: number
  p95Ms: number | null
  slaRate: number | null
  noResponseRate: number | null
  alertTotal: number
  trend: GovTrendPoint[]
  channelDistribution: GovChannelRow[]
}
export interface GovCoverage {
  per10k: number | null
  perKm2: number | null
  dataGap: boolean
}
export interface GovAed {
  total: number
  available: number
  availabilityRate: number | null
  pickups: number
  activePickups: number
  coverage: GovCoverage
}
export interface GovTypeCount {
  type: string
  count: number
}
export interface GovHourCount {
  hour: number
  count: number
}
export interface GovTasks {
  total: number
  completed: number
  completionRate: number | null
  typeDistribution: GovTypeCount[]
  hourlyDistribution: GovHourCount[]
}
export interface GovRescue {
  records: number
  cases: number
}
export interface GovPeople {
  certifiedVolunteers: number
  onlineVolunteers: number
  organizations: number
  orgMembers: number
}
export interface GovDistrictRow {
  district: string
  aedCount: number
  aedAvailableRate: number | null
  responseP95Ms: number | null
  slaRate: number | null
  alertTotal: number
  taskCount: number
  taskCompletionRate: number | null
  coveragePer10k: number | null
}
/** 政府看板聚合响应（**无任何 PII**） */
export interface GovDashboard {
  meta: GovMeta
  responseTime: GovResponseTime
  aed: GovAed
  tasks: GovTasks
  rescue: GovRescue
  people: GovPeople
  districts: GovDistrictRow[]
}
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
/**
 * POST /api/auth/register
 *
 * 注意：`isLeader` **不是**可注册字段（安全收敛 NEW-1）。
 * 此前它在 schema 中被接受并直接写入 `users.is_leader`，而 `is_leader` 同时是
 * **平台管理面**（`/api/admin/*`、`/api/gov/viewers*`、`/api/push/send`）的判定依据
 * —— 任何人都可在注册时自封队长，进而重置他人口令或进入管理面。
 * `validate()` 会用解析结果覆盖 `req.body`，未知键被剥离，故注册一律 `is_leader = 0`；
 * 队长身份只能由种子数据/管理操作授予。
 */
export const AuthRegisterInput = z.object({
  phone: z.string().min(1, '手机号不能为空'),
  password: z.string().min(2, '密码长度至少 2 位'),
  name: z.string().optional(),
  interests: z.string().optional(),
  affiliation: z.string().optional(),
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
  RATE_LIMITED: 4009,       // 反滥用：冷却中 / 小时频次超限（拒绝时零触达）
} as const
export type AlertCode = (typeof AlertCode)[keyof typeof AlertCode]

/** SLA 固定 120s（本期）。 */
export const CUSTODIAN_SLA_MS = 120000

// ---- F4 · 志愿服务时长台账 + 证明（volunteer-service-hours-design.md §4.3/§7）----

/**
 * `volunteer_service_logs.activity_type` 的**唯一事实源**（设计 §7.1）。
 *
 * P0 阶段唯一自动来源是 `rescue_task`（§2.4）；其余值由 P1-7 人工登记或 P1-10
 * 动员/演习链路补写。新增取值时**只需改这里**（连同 DB 注释）。
 */
export const ActivityType = z.enum(['rescue_task', 'drill', 'training', 'aed_checkin', 'manual'])
export type ActivityType = z.infer<typeof ActivityType>

/** 台账写入来源：`system`（系统闭合自动写）/ `manual`（人工登记）。 */
export const ServiceSourceType = z.enum(['system', 'manual'])
export type ServiceSourceType = z.infer<typeof ServiceSourceType>

/** 台账状态：`pending`（待人工确认，**不进证明**）/ `confirmed` / `voided`（软删留痕）。 */
export const ServiceLogStatus = z.enum(['pending', 'confirmed', 'voided'])
export type ServiceLogStatus = z.infer<typeof ServiceLogStatus>

/**
 * 任务参与状态（★ v1.2 扩为 4 值，§11.3）。
 * `responded`（已报名未到）/ `arrived`（已到达，计时中）/ `left`（已离开，已闭合）/ `voided`（放弃/作废）。
 */
export const TaskVolunteerStatus = z.enum(['responded', 'arrived', 'left', 'voided'])
export type TaskVolunteerStatus = z.infer<typeof TaskVolunteerStatus>

/** 证明记录状态：`active` / `revoked`（软删，仍可查到「存在且已撤销」）。 */
export const CertificateRecordStatus = z.enum(['active', 'revoked'])
export type CertificateRecordStatus = z.infer<typeof CertificateRecordStatus>

/** 「我的服务时长」按 `activity_type` 的分项（`Σ minutes === totalMinutes`）。 */
export interface ServiceHoursBreakdownItem {
  activityType: ActivityType
  minutes: number
  count: number
}

/** 「我的服务时长」明细项。 */
export interface ServiceHoursItem {
  id: string
  activityType: ActivityType
  sourceType: ServiceSourceType
  sourceRef: string
  startedAtMs: number
  endedAtMs: number
  durationMin: number
  isDrill: boolean
  orgId: string
}

/** `GET /api/volunteer/service-hours/me` 的 `data`。 */
export interface ServiceHoursView {
  totalMinutes: number
  breakdown: ServiceHoursBreakdownItem[]
  items: ServiceHoursItem[]
  page: number
  pageSize: number
  total: number
}

// ---- F4 · 服务证明（T02 / §4.3 端点 #2–#4）----

/** `POST /api/volunteer/service-certificates` 的 `data`（§4.3 #2）。 */
export interface ServiceCertificateView {
  certNo: string
  periodFromMs: number
  periodToMs: number
  totalMinutes: number
  breakdown: ServiceHoursBreakdownItem[]
  issuedAtMs: number
  status: CertificateRecordStatus
}

/** `GET /api/volunteer/service-certificates/me` 的列表项（§4.3 #3）。 */
export interface ServiceCertificateListItem {
  certNo: string
  periodFromMs: number
  periodToMs: number
  totalMinutes: number
  status: CertificateRecordStatus
  issuedAtMs: number
}

/**
 * `GET /api/volunteer/service-certificates/:certNo` 的 `data`（§4.3 #4）。
 *
 * ⚠️ **仅此 5 字段、零 PII**（T15）：**绝不**出现 `user_id` / `name` / `phone` /
 * `userId`。响应由 `verify()` 的 SQL **投影裁剪**出来（不 SELECT 身份列，而非 SELECT 后再删）。
 */
export interface ServiceCertificateVerifyView {
  certNo: string
  periodFromMs: number
  periodToMs: number
  totalMinutes: number
  status: CertificateRecordStatus
}

/** `POST /api/volunteer/service-certificates/:certNo/revoke` 的 `data`（★ v1.3 本人自撤）。 */
export interface RevokeCertificateResult {
  certNo: string
  status: CertificateRecordStatus
}

/**
 * `POST /api/task/accept` 的 `data`。
 * `attributed=true` = 本次**新建**了参与行；`rejoined=true` = 命中本人 `voided` 行并**重新激活**
 * （★ v1.4 反悔）。游客或重复 accept（`responded`/`arrived`/`left`）⇒ 两者皆 `false`。
 */
export interface AcceptTaskResult {
  attributed: boolean
  rejoined: boolean
}

/**
 * `POST /api/task/arrive` 的 `data`（★ v1.2）。
 * `arrived=true` = 本次真正写入到达时刻；`false` = 游客 / 未报名 / 重复上报（起点不被覆盖）。
 */
export interface ArriveTaskResult {
  arrived: boolean
}

/**
 * `POST /api/task/complete` 的 `data`。
 * `closed` = 本次真正闭合的参与行数（**按人**；幂等：重复调用恒 0；未到场 ⇒ 0）。
 * `minutes` = 本次入账分钟之和（= `round((ended − arrived)/60000)`）。
 */
export interface CompleteTaskResult {
  closed: number
  minutes: number
}

/**
 * `POST /api/task/abandon` 的 `data`（★ v1.2）。
 * `voided=true` = 本次真正作废了本人参与行（放弃/中途退出 ⇒ 不写台账）。
 */
export interface AbandonTaskResult {
  voided: boolean
}

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
