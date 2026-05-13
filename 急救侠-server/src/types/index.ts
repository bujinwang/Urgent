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
