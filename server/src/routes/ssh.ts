import { Router, Request, Response } from 'express';
import { getSSHConfig, updateSSHConfig } from '../config/iniManager';
import { requireSystemAdmin } from '../auth';
import { auditService } from '../services/auditService';
import { AuditEventType } from '../types';

const router = Router();

// GET /api/ssh-config
router.get('/', requireSystemAdmin, (_req: Request, res: Response) => {
  try {
    const config = getSSHConfig();
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ssh-config
router.put('/', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    updateSSHConfig(req.body);
    await auditService.log(user.id, user.username, AuditEventType.SYS_SETTINGS, 'SSH Configuration', '成功', req.ip);
    const config = getSSHConfig();
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
