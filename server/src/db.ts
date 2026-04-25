import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(process.cwd(), 'database.sqlite');

const db = new Database(DB_PATH);

export function initDb() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      is_frozen INTEGER DEFAULT 0,
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      target TEXT NOT NULL,
      result TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operator_name);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs(event_type);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);`);

  // Create tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      project TEXT NOT NULL,
      status TEXT NOT NULL,
      dry_run INTEGER DEFAULT 0,
      start_time DATETIME,
      end_time DATETIME,
      exit_code INTEGER,
      operator_id TEXT NOT NULL,
      operator_name TEXT NOT NULL,
      operator_ip TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);`);

  // Add avatar column if not exists (for existing databases)
  try {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
  } catch {
    // Column may already exist, ignore error
  }

  // Add otp_secret column if not exists (for existing databases)
  try {
    db.exec("ALTER TABLE users ADD COLUMN otp_secret TEXT");
  } catch {
    // Column may already exist, ignore error
  }

  // Add operator_ip column if not exists (for existing databases)
  try {
    db.exec('ALTER TABLE audit_logs ADD COLUMN operator_ip TEXT DEFAULT ""');
  } catch {
    // Column may already exist, ignore error
  }

  // Create sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Initialize admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const adminId = uuidv4();
    const password = process.env.DEPLOY_PASSWORD || 'admin123';
    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, is_frozen)
      VALUES (?, ?, ?, ?, ?)
    `).run(adminId, 'admin', passwordHash, 'system_admin', 0);
    console.log('[DB] Default admin user initialized.');
  }
}

export { db };

