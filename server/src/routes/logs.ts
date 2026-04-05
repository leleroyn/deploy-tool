import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getLogDir } from '../config/iniManager';

const router = Router();

const LOG_FILES: Record<string, string> = {
  deploy: 'deploy.log',
  backup: 'backup_pj.log',
  ports: 'check_ports.log',
  remote: 'exec_remote_script.log',
};

// GET /api/logs/files - 返回所有日志文件的元数据
router.get('/files', (_req: Request, res: Response) => {
  const logDir = getLogDir();
  const result = Object.entries(LOG_FILES).map(([key, filename]) => {
    const filePath = path.join(logDir, filename);
    let size = 0;
    let lastModified: string | null = null;
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      size = stat.size;
      lastModified = stat.mtime.toISOString();
    }
    return { key, filename, size, lastModified };
  });
  res.json({ success: true, data: result });
});

// GET /api/logs/:type - 读取日志内容
router.get('/:type', (req: Request, res: Response) => {
  const filename = LOG_FILES[req.params.type];
  if (!filename) {
    return res.status(404).json({ success: false, error: '日志类型不存在' });
  }
  const filePath = path.join(getLogDir(), filename);
  if (!fs.existsSync(filePath)) {
    return res.json({ success: true, data: '' });
  }
  // 只读取最后 100KB
  const content = readTail(filePath, 100 * 1024);
  res.json({ success: true, data: content });
});

// DELETE /api/logs/:type - 清空日志
router.delete('/:type', (req: Request, res: Response) => {
  const filename = LOG_FILES[req.params.type];
  if (!filename) {
    return res.status(404).json({ success: false, error: '日志类型不存在' });
  }
  const filePath = path.join(getLogDir(), filename);
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '');
  }
  res.json({ success: true });
});

function readTail(filePath: string, maxBytes: number): string {
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  const size = Math.min(stat.size, maxBytes);
  const buffer = Buffer.alloc(size);
  fs.readSync(fd, buffer, 0, size, Math.max(0, stat.size - maxBytes));
  fs.closeSync(fd);
  return buffer.toString('utf-8');
}

export default router;
