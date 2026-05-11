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
      rescue_count INTEGER NOT NULL DEFAULT 0
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
      battery_level INTEGER NOT NULL DEFAULT 100
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
      rank_pos INTEGER NOT NULL DEFAULT 0
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
  `)
}

/** Clear all data (for testing) */
export function clearAll() {
  db.exec("DELETE FROM users; DELETE FROM stats; DELETE FROM tasks; DELETE FROM aed_devices; DELETE FROM news; DELETE FROM courses; DELETE FROM volunteers; DELETE FROM rescue_records; DELETE FROM rescue_cases; DELETE FROM atlas_cards;")
}

export default db
