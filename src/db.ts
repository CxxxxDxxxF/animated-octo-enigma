import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/pmxt.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tracked_profiles (
    profile_key TEXT PRIMARY KEY,
    username TEXT,
    profile_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_enabled INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS profile_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_key TEXT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    equity REAL,
    realized_pnl REAL,
    unrealized_pnl REAL,
    open_positions INTEGER,
    volume REAL,
    FOREIGN KEY (profile_key) REFERENCES tracked_profiles(profile_key)
  );

  CREATE TABLE IF NOT EXISTS tracked_social_profiles (
    profile_id TEXT PRIMARY KEY,
    username TEXT,
    track_enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profile_social_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id TEXT,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    rank INTEGER,
    volume REAL,
    predictions INTEGER,
    profit_rank INTEGER,
    total_profit REAL,
    FOREIGN KEY (profile_id) REFERENCES tracked_social_profiles(profile_id)
  );

  CREATE TABLE IF NOT EXISTS whale_positions (
    profile_id TEXT,
    market_id TEXT,
    side TEXT,
    size REAL,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES tracked_social_profiles(profile_id)
  );
`);

export default db;
