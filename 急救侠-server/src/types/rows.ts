/**
 * Database row interfaces (snake_case column names).
 *
 * These interfaces describe the raw rows returned by the typed DB helpers in
 * `src/db.ts` (`get<T>()` / `all<T>()`) and by `db.prepare(...).get/all`.
 * They are derived directly from the `CREATE TABLE` / `ALTER TABLE` statements
 * in `src/db.ts`.
 *
 * Conventions:
 * - SQLite `TEXT` columns map to `string`, `INTEGER` / `REAL` to `number`.
 * - Columns declared `NOT NULL` are non-nullable.
 * - Nullable `TEXT` columns are modelled as `T | undefined` (i.e. "absent").
 *   This mirrors how the API layer treats them (optional response fields) and,
 *   importantly, keeps the raw value untouched at runtime — no null/undefined
 *   normalisation is applied when rows are mapped to domain objects.
 * - Enum-backed columns (tier/type/status) reuse the corresponding domain
 *   union types so service code does not need casts when building responses.
 */
import type {
  UserTier,
  OrgType,
  OrgMemberRole,
  AedStatus,
  CertificateStatus,
  AedManagerRole,
  AedMaintenanceType,
  AedCertificationType,
  AedCheckin,
  NewsItem,
  CustodianAlertStatus,
  UnlockAction,
  UnlockCommandStatus,
} from './index'

// ---- Aggregate helpers ----

/** `SELECT COUNT(*) AS cnt ...` */
export interface CountRow {
  cnt: number
}

/** `SELECT status, COUNT(*) AS cnt ... GROUP BY status` */
export interface StatusCountRow {
  status: string
  cnt: number
}

// ---- Core tables ----

export interface UserRow {
  id: string
  name: string
  avatar: string
  tier: UserTier
  points: number
  city: string
  volunteer_id: string
  certifications: string
  rescue_count: number
  public_id: string
  is_leader: number
  affiliation: string
  volunteer_type: string
  is_organizer: number
  is_public: number
  /** 平台管理员（迁移 036 引入，与「队伍队长」`is_leader` 正交）。公开接口不得输出。 */
  is_platform_admin: number
  password: string
}

export interface TaskRow {
  id: string
  type: 'cpr' | 'aed' | 'assist'
  address: string
  distance: number
  lat: number
  lng: number
  volunteers_needed: number
  volunteers_responded: number
  status: 'pending' | 'active' | 'completed'
  created_at: string
}

export interface StatRow {
  id: number
  certified_rescuers: number
  networked_aeds: number
  monthly_rescues: number
  online_volunteers: number
  aeds_within_1km: number
}

// ---- AED ----

export interface AedRow {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  distance: number
  status: AedStatus
  last_check: string
  battery_level: number
  model: string
  serial_number: string
  battery_expiry: string
  electrode_expiry: string
  last_maintenance: string
  indoor: number
  floor: string
  open_hours: string
  finding_instructions: string
  custodian_name: string
  custodian_phone: string
  custodian_role: string
  reported_by: string
  reported_at: string
  is_mobile: number
  linked_user_id: string
}

export interface AedCheckinRow {
  id: string
  aed_id: string
  user_id: string
  user_name: string
  photo: string
  date: string
  status: AedCheckin['status']
  comment: string
  finding_tip: string
}

export interface AedManagerRow {
  id: string
  aed_id: string
  user_id: string
  user_name: string
  role: AedManagerRole
  assigned_at: string
}

export interface AedMaintenanceRow {
  id: string
  aed_id: string
  type: AedMaintenanceType
  date: string
  performed_by: string
  notes: string
  next_due: string
  created_at: string
}

export interface AedPickupRow {
  id: string
  aed_id: string
  user_id: string
  user_name: string
  pickup_time: string
  return_time: string | undefined
  mission_id: string | undefined
  notes: string
}

export interface AedAuditLogRow {
  id: string
  aed_id: string
  event_type: string
  description: string
  user_id: string
  user_name: string
  old_value: string | undefined
  new_value: string | undefined
  created_at: string
}

export interface AedCertificationRow {
  id: string
  aed_id: string
  type: AedCertificationType
  name: string
  issuer: string
  issue_date: string
  expiry_date: string
  status: CertificateStatus
  file_url: string | undefined
  created_at: string
}

