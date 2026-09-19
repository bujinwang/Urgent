import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { DB_PATH } from './config'

let db: Database.Database

if (DB_PATH === ':memory:') {
  db = new Database(':memory:')
} else {
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
}

db.pragma('foreign_keys = ON')

// ---------------------------------------------------------------------------
// F4 · 志愿服务时长台账（设计：volunteer-service-hours-design.md §4.1）
//
// ⚠️ 这三张表的 DDL **只在下面定义一次**，canonical schema 与 `migrations[]`
// 复用同一常量 ⇒ 从机制上保证「两处逐字一致」（设计 §4.4 硬约束 #9）。
// 时间列**一律 `*_at_ms INTEGER`**（设计 §1.3：`strftime` 对 `'T...Z'`/`'+08:00'`
// 一律按 UTC 解析且忽略时区后缀，本项目已因此出过事故）。
// **绝不含位置列**（设计 D1/T12）：不采经纬度 ⇒ schema 层面强制。
// ---------------------------------------------------------------------------

/** 表 1：台账（唯一权威口径）。所有展示 / 证明 / 导出只读它。 */
const DDL_VOLUNTEER_SERVICE_LOGS = `
CREATE TABLE IF NOT EXISTS volunteer_service_logs (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,                  -- 只来自 token；FK users(id)
  activity_type  TEXT NOT NULL,                  -- rescue_task|drill|training|aed_checkin|manual
  source_type    TEXT NOT NULL DEFAULT 'system', -- system|manual
  source_ref     TEXT NOT NULL DEFAULT '',        -- 关联事件 id；manual 为空
  started_at_ms  INTEGER NOT NULL,
  ended_at_ms    INTEGER,                        -- NULL = 未闭合，不计入时长
  duration_min   INTEGER,                        -- 服务端算；ended 为空时 NULL
  is_drill       INTEGER NOT NULL DEFAULT 0,     -- 演习/真实分离（D4）
  status         TEXT NOT NULL DEFAULT 'pending',-- pending|confirmed|voided
  org_id         TEXT NOT NULL DEFAULT '',       -- 机构归属快照（可空）
  created_by     TEXT NOT NULL DEFAULT '',       -- 人工登记的登记人（留痕）
  voided_at_ms   INTEGER,
  void_reason    TEXT NOT NULL DEFAULT '',       -- 作废留痕（软删，硬约束 #6）
  created_at_ms  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_vsl_user_time ON volunteer_service_logs(user_id, started_at_ms);
CREATE INDEX IF NOT EXISTS idx_vsl_type      ON volunteer_service_logs(activity_type, started_at_ms);
CREATE INDEX IF NOT EXISTS idx_vsl_status    ON volunteer_service_logs(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vsl_dedup
  ON volunteer_service_logs(source_type, source_ref, user_id) WHERE source_ref <> '';`

/** 表 2：证明发放记录。 */
const DDL_SERVICE_CERTIFICATES = `
CREATE TABLE IF NOT EXISTS service_certificates (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,                  -- FK users(id)
  cert_no        TEXT NOT NULL,                  -- 唯一可查，如 VS-20260917-A7F3K2
  period_from_ms INTEGER NOT NULL,
  period_to_ms   INTEGER NOT NULL,
  total_minutes  INTEGER NOT NULL,               -- 只含 is_drill=0 且 status='confirmed' 且 ended 非空
  breakdown_json TEXT NOT NULL DEFAULT '{}',     -- 按 activity_type 分解
  issued_at_ms   INTEGER NOT NULL,
  issued_by      TEXT NOT NULL DEFAULT 'self',   -- self|org_admin
  status         TEXT NOT NULL DEFAULT 'active', -- active|revoked
  revoked_at_ms  INTEGER,
  revoke_reason  TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scert_no ON service_certificates(cert_no);
CREATE INDEX IF NOT EXISTS idx_scert_user ON service_certificates(user_id, issued_at_ms DESC);`

/**
 * 迁移 045（★ v1.3，§4.4 / §11.9）：`service_certificates` 防重复签发。
 *
 * ⚠️ **必须「先去重、再建唯一索引」** —— 旧行为**允许**同 `(user_id, period_from_ms, period_to_ms)`
 * 重复签发 `active` 证明；若直接 `CREATE UNIQUE INDEX`，会因**既有重复行**而**失败**（迁移报错、启动崩）。
 * 故先执行一次性 `UPDATE`：同组多条 `active`，**保留 `issued_at_ms` 最早的一条**，其余置 `revoked`
 * （软删留痕，不物理删）。**全库无重复 ⇒ 该 UPDATE 影响 0 行（幂等）**，重启即收敛。
 *
 * ⚠️ 本索引**刻意不放进 canonical schema**：canonical 在 migrations **之前**执行，若把唯一索引放那里，
 * 含重复行的既有库会在 canonical 阶段就崩、**根本没机会**跑到本迁移的去重步骤。⇒ 只在本迁移里建。
 * 全新库无重复 ⇒ 本迁移直接建索引成功；既有库则先去重再建。
 */
export const MIGRATION_045_SQL = `UPDATE service_certificates
SET status = 'revoked',
    revoked_at_ms = COALESCE(revoked_at_ms, issued_at_ms),
    revoke_reason = 'auto-dedup (migration 045)'
WHERE status = 'active'
  AND id NOT IN (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id, period_from_ms, period_to_ms
               ORDER BY issued_at_ms ASC, id ASC
             ) AS rn
      FROM service_certificates WHERE status = 'active'
    ) WHERE rn = 1
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_scert_active_dedup
  ON service_certificates(user_id, period_from_ms, period_to_ms) WHERE status = 'active';`

/** 表 3（Q3 选 a）：任务参与关系（照 `drill_participants`，唯一差异：时间用 `_ms`）。
 *
 * ★ v1.2（§11.3）：区分「三时刻」—— `responded_at_ms`（报名，**不计时**）/
 * `arrived_at_ms`（★到达，**时长起点**）/ `ended_at_ms`（离开，**时长终点**）；
 * `status ∈ responded|arrived|left|voided`；作废留痕 `voided_at_ms`/`void_reason`。
 */
