import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import multer from 'multer';
import { getProject, getScriptDir } from '../config/iniManager';

const router = Router();

// ── 工具函数 ──────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface ServerBackupRecord {
  server: string;
  success: boolean;
  time: string | null;    // 最后一条记录的时间戳
  backupFile: string | null;
}

export interface BackupCheckResult {
  backed: boolean;           // 所有配置服务器都备份成功才为 true
  detail: string;            // 总体说明
  servers: ServerBackupRecord[];
}

/**
 * 从备份日志里检测今天每台服务器的备份情况。
 * 日志格式：[2026-03-27 13:40:28] [INFO] 项目 xxx 备份成功，服务器 1.2.3.4，备份文件：...
 */
function checkBackupToday(projectName: string, configuredServers: string[]): BackupCheckResult {
  const logPath = path.join(getScriptDir(), 'backup_pj.log');
  if (!fs.existsSync(logPath)) {
    return {
      backed: false,
      detail: '备份日志文件不存在，请先执行一次备份',
      servers: configuredServers.map(s => ({ server: s, success: false, time: null, backupFile: null })),
    };
  }

  const content = fs.readFileSync(logPath, 'utf-8');
  const today = todayStr();
  const lines = content.split(/\r?\n/);

  // 只取今天的、属于本项目的日志行
  const projectTodayLines = lines.filter(
    l => l.includes(today) && l.toLowerCase().includes(projectName.toLowerCase())
  );

  // 解析每行，提取服务器 IP、成功/失败、时间、备份文件
  // 格式：[2026-03-27 13:40:28] [INFO/ERROR] 项目 xxx 备份成功/失败，服务器 1.2.3.4，...
  const timeRe = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/;
  const serverRe = /服务器\s+([\d.]+)/;
  const backupFileRe = /备份文件：(\S+?)(?:，|$)/;

  // 按服务器分组，取每台服务器今天的最新成功记录
  const serverMap: Record<string, ServerBackupRecord> = {};

  // 先用配置的服务器初始化
  for (const s of configuredServers) {
    serverMap[s] = { server: s, success: false, time: null, backupFile: null };
  }

  for (const line of projectTodayLines) {
    const serverMatch = line.match(serverRe);
    if (!serverMatch) continue;
    const server = serverMatch[1];

    const timeMatch = line.match(timeRe);
    const time = timeMatch ? timeMatch[1] : null;
    const isSuccess = /备份成功|成功/i.test(line) && !/备份失败|失败/i.test(line);
    const fileMatch = line.match(backupFileRe);
    const backupFile = fileMatch ? fileMatch[1] : null;

    // 如果该服务器不在配置列表里，也记录下来（日志里有但配置里可能改过）
    if (!serverMap[server]) {
      serverMap[server] = { server, success: false, time: null, backupFile: null };
    }

    // 成功记录覆盖失败记录；同一服务器多次备份取最后一条成功记录
    if (isSuccess) {
      serverMap[server] = { server, success: true, time, backupFile };
    } else if (!serverMap[server].success) {
      // 只有还没有成功记录时才更新失败状态
      serverMap[server] = { server, success: false, time, backupFile: null };
    }
  }

  const servers = Object.values(serverMap);
  const allSuccess = servers.length > 0 && servers.every(s => s.success);
  const someSuccess = servers.some(s => s.success);

  let detail: string;
  if (allSuccess) {
    detail = `今日（${today}）所有服务器备份成功`;
  } else if (someSuccess) {
    const failed = servers.filter(s => !s.success).map(s => s.server).join('、');
    detail = `今日（${today}）部分服务器尚未备份：${failed}`;
  } else {
    detail = `今日（${today}）尚无 ${projectName} 的成功备份记录`;
  }

  return { backed: allSuccess, detail, servers };
}

