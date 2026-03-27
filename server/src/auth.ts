import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

// 内存中存储有效 token（重启后失效）
const validTokens = new Set<string>();

/** 生成新 token */
export function generateToken(): string {
  const token = randomBytes(32).toString('hex');
  validTokens.add(token);
  return token;
}

/** 校验密码，返回 token 或 null */
export function login(password: string): string | null {
  const expected = process.env.DEPLOY_PASSWORD || 'admin123';
  if (password === expected) {
    return generateToken();
  }
  return null;
}

/** 退出：删除 token */
export function logout(token: string): void {
  validTokens.delete(token);
}

/** 直接校验 token 字符串，返回是否有效 */
export function verifyToken(token: string): boolean {
  return token.length > 0 && validTokens.has(token);
}

/** Express 中间件：校验 token */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!verifyToken(token)) {
    res.status(401).json({ success: false, error: '未登录或登录已过期' });
    return;
  }
  next();
}