// ---- News / Learn / Atlas ----

export interface NewsRow {
  id: string
  title: string
  type: NewsItem['type']
  category: NewsItem['category']
  time: string
  location_name: string
  location_lat: number
  location_lng: number
  tags: string
  is_live: number
  is_urgent: number
  body: string | undefined
  image_url: string | undefined
  video_url: string | undefined
}

export interface CourseRow {
  id: string
  title: string
  category: string
  duration: string
  completed: number
  progress: number
  icon: string | undefined
}

export interface AtlasCardRow {
  id: string
  title: string
  category: string
  description: string
  steps: string
  icon: string | undefined
  image_url: string | undefined
}

// ---- Volunteers / Records / Cases ----

export interface VolunteerRow {
  id: string
  name: string
  avatar: string
  tier: UserTier
  points: number
  rescue_count: number
  city: string
  rank_pos: number
  role: string
  coach_specialties: string
  coach_certifications: string
  coach_bio: string
  coach_available: number
}

export interface RescueRecordRow {
  id: string
  type: string
  date: string
  location: string
  role: string
  squad: string
  result: string
}

export interface RescueCaseRow {
  id: string
  title: string
  summary: string
  date: string
  location: string
  result: string
  volunteers: string
  body: string | undefined
  news_id: string | undefined
}

/** 政府看板访问白名单行（独立于 users，无外键） */
export interface GovViewerRow {
  id: string
  username: string
  password_hash: string
  name: string
  org_name: string
  scope_all: number
  scope_districts: string        // JSON string
  allowed_ips: string
  active: number
  last_login_at: number | null
  created_at: number
  updated_at: number
}

/** 通用聚合行（分组计数） */
export interface NamedCountRow {
  key: string
  cnt: number
}

// ---- Organizations / Certificates ----

export interface OrganizationRow {
  id: string
  name: string
  type: OrgType
  admin_user_id: string
  created_at: string
}

export interface OrganizationMemberRow {
  id: string
  org_id: string
  user_id: string
  role: OrgMemberRole
  joined_at: string
}

export interface CertificateRow {
  id: string
  user_id: string
  type: string
  issuer: string
  issue_date: string
  expiry_date: string
  status: CertificateStatus
  file_url: string | undefined
  created_at: string
}

export interface NotificationRow {
  id: string
  org_id: string
  user_id: string
  type: string
  title: string
  message: string
  is_read: number
  created_at: string
}

// ---- Trails ----

export interface UserTrailRow {
  id: string
  user_id: string
  user_name: string
  total_distance: number
  total_elevation: number
  hikes_completed: number
  last_hike_date: string
  longest_hike: number
  badge: string
}

export interface TrailEventRow {
  id: string
  title: string
  description: string
  route: string
  distance: number
  elevation: number
  difficulty: string
  date: string
  meeting_point: string
  lat: number
  lng: number
  max_participants: number
  current_participants: number
  organizer_id: string
  organizer_name: string
  status: string
  created_at: string
}

// ---- Rescue replays / media / live ----

export interface RescueReplayRow {
  id: string
  task_id: string
  title: string
  description: string
  address: string
  scene_type: string
  patient_age: string
  patient_gender: string
  volunteers_count: number
  duration: string
  outcome: string
  like_count: number
  comment_count: number
  bookmark_count: number
  created_at: string
}

export interface TaskMediaRow {
  id: string
  task_id: string
  user_id: string
  user_name: string
  user_avatar: string
  type: string
  content: string
  media_url: string
  lat: number
  lng: number
  created_at: string
}

export interface ReplayCommentRow {
  id: string
  replay_id: string
  user_id: string
  user_name: string
  user_avatar: string
  content: string
  created_at: string
}

export interface LiveSessionRow {
  id: string
  task_id: string
  user_id: string
  user_name: string
  user_avatar: string
  device_info: string
  started_at: string
  ended_at: string | undefined
}

// ---- External certifications / mobilization / training ----

export interface ExternalCertificationRow {
  id: string
  user_id: string
  type: string
  issuer: string
  cert_number: string
  issue_date: string
  expiry_date: string
  file_url: string
  status: string
  created_at: string
}

