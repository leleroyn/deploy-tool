import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string | null;
  created_at: string;
}

export class SessionRepository {
  async create(userId: string, token: string): Promise<Session> {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO sessions (id, user_id, token)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, userId, token);
    return this.findById(id)!;
  }

  async findByToken(token: string): Promise<Session | undefined> {
    const session = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as Session | undefined;
    return session;
  }

  async findById(id: string): Promise<Session | undefined> {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Session | undefined;
    return session;
  }

  async deleteByToken(token: string): Promise<void> {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  async deleteByUserId(userId: string): Promise<void> {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
}

export const sessionRepository = new SessionRepository();