/** 列出 localDir 下的文件（仅一层） */
function listLocalDir(localDir: string): {
  exists: boolean;
  files: Array<{ name: string; size: string; mtime: string; isDir: boolean }>;
} {
  if (!localDir || !fs.existsSync(localDir)) {
    return { exists: false, files: [] };
  }
  if (!fs.statSync(localDir).isDirectory()) {
    return { exists: false, files: [] };
  }
  const entries = fs.readdirSync(localDir);
  const files = entries
    .map(name => {
      try {
        const s = fs.statSync(path.join(localDir, name));
        return { name, size: formatSize(s.size), mtime: s.mtime.toISOString(), isDir: s.isDirectory() };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{ name: string; size: string; mtime: string; isDir: boolean }>;
  return { exists: true, files };
}

// ── 路由 ──────────────────────────────────────────────

/**
 * GET /api/deploy/preflight/:project
 * 部署前预检：备份状态 + local_dir 文件列表
 */
router.get('/preflight/:project', (req: Request, res: Response) => {
  const proj = getProject(req.params.project);
  if (!proj) {
    return res.status(404).json({ success: false, error: '项目不存在' });
  }

  const backup = checkBackupToday(req.params.project, proj.server);
  const { exists, files } = listLocalDir(proj.localDir);

  res.json({
    success: true,
    data: { backup, localDir: proj.localDir, localDirExists: exists, files },
  });
});

/**
 * POST /api/deploy/upload/:project
 * 上传部署包到项目的 local_dir 目录
 */
router.post('/upload/:project', (req: Request, res: Response) => {
  const proj = getProject(req.params.project);
  if (!proj) {
    return res.status(404).json({ success: false, error: '项目不存在' });
  }
  if (!proj.localDir) {
    return res.status(400).json({ success: false, error: '该项目未配置 local_dir，请先在设置里配置' });
  }

  // 确保目标目录存在
  if (!fs.existsSync(proj.localDir)) {
    try {
      fs.mkdirSync(proj.localDir, { recursive: true });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: `无法创建目录: ${e.message}` });
    }
  }

  // multer 动态配置，以项目的 localDir 作为目标
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, proj.localDir),
      filename: (_req, file, cb) => cb(null, file.originalname),
    }),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB 上限
  }).single('file');

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `上传错误: ${err.message}` });
    }
    if (err) {
      return res.status(500).json({ success: false, error: `服务器错误: ${err.message}` });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未收到文件，请确认字段名为 file' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname.toLowerCase();
    const destDir = proj.localDir;

    // 判断是否为压缩包，若是则自动解压后删除原文件
    const isZip = fileName.endsWith('.zip');
    const isTarGz = fileName.endsWith('.tar.gz') || fileName.endsWith('.tgz');
    const isTar = fileName.endsWith('.tar');

    if (!isZip && !isTarGz && !isTar) {
      // 非压缩包，直接返回
      return res.json({
        success: true,
        data: { filename: req.file.originalname, size: formatSize(req.file.size), savedTo: filePath },
      });
    }

    // 构造解压命令
    let cmd: string;
    let args: string[];
    if (isZip) {
      cmd = 'unzip';
      args = ['-o', filePath, '-d', destDir];
    } else {
      // tar.gz 或 tar
      cmd = 'tar';
      args = [isTarGz ? '-xzf' : '-xf', filePath, '-C', destDir];
    }

    execFile(cmd, args, { timeout: 120_000 }, (execErr, _stdout, stderr) => {
      // 无论成功与否，都删除原压缩包
      try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }

      if (execErr) {
        return res.status(500).json({
          success: false,
          error: `解压失败: ${stderr || execErr.message}`,
        });
      }
      res.json({
        success: true,
        data: {
          filename: req.file!.originalname,
          size: formatSize(req.file!.size),
          savedTo: destDir,
          extracted: true,
        },
      });
    });
  });
});

/**
 * DELETE /api/deploy/files/:project/:filename
 * 删除 local_dir 下的指定文件
 */
router.delete('/files/:project/:filename', (req: Request, res: Response) => {
  const proj = getProject(req.params.project);
  if (!proj) {
    return res.status(404).json({ success: false, error: '项目不存在' });
  }
  const filename = path.basename(req.params.filename); // 防止路径遍历
  const filePath = path.join(proj.localDir, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: '文件不存在' });
  }
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