const DDL_TASK_VOLUNTEERS = `
CREATE TABLE IF NOT EXISTS task_volunteers (
  id               TEXT PRIMARY KEY,
  task_id          TEXT NOT NULL,                -- FK tasks(id)
  user_id          TEXT NOT NULL,                -- FK users(id)
  responded_at_ms  INTEGER NOT NULL,             -- 报名（**不计时**）
  arrived_at_ms    INTEGER,                      -- ★ 到达现场（= 时长起点）；NULL = 未到场
  ended_at_ms      INTEGER,                      -- 离开现场（= 时长终点）
  status           TEXT NOT NULL DEFAULT 'responded', -- responded|arrived|left|voided
  voided_at_ms     INTEGER,                      -- 作废留痕；★v1.4 语义＝**最近一次**作废，重新参与**不清空**（审计）
  void_reason      TEXT NOT NULL DEFAULT '',     -- ★v1.4 同上（最近一次）
  rejoin_count     INTEGER NOT NULL DEFAULT 0,   -- ★v1.4「反悔重新参与」次数（审计）
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tv_task ON task_volunteers(task_id);`

/**
 * `app_meta` 标记键：平台管理员「收窄」是否已发生。
 *
 * 语义：一旦运营通过运维脚本显式降级过任何账号（`is_platform_admin: 1 → 0`），
 * 该键即被置为 `'1'`；此后 {@link backfillPlatformAdmins} **永久停用**。
 * 详见 `src/scripts/narrow-platform-admins.ts` 与 `docs/DEPLOY.md §10`。
 */
export const PLATFORM_ADMIN_NARROWING_DONE_KEY = 'platform_admin_narrowing_done'

/**
 * 迁移 036 的一次性回填：把既有的「队长」（`is_leader = 1`）同时置为平台管理员，
 * 保证拆分**不产生静默失权**（静默失权比静默越权更难排查）。
 *
 * ⚠️ 这是**保权而非授权** —— 迁移前 `is_leader` 同时承担管理面判定，这些账号
 * 当时确实拥有管理权限。副作用：历史上因队伍角色拿到管理面权限的账号会被固化
 * 为平台管理员；「收窄」需业务/运营侧确认名单后另开工单，本函数日志是定位依据。
 *
 * ⚠️ **一旦发生「收窄」，本函数不得再运行** —— 其 WHERE 条件
 * `is_leader = 1 AND is_platform_admin = 0` 会把刚被运营降级的账号**静默重新提权**，
 * 使收窄被自己抵消。这条约束**已从「注释里的规则」升级为机制**：收窄脚本在完成后
 * 置位 {@link PLATFORM_ADMIN_NARROWING_DONE_KEY} 标记，本函数首行即据此早退。
 *
 * 幂等：只处理 `is_platform_admin = 0` 的行，重复调用不会重复授予。
 *
 * @returns 本次被授予平台管理员权限的账号数量；标记已置位时恒为 `0`
 */
export function backfillPlatformAdmins(): number {
  // 机制（非规则）：收窄一旦发生，回填立即停用，绝不把被降级的账号静默提权。
  // 首行早退 —— 不查库、不打日志（保持「幂等且静默」的既有可观测语义）。
  if (getMeta(PLATFORM_ADMIN_NARROWING_DONE_KEY) === '1') return 0

  const rows = all<{ id: string }>(
    'SELECT id FROM users WHERE is_leader = 1 AND is_platform_admin = 0'
  )
  if (rows.length === 0) return 0
  db.prepare('UPDATE users SET is_platform_admin = 1 WHERE is_leader = 1 AND is_platform_admin = 0').run()
  const ids = rows.map((r) => r.id)
  console.warn(
    `[DB] 迁移 036 回填 is_platform_admin（保权，非授权）：${ids.length} 个账号 → ${ids.join(', ')}` +
    `；这些账号历史上凭 is_leader 拥有管理面权限，「收窄」需另开工单确认。`
  )
  return ids.length
}

