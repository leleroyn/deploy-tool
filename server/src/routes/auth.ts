import { Router, Request, Response } from 'express';
import { login, logout, getCurrentUser } from '../auth';
import { userRepository } from '../repositories/userRepository';
import { sessionRepository } from '../repositories/sessionRepository';
import { generateOtpSecret, generateQrCode, verifyOtp, encryptSecret } from '../otp';
import { createTempToken, getTempTokenData, updateTempToken } from '../tempToken';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入用户名和密码' });
    return;
  }
  try {
    const user = await userRepository.findByUsername(username);
    if (!user) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }
    if (user.is_frozen) {
      res.status(403).json({ success: false, error: '账号已被冻结' });
      return;
    }

    const bcrypt = await import('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    if (user.role === 'ops_admin') {
      if (user.otp_secret) {
        const tempToken = createTempToken(user.id, user.username, user.role);
        res.json({ success: true, data: { requireOtpVerify: true, tempToken } });
      } else {
        const tempToken = createTempToken(user.id, user.username, user.role);
        res.json({ success: true, data: { requireOtpSetup: true, tempToken } });
      }
    } else {
      const { generateToken } = await import('../auth');
      const token = generateToken();
      await sessionRepository.create(user.id, token);
      res.json({ success: true, data: { token } });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: '登录过程中出错' });
  }
});

router.post('/otp/setup', async (req: Request, res: Response) => {
  const { tempToken } = req.body as { tempToken?: string };
  if (!tempToken) {
    res.status(400).json({ success: false, error: '缺少临时令牌' });
    return;
  }

  const tokenData = getTempTokenData(tempToken);
  if (!tokenData) {
    res.status(401).json({ success: false, error: '临时令牌无效或已过期' });
    return;
  }

  if (tokenData.role !== 'ops_admin') {
    res.status(403).json({ success: false, error: '只有运维管理员需要绑定OTP' });
    return;
  }

  try {
    const secret = generateOtpSecret();
    const qrCode = await generateQrCode(secret, tokenData.username);
    const encryptedSecret = encryptSecret(secret);

    updateTempToken(tempToken, { pendingOtpSecret: encryptedSecret });

    res.json({ success: true, data: { qrCode } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '生成OTP设置失败' });
  }
});

router.post('/otp/verify', async (req: Request, res: Response) => {
  const { tempToken, code } = req.body as { tempToken?: string; code?: string };
  if (!tempToken || !code) {
    res.status(400).json({ success: false, error: '缺少临时令牌或验证码' });
    return;
  }

  const tokenData = getTempTokenData(tempToken);
  if (!tokenData) {
    res.status(401).json({ success: false, error: '临时令牌无效或已过期' });
    return;
  }

  try {
    if (tokenData.pendingOtpSecret) {
      const isValid = verifyOtp(tokenData.pendingOtpSecret, code);
      if (!isValid) {
        res.status(401).json({ success: false, error: '验证码错误' });
        return;
      }

      await userRepository.update(tokenData.userId, { otp_secret: tokenData.pendingOtpSecret });

      const { generateToken } = await import('../auth');
      const token = generateToken();
      await sessionRepository.create(tokenData.userId, token);
      res.json({ success: true, data: { token } });
    } else {
      res.status(400).json({ success: false, error: '请先获取二维码' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: '验证失败' });
  }
});

router.post('/otp/verify-login', async (req: Request, res: Response) => {
  const { tempToken, code } = req.body as { tempToken?: string; code?: string };
  if (!tempToken || !code) {
    res.status(400).json({ success: false, error: '缺少临时令牌或验证码' });
    return;
  }

  const tokenData = getTempTokenData(tempToken);
  if (!tokenData) {
    res.status(401).json({ success: false, error: '临时令牌无效或已过期' });
    return;
  }

  try {
    const user = await userRepository.findById(tokenData.userId);
    if (!user || !user.otp_secret) {
      res.status(400).json({ success: false, error: '用户未设置OTP' });
      return;
    }

    const isValid = verifyOtp(user.otp_secret, code);
    if (!isValid) {
      res.status(401).json({ success: false, error: '验证码错误' });
      return;
    }

    const { generateToken } = await import('../auth');
    const token = generateToken();
    await sessionRepository.create(user.id, token);
    res.json({ success: true, data: { token } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '验证失败' });
  }
});

router.post('/logout', async (req: Request, res: Response) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token) await logout(token);
  res.json({ success: true });
});

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
  const { password_hash, otp_secret, ...userWithoutHash } = user as any;
  const hasOtp = !!otp_secret;
  res.json({ success: true, data: { ...userWithoutHash, hasOtp } });
});

export default router;
