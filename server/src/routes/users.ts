import { Router, Request, Response } from 'express';
import { getCurrentUser, changePassword } from '../auth';
import { userRepository } from '../repositories/userRepository';
import { sessionRepository } from '../repositories/sessionRepository';
import { auditService } from '../services/auditService';
import { AuditEventType } from '../types';

const router = Router();

// GET /api/users/
router.get('/', async (req: Request, res: Response) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  try {
    const user = await getCurrentUser(token);
    if (!user) {
      res.status(401).json({ success: false, error: '无效的会话' });
      return;
    }

    if (user.role !== 'system_admin') {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }

    const users = await userRepository.getAll();
    // 隐藏敏感信息
    const sanitizedUsers = users.map(u => {
      const { password_hash, ...uWithoutHash } = u;
      return uWithoutHash;
    });

    res.json({ success: true, data: sanitizedUsers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '获取用户列表失败' });
  }
});

// GET /api/users/me
router.get('/me', async (req: Request, res: Response) => {
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

// PUT /api/users/me
router.put('/me', async (req: Request, res: Response) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  
  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  try {
    const user = await getCurrentUser(token);
    if (!user) {
      res.status(401).json({ success: false, error: '无效的会话' });
      return;
    }

    const { avatar, password } = req.body;
    const { userRepository } = await import('../repositories/userRepository');
    await userRepository.updateProfile(user.id, { avatar, password });
    await auditService.log(user.id, user.username, AuditEventType.USER_MGMT, 'Update Profile', '成功');
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '更新个人资料失败' });
  }
});

// POST /api/users/change-password
router.post('/change-password', async (req: Request, res: Response) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  
  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  
  try {
    const { sessionRepository } = await import('../repositories/sessionRepository');
    const session = await sessionRepository.findByToken(token);
    if (!session) {
      res.status(401).json({ success: false, error: '无效的会话' });
      return;
    }

    const { userRepository } = await import('../repositories/userRepository');
    const user = await userRepository.findById(session.user_id);
    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    await changePassword(user.id, currentPassword, newPassword);
    await auditService.log(user.id, user.username, AuditEventType.USER_MGMT, 'Change Password', '成功');
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'INVALID_CURRENT_PASSWORD') {
      res.status(400).json({ success: false, error: '当前密码错误' });
    } else if (err.message === 'PASSWORD_TOO_SHORT') {
      res.status(400).json({ success: false, error: '新密码长度不能少于6位' });
    } else {
      res.status(500).json({ success: false, error: '修改密码过程中出错' });
    }
  }
});

// POST /api/users/ (system_admin only)
router.post('/', async (req: Request, res: Response) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  try {
    const user = await getCurrentUser(token);
    if (!user || user.role !== 'system_admin') {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }

    const { username, password, role } = req.body as { username?: string; password?: string; role?: string };

    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: '密码长度不能少于6位' });
      return;
    }

    if (role !== 'system_admin' && role !== 'ops_admin') {
      res.status(400).json({ success: false, error: '无效的角色' });
      return;
    }

    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) {
      res.status(400).json({ success: false, error: '用户名已存在' });
      return;
    }

    await userRepository.create(username, password, role);
    await auditService.log(user.id, user.username, AuditEventType.USER_MGMT, username, '成功');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '创建用户失败' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req: Request, res: Response) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  try {
    const user = await getCurrentUser(token);
    if (!user || user.role !== 'system_admin') {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }

    const { role, is_frozen } = req.body;
    const allUsers = await userRepository.getAll();

    if (role !== undefined && role !== 'system_admin' && role !== 'ops_admin') {
      res.status(400).json({ success: false, error: '无效的角色' });
      return;
    }

    const targetUser = allUsers.find(u => u.id === req.params.id);
    if (!targetUser) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const systemAdmins = allUsers.filter(u => u.role === 'system_admin');
    const activeUsers = allUsers.filter(u => !u.is_frozen);

    if (role === 'ops_admin' && systemAdmins.length <= 1 && targetUser.role === 'system_admin') {
      res.status(400).json({ success: false, error: '至少保留一个系统管理员' });
      return;
    }

    if (is_frozen === true && activeUsers.length <= 1 && !targetUser.is_frozen) {
      res.status(400).json({ success: false, error: '至少保留一个活跃用户' });
      return;
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (is_frozen !== undefined) updateData.is_frozen = Boolean(is_frozen);

    await userRepository.update(req.params.id, updateData);
    await auditService.log(user.id, user.username, AuditEventType.USER_MGMT, targetUser?.username || req.params.id, '成功');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '更新用户失败' });
  }
});

router.post('/:id/reset-otp', async (req: Request, res: Response) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

  if (!token) {
    res.status(401).json({ success: false, error: '未登录' });
    return;
  }

  try {
    const currentUser = await getCurrentUser(token);
    if (!currentUser || currentUser.role !== 'system_admin') {
      res.status(403).json({ success: false, error: '权限不足，只有系统管理员可以重置OTP' });
      return;
    }

    const targetUserId = req.params.id;
    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ success: false, error: '目标用户不存在' });
      return;
    }

    await userRepository.update(targetUserId, { otp_secret: null });
    await sessionRepository.deleteByUserId(targetUserId);
    await auditService.log(currentUser.id, currentUser.username, AuditEventType.USER_MGMT, targetUser.username, '成功');

    console.log(`[OTP Reset] Admin ${currentUser.id} reset OTP for user ${targetUserId} at ${new Date().toISOString()}`);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || '重置OTP失败' });
  }
});

export default router;