export function initDb(options: { silent?: boolean } = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      tier TEXT NOT NULL DEFAULT 'bronze',
      points INTEGER NOT NULL DEFAULT 0,
      city TEXT NOT NULL DEFAULT '',
      volunteer_id TEXT NOT NULL DEFAULT '',
      certifications TEXT NOT NULL DEFAULT '[]',
      rescue_count INTEGER NOT NULL DEFAULT 0,
      public_id TEXT NOT NULL DEFAULT '',
      is_leader INTEGER NOT NULL DEFAULT 0,
      affiliation TEXT NOT NULL DEFAULT '',
      volunteer_type TEXT NOT NULL DEFAULT 'medical',
      is_organizer INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 0,
      -- 手机号（可空；迁移 038）：供「AED 责任人联动」推送失败时的短信降级「现取现用」。
      -- 电话注册用户写入；微信用户为空 => 降级时回落设备级 aed_devices.custodian_phone。
      phone TEXT NOT NULL DEFAULT '',
      -- 平台管理员（与"队伍队长" is_leader 正交）：仅用于管理面判定，
      -- 见迁移 036。公开接口绝不可输出此字段。
      is_platform_admin INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      address TEXT NOT NULL,
      distance REAL NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      volunteers_needed INTEGER NOT NULL,
      volunteers_responded INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      district TEXT
    );

    CREATE TABLE IF NOT EXISTS aed_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      distance REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'available',
      last_check TEXT NOT NULL,
      battery_level INTEGER NOT NULL DEFAULT 100,
      model TEXT NOT NULL DEFAULT '',
      serial_number TEXT NOT NULL DEFAULT '',
      battery_expiry TEXT NOT NULL DEFAULT '',
      electrode_expiry TEXT NOT NULL DEFAULT '',
      last_maintenance TEXT NOT NULL DEFAULT '',
      indoor INTEGER NOT NULL DEFAULT 0,
      floor TEXT NOT NULL DEFAULT '',
      open_hours TEXT NOT NULL DEFAULT '',
      finding_instructions TEXT NOT NULL DEFAULT '',
      custodian_name TEXT NOT NULL DEFAULT '',
      custodian_phone TEXT NOT NULL DEFAULT '',
      custodian_role TEXT NOT NULL DEFAULT '',
      reported_by TEXT NOT NULL DEFAULT '',
      reported_at TEXT NOT NULL DEFAULT '',
      is_mobile INTEGER NOT NULL DEFAULT 0,
      linked_user_id TEXT NOT NULL DEFAULT '',
      district TEXT
    );

    CREATE TABLE IF NOT EXISTS aed_checkins (
      id TEXT PRIMARY KEY,
      aed_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      photo TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok',
      comment TEXT NOT NULL DEFAULT '',
      finding_tip TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (aed_id) REFERENCES aed_devices(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS aed_managers (
      id TEXT PRIMARY KEY,
      aed_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'primary',
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (aed_id) REFERENCES aed_devices(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(aed_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS aed_maintenance (
      id TEXT PRIMARY KEY,
      aed_id TEXT NOT NULL,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      performed_by TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      next_due TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (aed_id) REFERENCES aed_devices(id)
    );

    CREATE TABLE IF NOT EXISTS aed_pickups (
      id TEXT PRIMARY KEY,
      aed_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      pickup_time TEXT NOT NULL DEFAULT (datetime('now')),
      return_time TEXT,
      mission_id TEXT DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (aed_id) REFERENCES aed_devices(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS aed_audit_log (
      id TEXT PRIMARY KEY,
      aed_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      user_name TEXT NOT NULL DEFAULT '',
      old_value TEXT DEFAULT '',
      new_value TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (aed_id) REFERENCES aed_devices(id)
    );

    CREATE TABLE IF NOT EXISTS drill_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      scenario TEXT NOT NULL DEFAULT 'cpr',
      date TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      max_participants INTEGER NOT NULL DEFAULT 15,
      current_participants INTEGER NOT NULL DEFAULT 0,
      organizer_id TEXT NOT NULL,
      organizer_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'upcoming',
      points_reward INTEGER NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organizer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS stray_animals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      species TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      features TEXT NOT NULL DEFAULT '',
      photos TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'stray',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS animal_care_records (
      id TEXT PRIMARY KEY,
      animal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      care_type TEXT NOT NULL DEFAULT 'feeding',
      description TEXT NOT NULL DEFAULT '',
      photos TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (animal_id) REFERENCES stray_animals(id)
    );

    CREATE TABLE IF NOT EXISTS animal_health_records (
      id TEXT PRIMARY KEY,
      animal_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      check_type TEXT NOT NULL DEFAULT 'general',
      findings TEXT NOT NULL DEFAULT '',
      vet_name TEXT NOT NULL DEFAULT '',
      photos TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (animal_id) REFERENCES stray_animals(id)
    );

    CREATE TABLE IF NOT EXISTS wildlife_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'wildlife',
      species TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      location TEXT NOT NULL DEFAULT '',
      photos TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'reported',
      assigned_to TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wildlife_rescue_tasks (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      species TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      volunteers_needed INTEGER NOT NULL DEFAULT 3,
      volunteers_responded INTEGER NOT NULL DEFAULT 0,
      leader_id TEXT NOT NULL,
      leader_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (leader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS training_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      scenario TEXT NOT NULL,
      date TEXT NOT NULL,
      organizer_id TEXT NOT NULL DEFAULT '',
      organizer_name TEXT NOT NULL DEFAULT '',
      drill_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS drill_participants (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      attended INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES drill_events(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS user_trails (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      user_name TEXT NOT NULL DEFAULT '',
      total_distance REAL NOT NULL DEFAULT 0,
      total_elevation REAL NOT NULL DEFAULT 0,
      hikes_completed INTEGER NOT NULL DEFAULT 0,
      last_hike_date TEXT NOT NULL DEFAULT '',
      longest_hike REAL NOT NULL DEFAULT 0,
      badge TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS trail_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      route TEXT NOT NULL DEFAULT '',
      distance REAL NOT NULL DEFAULT 0,
      elevation REAL NOT NULL DEFAULT 0,
      difficulty TEXT NOT NULL DEFAULT 'moderate',
      date TEXT NOT NULL,
      meeting_point TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      max_participants INTEGER NOT NULL DEFAULT 20,
      current_participants INTEGER NOT NULL DEFAULT 0,
      organizer_id TEXT NOT NULL,
      organizer_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'upcoming',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (organizer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS trail_event_participants (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (event_id) REFERENCES trail_events(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(event_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS external_certifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      issuer TEXT NOT NULL DEFAULT '',
      cert_number TEXT NOT NULL DEFAULT '',
      issue_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      file_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS emergency_mobilizations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'rescue',
      address TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      volunteers_needed INTEGER NOT NULL DEFAULT 5,
      volunteers_responded INTEGER NOT NULL DEFAULT 0,
      leader_id TEXT NOT NULL,
      leader_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT NOT NULL DEFAULT '',
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (leader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS mobilization_volunteers (
      id TEXT PRIMARY KEY,
      mobilization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'responded',
      responded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (mobilization_id) REFERENCES emergency_mobilizations(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(mobilization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS volunteer_locations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      user_name TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      from_user_name TEXT NOT NULL DEFAULT '',
      to_user_id TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS volunteer_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES volunteer_groups(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS group_messages (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES volunteer_groups(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS rescue_replays (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      scene_type TEXT NOT NULL DEFAULT '',
      patient_age TEXT NOT NULL DEFAULT '',
      patient_gender TEXT NOT NULL DEFAULT '',
      volunteers_count INTEGER NOT NULL DEFAULT 0,
      duration TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      like_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      bookmark_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS replay_comments (
      id TEXT PRIMARY KEY,
      replay_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      user_avatar TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS live_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      user_avatar TEXT NOT NULL DEFAULT '',
      device_info TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT
    );

    CREATE TABLE IF NOT EXISTS task_media (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      user_avatar TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL DEFAULT '',
      media_url TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 0,
      lng REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      user_avatar TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL DEFAULT '',
      thumbnail TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '',
      view_count INTEGER NOT NULL DEFAULT 0,
      like_count INTEGER NOT NULL DEFAULT 0,
      share_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'rescue',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_comments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL DEFAULT '',
      user_avatar TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ★ P1-4：点赞/播放去重表。同一用户对同一视频只记一行（主键去重），
    -- 配合 INSERT OR IGNORE 让 /:id/like、/:id/view 幂等，避免「实名可刷」。
    CREATE TABLE IF NOT EXISTS video_likes (
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, video_id)
    );

    CREATE TABLE IF NOT EXISTS video_views (
      user_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, video_id)
    );

    CREATE TABLE IF NOT EXISTS public_inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      target_public_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'certificate',
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES organizations(id)
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      accepted INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, template_id)
    );

    CREATE TABLE IF NOT EXISTS aed_certifications (
      id TEXT PRIMARY KEY,
      aed_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'manufacturer',
      name TEXT NOT NULL,
      issuer TEXT NOT NULL DEFAULT '',
      issue_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      file_url TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (aed_id) REFERENCES aed_devices(id)
    );

    CREATE TABLE IF NOT EXISTS aed_custodian_alerts (
      id                      TEXT PRIMARY KEY,
      aed_id                  TEXT NOT NULL,
      pickup_id               TEXT NOT NULL DEFAULT '',
      requester_user_id       TEXT NOT NULL DEFAULT '',
      requester_user_name     TEXT NOT NULL DEFAULT '',
      requester_user_phone    TEXT NOT NULL DEFAULT '',
      custodian_user_id       TEXT NOT NULL DEFAULT '',
      custodian_name          TEXT NOT NULL DEFAULT '',
      custodian_phone_snapshot TEXT NOT NULL DEFAULT '',
      custodian_role          TEXT NOT NULL DEFAULT '',
      channel                 TEXT NOT NULL DEFAULT 'push',
      status                  TEXT NOT NULL DEFAULT 'pending',
      notify_time_ms          INTEGER NOT NULL,
      first_sent_time_ms      INTEGER,
      responded_time_ms       INTEGER,
      sla_deadline_ms         INTEGER NOT NULL,
      response_latency_ms     INTEGER,
      sla_met                 INTEGER,
      unlock_action           TEXT NOT NULL DEFAULT 'none',
      unlock_command_status   TEXT NOT NULL DEFAULT 'not_issued',
      unlock_token            TEXT NOT NULL DEFAULT '',
      responder_user_id       TEXT NOT NULL DEFAULT '',
      delivery_state          TEXT NOT NULL DEFAULT 'pending',
      consent_granted         INTEGER NOT NULL DEFAULT 0,
      consent_version         TEXT NOT NULL DEFAULT '',
      consent_at_ms           INTEGER,
      consent_revoked_at_ms   INTEGER,
      notes                   TEXT NOT NULL DEFAULT '',
      created_at              INTEGER NOT NULL,
      updated_at              INTEGER NOT NULL,
      FOREIGN KEY (aed_id) REFERENCES aed_devices(id)
    );

    -- 短信下发流水（P1 语音降级用）：仅存 biz_id / alert_id / custodian_user_id，**绝不存手机号**。
    -- 状态报告回调按 biz_id 查此行；号码在回调时用 custodian_user_id 从本库重新解析。
    CREATE TABLE IF NOT EXISTS aed_sms_dispatches (
      id TEXT PRIMARY KEY,
      biz_id TEXT NOT NULL,
      alert_id TEXT NOT NULL,
      custodian_user_id TEXT NOT NULL,
      report_status TEXT NOT NULL DEFAULT '',
      voice_state TEXT NOT NULL DEFAULT 'none',
      voice_at_ms INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sms_dispatches_biz ON aed_sms_dispatches(biz_id);

    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      time TEXT NOT NULL,
      location_name TEXT NOT NULL,
      location_lat REAL NOT NULL DEFAULT 0,
      location_lng REAL NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      is_live INTEGER NOT NULL DEFAULT 0,
      is_urgent INTEGER NOT NULL DEFAULT 0,
      body TEXT,
      image_url TEXT,
      video_url TEXT
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      duration TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      progress REAL NOT NULL DEFAULT 0,
      icon TEXT
    );

    CREATE TABLE IF NOT EXISTS volunteers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      tier TEXT NOT NULL DEFAULT 'bronze',
      points INTEGER NOT NULL DEFAULT 0,
      rescue_count INTEGER NOT NULL DEFAULT 0,
      city TEXT NOT NULL DEFAULT '',
      rank_pos INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'volunteer',
      coach_specialties TEXT NOT NULL DEFAULT '[]',
      coach_certifications TEXT NOT NULL DEFAULT '[]',
      coach_bio TEXT NOT NULL DEFAULT '',
      coach_available INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rescue_records (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      role TEXT NOT NULL,
      squad TEXT NOT NULL DEFAULT '[]',
      result TEXT NOT NULL DEFAULT '',
      district TEXT
    );

    CREATE TABLE IF NOT EXISTS rescue_cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT '',
      volunteers TEXT NOT NULL DEFAULT '[]',
      body TEXT,
      news_id TEXT
    );

    CREATE TABLE IF NOT EXISTS atlas_cards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      steps TEXT NOT NULL DEFAULT '[]',
      icon TEXT,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      certified_rescuers INTEGER NOT NULL DEFAULT 0,
      networked_aeds INTEGER NOT NULL DEFAULT 0,
      monthly_rescues INTEGER NOT NULL DEFAULT 0,
      online_volunteers INTEGER NOT NULL DEFAULT 0,
      aeds_within_1km INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'company',
      admin_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (org_id) REFERENCES organizations(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(org_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      issuer TEXT NOT NULL DEFAULT '',
      issue_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      file_url TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS gov_viewers (
      id               TEXT PRIMARY KEY,
      username         TEXT NOT NULL,
      password_hash    TEXT NOT NULL DEFAULT '',
      name             TEXT NOT NULL DEFAULT '',
      org_name         TEXT NOT NULL DEFAULT '',
      scope_all        INTEGER NOT NULL DEFAULT 0,
      scope_districts  TEXT NOT NULL DEFAULT '[]',
      allowed_ips      TEXT NOT NULL DEFAULT '',
      active           INTEGER NOT NULL DEFAULT 1,
      last_login_at    INTEGER,
      created_at       INTEGER NOT NULL,
      updated_at       INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_viewers_username ON gov_viewers(username);
  `)

  /**
   * SOS 触发留痕（F3 / 建议书 §10「恶意虚假呼救可追溯」）。
   *
   * ⚠️ **本表刻意不含任何位置字段**（D1）。这不是"暂时没加"：列不存在，"不采位置"就由 schema 强制，
   * 任何后续代码都写不进来。改动此表前请先读 `deliverables/software-company/sos-telemetry-design.md` §2.1。
   *
   * - `user_id` 可空，NULL = 匿名呼救（建议书 §04「无需注册」）。
   *   **绝不从请求体取**，只由 `optionalAuth` 从 token 派生 —— 否则可把伪造 SOS 记到他人名下。
   * - `created_at_ms` 是**范围查询的唯一依据**。刻意不依赖 `strftime('%s', created_at)`：
   *   该函数对 `'T...Z'` / `' ... '` / `'+08:00'` 一律按 UTC 解析且忽略时区后缀，非法值返回 null，
   *   本项目已因此出过一次事故（见 `signatureKeepAlive.ts`）。`created_at` 仅供人读。
   * - `is_drill` 是**客户端声明、服务端不可验证的提示，不是安全边界**，详见设计文档 §8。
   * - `client_event_id` 唯一索引 = 传输层重复提交的幂等键（`INSERT OR IGNORE`）。
   */
  db.exec(`
    CREATE TABLE IF NOT EXISTS sos_events (
      id               TEXT PRIMARY KEY,
      client_event_id  TEXT NOT NULL,
      user_id          TEXT,
      is_drill         INTEGER NOT NULL DEFAULT 0,
      client_platform  TEXT NOT NULL DEFAULT '',
      created_at_ms    INTEGER NOT NULL,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sos_events_client ON sos_events(client_event_id);
    CREATE INDEX IF NOT EXISTS idx_sos_events_user ON sos_events(user_id, created_at_ms);
    CREATE INDEX IF NOT EXISTS idx_sos_events_real ON sos_events(is_drill, created_at_ms);
  `)

  // ---- F4 · 志愿服务时长台账（canonical schema）----
  // 用共享常量建表 ⇒ 与 `migrations[]` 中的 041/042/043 **逐字一致**（设计 §4.4）。
  db.exec(`${DDL_TASK_VOLUNTEERS}\n${DDL_VOLUNTEER_SERVICE_LOGS}\n${DDL_SERVICE_CERTIFICATES}`)

  // ---- Tracked migrations ----
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL DEFAULT '',
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  // ---- 通用键值元数据（迁移 037）----
  // 用途：存储跨启动、跨进程需要**持久记忆**的运维事实（首个使用者是
  // `platform_admin_narrowing_done`：记录「平台管理员收窄是否已发生」）。
  // 之所以同时写入 canonical schema 与迁移 037：前者管全新库、后者管既有库
  // （CREATE TABLE IF NOT EXISTS 幂等，两者都跑不会冲突）。
  db.exec(`CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  )`)

  const migrations: Array<{ id: string; description: string; sql: string; after?: () => void }> = [
    { id: '001_add_password', description: 'add password column to users', sql: "ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''" },
    { id: '002_add_coach_role', description: 'add role column to volunteers', sql: "ALTER TABLE volunteers ADD COLUMN role TEXT NOT NULL DEFAULT 'volunteer'" },
    { id: '003_add_coach_specialties', description: 'add coach_specialties to volunteers', sql: "ALTER TABLE volunteers ADD COLUMN coach_specialties TEXT NOT NULL DEFAULT '[]'" },
    { id: '004_add_coach_certs', description: 'add coach_certifications to volunteers', sql: "ALTER TABLE volunteers ADD COLUMN coach_certifications TEXT NOT NULL DEFAULT '[]'" },
    { id: '005_add_coach_bio', description: 'add coach_bio to volunteers', sql: "ALTER TABLE volunteers ADD COLUMN coach_bio TEXT NOT NULL DEFAULT ''" },
    { id: '006_add_coach_available', description: 'add coach_available to volunteers', sql: "ALTER TABLE volunteers ADD COLUMN coach_available INTEGER NOT NULL DEFAULT 1" },
    { id: '007_add_aed_model', description: 'add model to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN model TEXT NOT NULL DEFAULT ''" },
    { id: '008_add_aed_serial', description: 'add serial_number to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN serial_number TEXT NOT NULL DEFAULT ''" },
    { id: '009_add_aed_battery_expiry', description: 'add battery_expiry to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN battery_expiry TEXT NOT NULL DEFAULT ''" },
    { id: '010_add_aed_electrode_expiry', description: 'add electrode_expiry to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN electrode_expiry TEXT NOT NULL DEFAULT ''" },
    { id: '011_add_aed_last_maint', description: 'add last_maintenance to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN last_maintenance TEXT NOT NULL DEFAULT ''" },
    { id: '012_add_aed_indoor', description: 'add indoor to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN indoor INTEGER NOT NULL DEFAULT 0" },
    { id: '013_add_aed_floor', description: 'add floor to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN floor TEXT NOT NULL DEFAULT ''" },
    { id: '014_add_aed_hours', description: 'add open_hours to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN open_hours TEXT NOT NULL DEFAULT ''" },
    { id: '015_add_aed_finding_instructions', description: 'add finding_instructions to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN finding_instructions TEXT NOT NULL DEFAULT ''" },
    { id: '016_add_aed_custodian_name', description: 'add custodian_name to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN custodian_name TEXT NOT NULL DEFAULT ''" },
    { id: '017_add_aed_custodian_phone', description: 'add custodian_phone to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN custodian_phone TEXT NOT NULL DEFAULT ''" },
    { id: '018_add_aed_custodian_role', description: 'add custodian_role to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN custodian_role TEXT NOT NULL DEFAULT ''" },
    { id: '019_add_aed_reported_by', description: 'add reported_by to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN reported_by TEXT NOT NULL DEFAULT ''" },
    { id: '020_add_aed_reported_at', description: 'add reported_at to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN reported_at TEXT NOT NULL DEFAULT ''" },
    { id: '021_add_aed_is_mobile', description: 'add is_mobile to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN is_mobile INTEGER NOT NULL DEFAULT 0" },
    { id: '022_add_aed_linked_user', description: 'add linked_user_id to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN linked_user_id TEXT NOT NULL DEFAULT ''" },
    { id: '023_add_user_public_id', description: 'add public_id to users', sql: "ALTER TABLE users ADD COLUMN public_id TEXT NOT NULL DEFAULT ''" },
    { id: '024_add_user_is_leader', description: 'add is_leader to users', sql: "ALTER TABLE users ADD COLUMN is_leader INTEGER NOT NULL DEFAULT 0" },
    { id: '025_add_user_affiliation', description: 'add affiliation to users', sql: "ALTER TABLE users ADD COLUMN affiliation TEXT NOT NULL DEFAULT ''" },
    { id: '026_add_user_volunteer_type', description: 'add volunteer_type to users', sql: "ALTER TABLE users ADD COLUMN volunteer_type TEXT NOT NULL DEFAULT 'medical'" },
    { id: '027_add_user_is_organizer', description: 'add is_organizer to users', sql: "ALTER TABLE users ADD COLUMN is_organizer INTEGER NOT NULL DEFAULT 0" },
    { id: '028_add_user_is_public', description: 'add is_public to users', sql: "ALTER TABLE users ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0" },
    { id: '029_add_video_comment_count', description: 'add comment_count to video_posts', sql: "ALTER TABLE video_posts ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0" },
    {
      id: '030_add_custodian_alerts',
      description: 'create aed_custodian_alerts table + indexes for custodian linkage',
      sql: `CREATE TABLE IF NOT EXISTS aed_custodian_alerts (
        id                      TEXT PRIMARY KEY,
        aed_id                  TEXT NOT NULL,
        pickup_id               TEXT NOT NULL DEFAULT '',
        requester_user_id       TEXT NOT NULL DEFAULT '',
        requester_user_name     TEXT NOT NULL DEFAULT '',
        requester_user_phone    TEXT NOT NULL DEFAULT '',
        custodian_user_id       TEXT NOT NULL DEFAULT '',
        custodian_name          TEXT NOT NULL DEFAULT '',
        custodian_phone_snapshot TEXT NOT NULL DEFAULT '',
        custodian_role          TEXT NOT NULL DEFAULT '',
        channel                 TEXT NOT NULL DEFAULT 'push',
        status                  TEXT NOT NULL DEFAULT 'pending',
        notify_time_ms          INTEGER NOT NULL,
        first_sent_time_ms      INTEGER,
        responded_time_ms       INTEGER,
        sla_deadline_ms         INTEGER NOT NULL,
        response_latency_ms     INTEGER,
        sla_met                 INTEGER,
        unlock_action           TEXT NOT NULL DEFAULT 'none',
        unlock_command_status   TEXT NOT NULL DEFAULT 'not_issued',
        unlock_token            TEXT NOT NULL DEFAULT '',
        responder_user_id       TEXT NOT NULL DEFAULT '',
        delivery_state          TEXT NOT NULL DEFAULT 'pending',
        consent_granted         INTEGER NOT NULL DEFAULT 0,
        consent_version         TEXT NOT NULL DEFAULT '',
        consent_at_ms           INTEGER,
        consent_revoked_at_ms   INTEGER,
        notes                   TEXT NOT NULL DEFAULT '',
        created_at              INTEGER NOT NULL,
        updated_at              INTEGER NOT NULL,
        FOREIGN KEY (aed_id) REFERENCES aed_devices(id)
      );
      CREATE INDEX IF NOT EXISTS idx_custodian_alerts_aed ON aed_custodian_alerts(aed_id, notify_time_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_custodian_alerts_custodian ON aed_custodian_alerts(custodian_user_id, status);
      CREATE INDEX IF NOT EXISTS idx_custodian_alerts_status ON aed_custodian_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_custodian_alerts_requester ON aed_custodian_alerts(requester_user_id);`
    },
    {
      id: '031_add_case_news_link',
      description: 'add nullable news_id to rescue_cases for case<->news linkage',
      sql: "ALTER TABLE rescue_cases ADD COLUMN news_id TEXT"
    },
    {
      id: '032_add_gov_viewers',
      description: 'create gov_viewers table + unique index (gov dashboard auth)',
      sql: `CREATE TABLE IF NOT EXISTS gov_viewers (
        id               TEXT PRIMARY KEY,
        username         TEXT NOT NULL,
        password_hash    TEXT NOT NULL DEFAULT '',
        name             TEXT NOT NULL DEFAULT '',
        org_name         TEXT NOT NULL DEFAULT '',
        scope_all        INTEGER NOT NULL DEFAULT 0,
        scope_districts  TEXT NOT NULL DEFAULT '[]',
        allowed_ips      TEXT NOT NULL DEFAULT '',
        active           INTEGER NOT NULL DEFAULT 1,
        last_login_at    INTEGER,
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_viewers_username ON gov_viewers(username);`
    },
    { id: '033_add_district_aed', description: 'add nullable district to aed_devices', sql: "ALTER TABLE aed_devices ADD COLUMN district TEXT" },
    { id: '034_add_district_tasks', description: 'add nullable district to tasks', sql: "ALTER TABLE tasks ADD COLUMN district TEXT" },
    { id: '035_add_district_rescue', description: 'add nullable district to rescue_records', sql: "ALTER TABLE rescue_records ADD COLUMN district TEXT" },
    {
      id: '036_add_user_is_platform_admin',
      description: 'add is_platform_admin to users (platform admin separated from team leader role)',
      sql: 'ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0',
      // 一次性回填：把既有「队长」同时保权为平台管理员，避免迁移造成静默失权。
      // 这是**保权而非授权**；「收窄」（把不该有管理权的队长降级）另开工单，
      // 需业务/运营侧确认名单后再做。
      //
      // 挂在 `after` 上 ⇒ **仅在首次应用本迁移时回填**：若每次启动都回填，
      // 拆分后新晋的队长会在下次重启被静默提升为管理员，拆分将被自己抵消。
      // 全新库因列已在 canonical schema（ALTER 被跳过）而不会触发回填 —— 无历史数据，本就无需回填。
      after: backfillPlatformAdmins,
    },
    {
      id: '037_add_app_meta',
      description: 'create app_meta kv table (platform admin narrowing marker)',
      // 幂等建表：既有库补建 `app_meta`。canonical schema 已建同一张表，故全新库
      // 此迁移为 no-op，但仍会被记录进 `_migrations`（供「迁移是否已应用」观测）。
      sql: `CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )`,
    },
    {
      id: '038_add_user_phone',
      description: 'add phone to users (AED custodian SMS fallback, taken at send time)',
      // 幂等：canonical schema 已建同列 ⇒ 全新库此 ALTER 会因「duplicate column」被外层
      // catch 记为 skipped（与迁移 036 同机制）；既有库则真正补列。
      sql: "ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''",
    },
    {
      id: '039_add_sms_dispatches',
      description: 'create aed_sms_dispatches (AED SMS send流水 for voice fallback; no phone stored)',
      // 幂等建表 + 建索引：既有库补建；全新库 canonical 已建同一张表 ⇒ 本迁移为 no-op，仍记入 `_migrations`。
      // 表**只存 biz_id/alert_id/custodian_user_id**，不含任何手机号；无 CHECK 约束（沿用既有惯例）。
      sql: `CREATE TABLE IF NOT EXISTS aed_sms_dispatches (
        id TEXT PRIMARY KEY,
        biz_id TEXT NOT NULL,
        alert_id TEXT NOT NULL,
        custodian_user_id TEXT NOT NULL,
        report_status TEXT NOT NULL DEFAULT '',
        voice_state TEXT NOT NULL DEFAULT 'none',
        voice_at_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_sms_dispatches_biz ON aed_sms_dispatches(biz_id);`,
    },
    {
      id: '040_add_sos_events',
      description: 'create sos_events (SOS traceability for anti-abuse; NO location columns)',
      // 幂等建表 + 建索引：既有库补建；全新库 canonical 已建同一张表 ⇒ 本迁移为 no-op，仍记入 `_migrations`。
      // 与 canonical schema 中的定义**必须逐字一致**（两处都跑不冲突）。
      sql: `CREATE TABLE IF NOT EXISTS sos_events (
        id               TEXT PRIMARY KEY,
        client_event_id  TEXT NOT NULL,
        user_id          TEXT,
        is_drill         INTEGER NOT NULL DEFAULT 0,
        client_platform  TEXT NOT NULL DEFAULT '',
        created_at_ms    INTEGER NOT NULL,
        created_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sos_events_client ON sos_events(client_event_id);
      CREATE INDEX IF NOT EXISTS idx_sos_events_user ON sos_events(user_id, created_at_ms);
      CREATE INDEX IF NOT EXISTS idx_sos_events_real ON sos_events(is_drill, created_at_ms);`,
    },
    {
      id: '041_add_task_volunteers',
      description: 'create task_volunteers (task-side participation; UNIQUE(task_id,user_id))',
      // 幂等建表 + 建索引：既有库补建；全新库 canonical 已建同一张表 ⇒ 本迁移为 no-op，仍记入 `_migrations`。
      // 与 canonical schema 的 DDL **共用同一常量** ⇒ 两处逐字一致（设计 §4.4 硬约束 #9）。
      sql: DDL_TASK_VOLUNTEERS,
    },
    {
      id: '042_add_volunteer_service_logs',
      description: 'create volunteer_service_logs (service-hours ledger; ms timestamps; NO location)',
      sql: DDL_VOLUNTEER_SERVICE_LOGS,
    },
    {
      id: '043_add_service_certificates',
      description: 'create service_certificates (issued certificates; unique cert_no)',
      sql: DDL_SERVICE_CERTIFICATES,
    },
    {
      id: '044_add_task_arrival_void',
      description: 'add arrived_at_ms/voided_at_ms/void_reason to task_volunteers (v1.2: duration = arrived→left)',
      // ★ v1.2（§11.3）：时长区间改为「到达 → 离开」，`task_volunteers` 需扩列。
      // 幂等：canonical schema 已含这三列 ⇒ 全新库此 ALTER 会因「duplicate column」被外层
      // catch 记为 skipped（与迁移 038 同机制）；既有 v1.0 库则真正补列并记入 `_migrations`。
      sql: `ALTER TABLE task_volunteers ADD COLUMN arrived_at_ms INTEGER;
            ALTER TABLE task_volunteers ADD COLUMN voided_at_ms INTEGER;
            ALTER TABLE task_volunteers ADD COLUMN void_reason TEXT NOT NULL DEFAULT '';`,
    },
    {
      id: '045_add_service_cert_active_dedup',
      description: 'dedupe duplicate active service_certificates then add partial unique index idx_scert_active_dedup',
      // ★ v1.3：先去重再建唯一索引（顺序不可换，详见 `MIGRATION_045_SQL` 注释）。
      sql: MIGRATION_045_SQL,
    },
    {
      id: '046_add_task_rejoin_count',
      description: 'add rejoin_count to task_volunteers (v1.4: abandon→rejoin support, audit)',
      // ★ v1.4（§11.11-②）：支持「放弃后反悔、重新参与同一任务」，用 `rejoin_count` 记录反悔次数（审计）。
      // 纯**加列** ⇒ canonical 与迁移**两处都写**即可（与 T01 的 044 同做法）。
      // 幂等：canonical 已含该列 ⇒ 全新库此 ALTER 因「duplicate column」被外层 catch 记为 skipped；
      // 既有库则真正补列并记入 `_migrations`。（★ 与 T02 的索引不同：加列**无需**「先去重」。）
      sql: "ALTER TABLE task_volunteers ADD COLUMN rejoin_count INTEGER NOT NULL DEFAULT 0",
    },
    {
      id: '047_backfill_service_log_org_id',
      description: 'backfill org_id on existing volunteer_service_logs (D-7: deterministic single org)',
      // ★ D-7：机构聚合去重。旧台账行 `org_id` 为空 ⇒ 用与 `serviceLog.resolveUserOrgId` **同一规则**
      // （优先 admin/manager，否则最早加入）回填确定性机构，使存量时长也能被机构聚合计入且不翻倍。
      // ★ `COALESCE(..., '')` 必需：`org_id` 是 `NOT NULL`，无机构用户的子查询返回 NULL ⇒ 直接 `SET org_id = (SELECT ...)`
      // 会抛 `NOT NULL constraint failed`；COALESCE 让无机构行保持 ''（契合列 `DEFAULT ''`）。
      // ★ 本迁移**只做 UPDATE，不加 ADD COLUMN**：`volunteer_service_logs.org_id` 由 canonical DDL（db.ts:44）
      // 与迁移 042 共同保证已存在；任何被当前代码初始化的库（全新或已升 042）都有该列，无需补。
      // 迁移运行器把 `db.exec(m.sql)` 整体包在 try/catch，若在此混入 ALTER，列已存在时 ALTER 抛
      // "duplicate column" 会让整段（含 UPDATE）被 skip 且 `_migrations` 不写入 ⇒ 回填永久失效，故严禁混用。
      // 幂等：`WHERE org_id = ''` ⇒ 已回填的行不再变动；全新库本就无空 org_id 行 ⇒ 0 changes（仍记入 `_migrations`）。
      sql: `UPDATE volunteer_service_logs
            SET org_id = COALESCE((SELECT om.org_id FROM organization_members om
                         WHERE om.user_id = volunteer_service_logs.user_id
                         ORDER BY (om.role IN ('admin','manager')) DESC, om.joined_at ASC LIMIT 1), '')
            WHERE org_id = ''`,
    },
  ]

  const applied = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as Array<{ id: string }>).map(r => r.id)
  )

  for (const m of migrations) {
    if (applied.has(m.id)) continue
    try {
      db.exec(m.sql)
      db.prepare('INSERT INTO _migrations (id, description) VALUES (?, ?)').run(m.id, m.description || m.id)
      // 可选的迁移后处理（如数据回填）；仅在首次应用该迁移时执行一次。
      // 单独 try/catch：失败时必须报出**真实错误**，不能被外层的
      // "skipped (likely already applied)" 掩盖（那会让人误以为回填已跑过）。
      if (m.after) {
        try {
          m.after()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[DB] 迁移 ${m.id} 已应用，但迁移后处理失败（需人工处理，重启不会重试）: ${msg}`)
        }
      }
      if (!options.silent) console.log(`[DB] Migration applied: ${m.id}`)
    } catch (err) {
      if (!options.silent) console.warn(`[DB] Migration skipped (likely already applied): ${m.id}`)
    }
  }
}

// ---- Typed DB helpers ----
// Wraps db.prepare(...).get/all to eliminate `as any` casts.
// Usage: get<User>('SELECT * FROM users WHERE id = ?', id)

type BindParam = string | number | boolean | null | Buffer
type Row = Record<string, unknown>

export function get<T = Row>(sql: string, ...params: BindParam[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function all<T = Row>(sql: string, ...params: BindParam[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

// ---- 通用键值元数据读写（`app_meta`，迁移 037）----

/**
 * 读取元数据键；键不存在时返回 `null`（区别于「键存在但值为空串」）。
 *
 * @param key 键名（如 `platform_admin_narrowing_done`）
 */
export function getMeta(key: string): string | null {
  const row = get<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', key)
  return row ? row.value : null
}

/**
 * 写入元数据键（存在则覆盖），并刷新 `updated_at`。
 *
 * 采用 `INSERT ... ON CONFLICT(key) DO UPDATE` 实现 upsert：既处理首次写入，
 * 也在重复写入时原子更新，避免「先 SELECT 再分支」的竞态。
 *
 * @param key   键名
 * @param value 键值（字符串；布尔语义用 `'0'` / `'1'`）
 */
export function setMeta(key: string, value: string): void {
  db.prepare(
    `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, Date.now())
}

/** Clear all data (for testing) */
export function clearAll() {
  // Disable FK constraints so DELETE order doesn't matter
  db.pragma('foreign_keys = OFF')
  db.exec("DELETE FROM _migrations; DELETE FROM app_meta; DELETE FROM certificates; DELETE FROM organization_members; DELETE FROM organizations; DELETE FROM animal_health_records; DELETE FROM animal_care_records; DELETE FROM stray_animals; DELETE FROM wildlife_rescue_tasks; DELETE FROM wildlife_reports; DELETE FROM training_records; DELETE FROM drill_participants; DELETE FROM drill_events; DELETE FROM trail_event_participants; DELETE FROM trail_events; DELETE FROM user_trails; DELETE FROM mobilization_volunteers; DELETE FROM emergency_mobilizations; DELETE FROM external_certifications; DELETE FROM group_messages; DELETE FROM group_members; DELETE FROM volunteer_groups; DELETE FROM messages; DELETE FROM volunteer_locations; DELETE FROM public_inquiries; DELETE FROM notifications; DELETE FROM push_subscriptions; DELETE FROM aed_certifications; DELETE FROM aed_custodian_alerts; DELETE FROM aed_sms_dispatches; DELETE FROM aed_audit_log; DELETE FROM aed_pickups; DELETE FROM aed_maintenance; DELETE FROM aed_managers; DELETE FROM aed_checkins; DELETE FROM aed_devices; DELETE FROM users; DELETE FROM stats; DELETE FROM tasks; DELETE FROM news; DELETE FROM courses; DELETE FROM volunteers; DELETE FROM rescue_records; DELETE FROM rescue_cases; DELETE FROM video_comments; DELETE FROM atlas_cards; DELETE FROM gov_viewers; DELETE FROM sos_events; DELETE FROM volunteer_service_logs; DELETE FROM service_certificates; DELETE FROM task_volunteers;")
  db.pragma('foreign_keys = ON')
}

/**
 * 从零重建整个数据库 schema（用于测试隔离）。
 *
 * 先 DROP 掉 `sqlite_master` 中的全部业务表与 `_migrations`，再调用 initDb()
 * 依据唯一规范 schema 重建。之所以要连 `_migrations` 一起删除：initDb() 采用
 * `CREATE TABLE IF NOT EXISTS`，若保留 `_migrations`，已被记录的迁移会被跳过
 * （例如 `001_add_password`），导致重建后的 users 表缺少 `password` 列。
 * 只有清空 `_migrations` 才能让全部迁移重新执行，恢复出完整 schema。
 */
export function resetSchema() {
  db.pragma('foreign_keys = OFF')
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>
    for (const t of tables) {
      db.exec(`DROP TABLE IF EXISTS "${t.name}"`)
    }
  } finally {
    db.pragma('foreign_keys = ON')
  }
  initDb({ silent: true })
}

export default db
