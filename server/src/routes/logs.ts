import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { getLogDir } from '../config/iniManager';
import { requireSystemAdmin } from '../auth';

const router = Router();

const LOG_FILES: Record<string, string> = {
  deploy: 'deploy.log',
  backup: 'backup_pj.log',
  ports: 'check_ports.log',
  remote: 'exec_remote_script.log',
};

const LOG_ORDER = ['backup', 'deploy', 'ports', 'remote'];

function getArchiveDir(type: string): string {
  return path.join(getLogDir(), 'archives', type);
}

function archiveLog(type: string): void {
  const filename = LOG_FILES[type];
  if (!filename) return;
  const logDir = getLogDir();
  const filePath = path.join(logDir, filename);
  if (!fs.existsSync(filePath)) return;

  const stat = fs.statSync(filePath);
  if (stat.size === 0) return;

  const archiveDir = getArchiveDir(type);
  fs.mkdirSync(archiveDir, { recursive: true });

  const now = new Date();
  const timestamp = now.getFullYear()
    + `${String(now.getMonth() + 1).padStart(2, '0')}`
    + `${String(now.getDate()).padStart(2, '0')}`
    + '_'
    + `${String(now.getHours()).padStart(2, '0')}`
    + `${String(now.getMinutes()).padStart(2, '0')}`
    + `${String(now.getSeconds()).padStart(2, '0')}`
    + `${String(now.getMilliseconds()).padStart(3, '0')}`;

  const nameWithoutExt = filename.replace(/\.log$/, '');
  const archiveName = `${nameWithoutExt}.${timestamp}.log`;
  const archivePath = path.join(archiveDir, archiveName);

  fs.copyFileSync(filePath, archivePath);
  fs.writeFileSync(filePath, '');
}

function getArchiveCount(type: string): number {
  const archiveDir = getArchiveDir(type);
  if (!fs.existsSync(archiveDir)) return 0;
  return fs.readdirSync(archiveDir).filter(f => f.endsWith('.log')).length;
}

function getArchiveList(type: string): Array<{ filename: string; size: number; createdAt: string }> {
  const archiveDir = getArchiveDir(type);
  if (!fs.existsSync(archiveDir)) return [];
  const files = fs.readdirSync(archiveDir).filter(f => f.endsWith('.log'));
  return files
    .map(f => {
      const filePath = path.join(archiveDir, f);
      const stat = fs.statSync(filePath);
      return { filename: f, size: stat.size, createdAt: stat.birthtime.toISOString() };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// GET /api/logs/files - 返回所有日志文件的元数据
router.get('/files', (_req: Request, res: Response) => {
  const logDir = getLogDir();
  const result = LOG_ORDER.map(key => {
    const filename = LOG_FILES[key];
    const filePath = path.join(logDir, filename);
    let size = 0;
    let lastModified: string | null = null;
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      size = stat.size;
      lastModified = stat.mtime.toISOString();
    }
    return { key, filename, size, lastModified, archiveCount: getArchiveCount(key) };
  });
  res.json({ success: true, data: result });
});

// GET /api/logs/:type/archives - 返回归档文件列表
// NOTE: 必须在 /:type 之前定义，否则 Express 会先匹配 /:type
router.get('/:type/archives', (req: Request, res: Response) => {
  const filename = LOG_FILES[req.params.type];
  if (!filename) {
    return res.status(404).json({ success: false, error: '日志类型不存在' });
  }
  const archives = getArchiveList(req.params.type);
  res.json({ success: true, data: archives });
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

// DELETE /api/logs/:type - 归档日志（保存历史内容后清空）
router.delete('/:type', requireSystemAdmin, (req: Request, res: Response) => {
  const filename = LOG_FILES[req.params.type];
  if (!filename) {
    return res.status(404).json({ success: false, error: '日志类型不存在' });
  }
  archiveLog(req.params.type);
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
