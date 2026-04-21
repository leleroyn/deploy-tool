import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { userRepository } from './repositories/userRepository';
import { sessionRepository, Session } from './repositories/sessionRepository';
import bcrypt from 'bcryptjs';

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function login(username: string, password: string): Promise<string | null> {
  const user = await userRepository.findByUsername(username);
  if (!user) return null;
  if (user.is_frozen) throw new Error('ACCOUNT_FROZEN');
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (isMatch) {
    const token = generateToken();
    await sessionRepository.create(user.id, token);
    return token;
  }
  return null;
}

export async function logout(token: string): Promise<void> {
  await sessionRepository.deleteByToken(token);
}

export async function verifyToken(token: string): Promise<boolean> {
  if (!token) return false;
  const session = await sessionRepository.findByToken(token);
  return !!session;
}

export async function verifyTokenWithSession(token: string): Promise<Session | null> {
  if (!token) return null;
  return await sessionRepository.findByToken(token);
}

export async function getCurrentUser(token: string) {
  const session = await sessionRepository.findByToken(token);
  if (!session) return null;
  return await userRepository.findById(session.user_id);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) throw new Error('INVALID_CURRENT_PASSWORD');
  if (newPassword.length < 6) throw new Error('PASSWORD_TOO_SHORT');
  const newPasswordHash = bcrypt.hashSync(newPassword, 10);
  await userRepository.update(user.id, { password_hash: newPasswordHash });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  try {
    const session = await verifyTokenWithSession(token);
    if (!session) {
      res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
      return;
    }
    const user = await userRepository.findById(session.user_id);
    if (!user) {
      res.status(401).json({ success: false, error: '用户不存在' });
      return;
    }
    if (user.is_frozen) {
      res.status(403).json({ success: false, error: '账号已被冻结' });
      return;
    }
    (req as any).user = user;
    (req as any).session = session;
    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: '认证过程中出错' });
  }
}

export async function requireSystemAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = (req as any).user;
  if (!user || user.role !== 'system_admin') {
    res.status(403).json({ success: false, error: '权限不足，需要系统管理员权限' });
    return;
  }
  next();
}