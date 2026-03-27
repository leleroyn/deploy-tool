import { Router } from 'express';
import { login, logout } from '../auth';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) {
    res.status(400).json({ success: false, error: '请输入密码' });
    return;
  }
  const token = login(password);
  if (!token) {
    res.status(401).json({ success: false, error: '密码错误' });
    return;
  }
  res.json({ success: true, data: { token } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) logout(token);
  res.json({ success: true });
});

export default router;