export interface EmergencyMobilizationRow {
  id: string
  title: string
  description: string
  type: string
  address: string
  lat: number
  lng: number
  volunteers_needed: number
  volunteers_responded: number
  leader_id: string
  leader_name: string
  status: string
  approved_by: string
  approved_at: string | undefined
  created_at: string
}

export interface MobilizationVolunteerRow {
  id: string
  mobilization_id: string
  user_id: string
  user_name: string
  status: string
  responded_at: string
}

export interface TrainingRecordRow {
  id: string
  user_id: string
  user_name: string
  scenario: string
  date: string
  organizer_id: string
  organizer_name: string
  drill_id: string
  notes: string
  created_at: string
}

// ---- Composite rows (JOIN / aggregate projections) ----

/** `organization_members om JOIN users u` (members list). */
export interface OrgMemberJoinedRow extends OrganizationMemberRow {
  user_name: string
  user_avatar: string
  user_tier: UserTier
  rescue_count: number
}

/** `certificates c JOIN users u` (adds `user_name`). */
export interface CertificateJoinedRow extends CertificateRow {
  user_name: string
}

/** `users` + correlated certificate / org-admin counts. */
export interface UserWithCountsRow extends UserRow {
  cert_count: number
  org_admin_count: number
}

/** `organizations` + correlated member / certificate counts. */
export interface OrganizationWithCountsRow extends OrganizationRow {
  member_count: number
  cert_count: number
}

/** `certificates c JOIN users u` for the admin console. */
export interface AdminCertificateRow extends CertificateRow {
  user_name: string
  org_id: string | undefined
}

/** `organization_members om JOIN organizations o` role lookup. */
export interface OrgRoleRow {
  org_id: string
  role: string
  org_name: string
  org_type: string
}

/** `user_trails ut JOIN users u` for the hiking leaderboard. */
export interface HikerRow extends UserTrailRow {
  tier: UserTier
  avatar: string
  city: string
  rescue_count: number
}

/** `users u` projection used by the rescue team endpoint. */
export interface VolunteerTeamRow {
  id: string
  name: string
  avatar: string
  tier: UserTier
  rescue_count: number
  city: string
}

/** `certificates` projection used by the public profile endpoint. */
export interface PublicCertificateRow {
  type: string
  issuer: string
  issue_date: string
  expiry_date: string
  status: string
}

/** `training_records` projection used by the public profile endpoint. */
export interface PublicTrainingRow {
  scenario: string
  date: string
  organizer_name: string
  notes: string
}

/** `external_certifications` projection used by the public profile endpoint. */
export interface PublicExternalCertRow {
  type: string
  issuer: string
  cert_number: string
}

/** `SELECT name FROM users WHERE id = ?` */
export interface UserNameRow {
  name: string
}

/** `SELECT is_leader FROM users WHERE id = ?` */
export interface UserLeaderRow {
  is_leader: number
}

/** `SELECT affiliation FROM users WHERE id = ?` */
export interface UserAffiliationRow {
  affiliation: string
}

/** `SELECT organizer_id FROM trail_events WHERE id = ?` */
export interface TrailEventOrganizerRow {
  organizer_id: string
}

/**
 * Subset of `users` handled by the WeChat login flow — the columns the route
 * reads when building the login response (and when creating a brand-new user).
 */
export type UserLoginProfileRow = Pick<
  UserRow,
  'name' | 'avatar' | 'tier' | 'points' | 'city' | 'volunteer_id' | 'certifications' | 'rescue_count'
>

// ---- Stray animals / wildlife ----

export interface StrayAnimalRow {
  id: string
  name: string
  species: string
  color: string
  size: string
  features: string
  photos: string
  location: string
  lat: number
  lng: number
  status: string
  created_by: string
  created_at: string
}

export interface AnimalCareRecordRow {
  id: string
  animal_id: string
  user_id: string
  user_name: string
  care_type: string
  description: string
  photos: string
  lat: number
  lng: number
  created_at: string
}

export interface AnimalHealthRecordRow {
  id: string
  animal_id: string
  user_id: string
  user_name: string
  check_type: string
  findings: string
  vet_name: string
  photos: string
  created_at: string
}

