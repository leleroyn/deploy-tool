import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  is_frozen: boolean;
  avatar?: string;
  created_at: string;
}

export class UserRepository {
  async findByUsername(username: string): Promise<User | undefined> {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
    if (user) {
      user.is_frozen = Boolean(user.is_frozen);
    }
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    if (user) {
      user.is_frozen = Boolean(user.is_frozen);
    }
    return user;
  }

  async create(username: string, passwordPlain: string, role: string): Promise<User> {
    const id = uuidv4();
    const password_hash = bcrypt.hashSync(passwordPlain, 10);
    const stmt = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, is_frozen)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, username, password_hash, role, 0);
    return this.findById(id)!;
  }

  async update(id: string, data: Partial<Omit<User, 'id' | 'username' | 'created_at'>>): Promise<void> {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    const setClause = keys.map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];

    db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values);
  }

  async updateProfile(id: string, { avatar, password }: { avatar?: string; password?: string }): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new Error('USER_NOT_FOUND');

    const updateData: any = {};
    if (avatar !== undefined) updateData.avatar = avatar;
    if (password) {
      updateData.password_hash = bcrypt.hashSync(password, 10);
    }

    if (Object.keys(updateData).length > 0) {
      await this.update(id, updateData);
    }
  }

  async delete(id: string): Promise<void> {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  async getAll(): Promise<User[]> {
    return db.prepare('SELECT id, username, role, is_frozen, avatar, created_at FROM users').all() as User[];
  }
}

export const userRepository = new UserRepository();
