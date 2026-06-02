import { Router, Request, Response } from 'express';
import { getCommands, getCommand, RemoteCommand } from '../config/iniManager';
import { createTask, isProjectBusy } from '../tasks/taskQueue';
import { auditRepository } from '../repositories/auditRepository';
import { AuditEventType } from '../types';

const router = Router();

function checkCommandAccess(user: { role: string }, cmd: RemoteCommand): boolean {
  return cmd.allowedRoles.includes(user.role);
}

router.get('/', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const commands = getCommands();
    const grouped: Record<string, { name: string; server: string[]; command: string; group: string; allowedRoles: string[] }[]> = {};

    commands.forEach(cmd => {
      const group = cmd.group || '未分组';
      if (!grouped[group]) {
        grouped[group] = [];
      }

      const isAdmin = user?.role === 'system_admin';
      grouped[group].push({
        name: cmd.name,
        server: cmd.server,
        command: isAdmin ? cmd.command : '',
        group: cmd.group,
        allowedRoles: cmd.allowedRoles,
      });
    });

    res.json({ success: true, data: grouped });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/history', async (_req: Request, res: Response) => {
  try {
    const logs = await auditRepository.find({
      eventType: AuditEventType.REMOTE_CMD,
      limit: 100,
      offset: 0,
    });

    const grouped: Record<string, typeof logs> = {};
    for (const log of logs) {
      if (!grouped[log.target]) grouped[log.target] = [];
      if (grouped[log.target].length < 3) {
        grouped[log.target].push(log);
      }
    }

    const history = Object.values(grouped).flat().map((log) => ({
      commandName: log.target,
      server: '',
      status: log.result === '成功' ? 'success' : 'error',
      time: log.timestamp,
    }));

    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:name/exec', async (req: Request, res: Response) => {
  const { name } = req.params;
  
  try {
    const user = (req as any).user;
    const cmd = getCommand(name);
    if (!cmd) {
      return res.status(404).json({ success: false, error: '命令不存在' });
    }
    
    if (!checkCommandAccess(user, cmd)) {
      return res.status(403).json({ success: false, error: '权限不足，无法执行此命令' });
    }
    
    if (!cmd.server || cmd.server.length === 0) {
      return res.status(400).json({ success: false, error: '命令缺少 server 配置' });
    }
    
    if (!cmd.command) {
      return res.status(400).json({ success: false, error: '命令缺少 command 配置' });
    }
    
    if (isProjectBusy(name)) {
      return res.status(409).json({ success: false, error: '该命令正在执行中，请稍后再试' });
    }
    
    const task = createTask('remote', name, user.id, user.username);
    res.json({ success: true, data: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