export interface WildlifeReportRow {
  id: string
  user_id: string
  user_name: string
  category: string
  species: string
  description: string
  lat: number
  lng: number
  location: string
  photos: string
  status: string
  assigned_to: string
  created_at: string
}

export interface WildlifeRescueTaskRow {
  id: string
  report_id: string
  title: string
  species: string
  description: string
  address: string
  lat: number
  lng: number
  volunteers_needed: number
  volunteers_responded: number
  leader_id: string
  leader_name: string
  status: string
  created_at: string
}

// ---- Drills ----

export interface DrillEventRow {
  id: string
  title: string
  description: string
  scenario: string
  date: string
  location: string
  lat: number
  lng: number
  max_participants: number
  current_participants: number
  organizer_id: string
  organizer_name: string
  status: string
  points_reward: number
  created_at: string
}

export interface DrillParticipantRow {
  id: string
  event_id: string
  user_id: string
  user_name: string
  attended: number
  joined_at: string
}

// ---- Video ----

export interface VideoPostRow {
  id: string
  user_id: string
  user_name: string
  user_avatar: string
  title: string
  description: string
  video_url: string
  thumbnail: string
  duration: string
  view_count: number
  like_count: number
  share_count: number
  comment_count: number
  category: string
  created_at: string
}

export interface VideoCommentRow {
  id: string
  video_id: string
  user_id: string
  user_name: string
  user_avatar: string
  content: string
  created_at: string
}

// ---- Community messaging ----

export interface VolunteerLocationRow {
  id: string
  user_id: string
  user_name: string
  lat: number
  lng: number
  updated_at: string
}

export interface MessageRow {
  id: string
  from_user_id: string
  from_user_name: string
  to_user_id: string
  content: string
  is_read: number
  created_at: string
}

export interface VolunteerGroupRow {
  id: string
  name: string
  description: string
  created_by: string
  created_at: string
}

export interface GroupMemberRow {
  id: string
  group_id: string
  user_id: string
  user_name: string
  joined_at: string
}

export interface GroupMessageRow {
  id: string
  group_id: string
  user_id: string
  user_name: string
  content: string
  created_at: string
}

// ---- Additional composites ----

/** `user_trails`-free projection used by the nearby volunteers endpoint. */
export interface NearbyVolunteerRow extends VolunteerLocationRow {
  tier: UserTier
  rescue_count: number
}

/** `volunteer_groups g` + correlated member count. */
export interface GroupWithMemberCountRow extends VolunteerGroupRow {
  mc: number
}

/** `wildlife` conservation org lookup projection. */
export interface WildlifeOrgRow {
  id: string
  name: string
  admin_user_id: string
}

/** Drill organizers leaderboard projection. */
export interface DrillOrganizerRow {
  id: string
  name: string
  avatar: string
  tier: UserTier
  points: number
  drills_completed: number
}

// ---- AED custodian linkage ----

/**
 * `aed_custodian_alerts` row — 每次「通知责任人」产生的求助记录。
 * 所有时间字段均为 UTC epoch 毫秒（INTEGER），与既有 `datetime('now')` 文本表并存。
 */
export interface AedCustodianAlertRow {
  id: string
  aed_id: string
  pickup_id: string
  requester_user_id: string
  requester_user_name: string
  requester_user_phone: string
  custodian_user_id: string
  custodian_name: string
  custodian_phone_snapshot: string
  custodian_role: string
  channel: 'push' | 'sms' | 'phone' | 'multi'
  status: CustodianAlertStatus
  notify_time_ms: number
  first_sent_time_ms: number | null
  responded_time_ms: number | null
  sla_deadline_ms: number
  response_latency_ms: number | null
  sla_met: number | null
  unlock_action: UnlockAction
  unlock_command_status: UnlockCommandStatus
  unlock_token: string
  responder_user_id: string
  delivery_state: 'pending' | 'delivered' | 'failed' | 'no_subscription'
  consent_granted: number
  consent_version: string
  consent_at_ms: number | null
  consent_revoked_at_ms: number | null
  notes: string
  created_at: number
  updated_at: number
}
