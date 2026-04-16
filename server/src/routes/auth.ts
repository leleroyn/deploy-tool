import { Router } from 'express';
import { login, logout, getCurrentUser, changePassword } from '../auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入用户名和密码' });
    return;
  }
  try {
    const token = await login(username, password);
    if (!token) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }
    res.json({ success: true, data: { token } });
  } catch (err: any) {
    if (err.message === 'ACCOUNT_FROZEN') {
      res.status(403).json({ success: false, error: '账号已被冻结' });
    } else {
      res.status(500).json({ success: false, error: '登录过程中出错' });
    }
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) await logout(token);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }
  const user = await getCurrentUser(token);
  if (!user) {
    res.status(401).json({ success: false, error: '无效的会话' });
    return;
  }
  const { password_hash, ...userWithoutHash } = user;
  res.json({ success: true, data: userWithoutHash });
});

export default router;


