import { Router, Request, Response } from 'express';
import { getCommands, getCommand, getCommandHistory } from '../config/iniManager';
import { createTask, isProjectBusy } from '../tasks/taskQueue';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const commands = getCommands();
    const grouped: Record<string, typeof commands> = {};
    
    commands.forEach(cmd => {
      const group = cmd.group || '未分组';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(cmd);
    });
    
    res.json({ success: true, data: grouped });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/history', (_req: Request, res: Response) => {
  try {
    const history = getCommandHistory(3);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:name/exec', (req: Request, res: Response) => {
  const { name } = req.params;
  
  try {
    const cmd = getCommand(name);
    if (!cmd) {
      return res.status(404).json({ success: false, error: '命令不存在' });
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

    const task = createTask('remote', name);
    res.json({ success: true, data: task });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
