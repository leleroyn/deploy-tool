import { Router, Request, Response } from 'express';
import { getSSHConfig, updateSSHConfig } from '../config/iniManager';
import { requireSystemAdmin } from '../auth';

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
router.put('/', requireSystemAdmin, (req: Request, res: Response) => {
  try {
    updateSSHConfig(req.body);
    const config = getSSHConfig();
    res.json({ success: true, data: config });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
