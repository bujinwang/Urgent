import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH || './data/jiujiaxia.db'

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

export function initDb() {
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
      is_public INTEGER NOT NULL DEFAULT 0
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
      created_at TEXT NOT NULL
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
      linked_user_id TEXT NOT NULL DEFAULT ''
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
      category TEXT NOT NULL DEFAULT 'rescue',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      result TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS rescue_cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT '',
      volunteers TEXT NOT NULL DEFAULT '[]',
      body TEXT
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
  `)

  // Safe migration: add password column
  try { db.exec("ALTER TABLE users ADD COLUMN password TEXT NOT NULL DEFAULT ''") } catch (_) {}

  // Safe migration: add coach columns (ignore if already exist)
  const coachMigrations = [
    "ALTER TABLE volunteers ADD COLUMN role TEXT NOT NULL DEFAULT 'volunteer'",
    "ALTER TABLE volunteers ADD COLUMN coach_specialties TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE volunteers ADD COLUMN coach_certifications TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE volunteers ADD COLUMN coach_bio TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE volunteers ADD COLUMN coach_available INTEGER NOT NULL DEFAULT 1",
  ]
  for (const sql of coachMigrations) {
    try { db.exec(sql) } catch (_) { /* column already exists, skip */ }
  }

  // Safe migration: add aed_devices rich columns
  const aedMigrations = [
    "ALTER TABLE aed_devices ADD COLUMN model TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN serial_number TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN battery_expiry TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN electrode_expiry TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN last_maintenance TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN indoor INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE aed_devices ADD COLUMN floor TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN open_hours TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN finding_instructions TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN custodian_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN custodian_phone TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN custodian_role TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN reported_by TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN reported_at TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE aed_devices ADD COLUMN is_mobile INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE aed_devices ADD COLUMN linked_user_id TEXT NOT NULL DEFAULT ''",
  ]
  for (const sql of aedMigrations) {
    try { db.exec(sql) } catch (_) { /* column already exists, skip */ }
  }

  // Safe migration: add public_id to users
  try { db.exec("ALTER TABLE users ADD COLUMN public_id TEXT NOT NULL DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN is_leader INTEGER NOT NULL DEFAULT 0") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN affiliation TEXT NOT NULL DEFAULT ''") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN volunteer_type TEXT NOT NULL DEFAULT 'medical'") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN is_organizer INTEGER NOT NULL DEFAULT 0") } catch (_) {}
  try { db.exec("ALTER TABLE users ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0") } catch (_) {}
}

/** Clear all data (for testing) */
export function clearAll() {
  db.exec("DELETE FROM certificates; DELETE FROM organization_members; DELETE FROM organizations; DELETE FROM animal_health_records; DELETE FROM animal_care_records; DELETE FROM stray_animals; DELETE FROM wildlife_rescue_tasks; DELETE FROM wildlife_reports; DELETE FROM training_records; DELETE FROM drill_participants; DELETE FROM drill_events; DELETE FROM trail_event_participants; DELETE FROM trail_events; DELETE FROM user_trails; DELETE FROM mobilization_volunteers; DELETE FROM emergency_mobilizations; DELETE FROM external_certifications; DELETE FROM group_messages; DELETE FROM group_members; DELETE FROM volunteer_groups; DELETE FROM messages; DELETE FROM volunteer_locations; DELETE FROM public_inquiries; DELETE FROM notifications; DELETE FROM aed_certifications; DELETE FROM aed_audit_log; DELETE FROM aed_pickups; DELETE FROM aed_maintenance; DELETE FROM aed_managers; DELETE FROM aed_checkins; DELETE FROM aed_devices; DELETE FROM users; DELETE FROM stats; DELETE FROM tasks; DELETE FROM news; DELETE FROM courses; DELETE FROM volunteers; DELETE FROM rescue_records; DELETE FROM rescue_cases; DELETE FROM atlas_cards;")
}

export default db
