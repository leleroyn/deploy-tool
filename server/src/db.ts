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

  // Add avatar column if not exists (for existing databases)
  try {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT");
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

