import { Router, Request, Response } from 'express';
import { auditService } from '../services/auditService';
import { auditRepository, AuditFilter } from '../repositories/auditRepository';

const router = Router();

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const {
      username,
      eventType,
      target,
      result,
      operatorIp,
      startTime,
      endTime,
      page,
      limit
    } = req.query as any;

    const filter: AuditFilter = {
      username: username as string,
      eventType: eventType as string,
      target: target as string,
      result: result as string,
      operatorIp: operatorIp as string,
      startTime: startTime as string,
      endTime: endTime as string,
      limit: limit ? parseInt(limit) : 20,
      offset: page ? (parseInt(page) - 1) * (limit ? parseInt(limit) : 20) : 0
    };

    const logs = await auditService.getLogs(filter);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取审计日志出错' });
  }
});

export default router;
