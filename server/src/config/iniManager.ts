import * as fs from 'fs';
import * as path from 'path';
import * as TOML from '@iarna/toml';
import { Project, SSHConfig } from '../types';

const SCRIPT_DIR = process.env.SCRIPT_DIR || path.join(__dirname, '../../script');
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(__dirname, '../../../config.toml');

interface RawConfig {
  ssh?: {
    user?: string;
    key?: string;
  };
  deploy?: Record<string, {
    server?: string[];
    remote_dir?: string;
    backup_dir?: string;
    local_dir?: string;
    exclude?: string[];
    restart_cmd?: string;
    'bind-port'?: number | number[];
  }>;
  command?: Record<string, {
    server?: string[];
    command?: string;
    group?: string;
  }>;
}

function readRaw(): RawConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    const msg = `配置文件不存在: ${CONFIG_FILE}`;
    console.error('[Config]', msg);
    throw new Error(msg);
  }
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return TOML.parse(content) as any;
  } catch (err) {
    console.error('[Config] 读取或解析配置失败:', CONFIG_FILE, err);
    throw err;
  }
}

// 转义 TOML 字符串值中的特殊字符
function escapeToml(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

function writeRaw(data: RawConfig): void {
  try {
    const lines: string[] = [];

    if (data.ssh) {
      lines.push('[ssh]');
      if (data.ssh.user) lines.push(`user = "${escapeToml(data.ssh.user)}"`);
      if (data.ssh.key) lines.push(`key = "${escapeToml(data.ssh.key)}"`);
      lines.push('');
    }

    if (data.deploy) {
      for (const [name, sec] of Object.entries(data.deploy)) {
        lines.push(`[deploy.${name}]`);
        if (sec.server && sec.server.length > 0) {
          lines.push(`server = ${JSON.stringify(sec.server)}`);
        }
        if (sec.remote_dir) lines.push(`remote_dir = "${escapeToml(sec.remote_dir)}"`);
        if (sec.backup_dir) lines.push(`backup_dir = "${escapeToml(sec.backup_dir)}"`);
        if (sec.local_dir) lines.push(`local_dir = "${escapeToml(sec.local_dir)}"`);
        if (sec.exclude && sec.exclude.length > 0) {
          lines.push(`exclude = ${JSON.stringify(sec.exclude)}`);
        }
        if (sec.restart_cmd) lines.push(`restart_cmd = "${escapeToml(sec.restart_cmd)}"`);
        if (sec['bind-port'] !== undefined) {
          const ports = sec['bind-port'];
          if (Array.isArray(ports)) {
            lines.push(`bind-port = ${JSON.stringify(ports)}`);
          } else {
            lines.push(`bind-port = ${ports}`);
          }
        }
        lines.push('');
      }
    }

    if (data.command) {
      for (const [name, sec] of Object.entries(data.command)) {
        lines.push(`[command."${escapeToml(name)}"]`);
        if (sec.server && sec.server.length > 0) {
          lines.push(`server = ${JSON.stringify(sec.server)}`);
        }
        if (sec.command) lines.push(`command = "${escapeToml(sec.command)}"`);
        if (sec.group) lines.push(`group = "${escapeToml(sec.group)}"`);
        lines.push('');
      }
    }

    fs.writeFileSync(CONFIG_FILE, lines.join('\n'), 'utf-8');
  } catch (err) {
    console.error('[Config] 写入配置失败:', CONFIG_FILE, err);
    throw err;
  }
}

export function getSSHConfig(): SSHConfig {
  const raw = readRaw();
  const ssh = raw.ssh || {};
  return {
    user: (ssh.user || 'root').trim(),
    key: (ssh.key || '').trim(),
  };
}

export function updateSSHConfig(config: Partial<SSHConfig>): void {
  const raw = readRaw();
  if (!raw.ssh) raw.ssh = {};
  if (config.user !== undefined) raw.ssh.user = config.user;
  if (config.key !== undefined) raw.ssh.key = config.key;
  writeRaw(raw);
}

export function getProjects(): Project[] {
  const raw = readRaw();
  if (!raw.deploy) return [];
  return Object.keys(raw.deploy).map(name => parseProject(name, raw.deploy![name]));
}

export function getProject(name: string): Project | null {
  const raw = readRaw();
  if (!raw.deploy || !raw.deploy[name]) return null;
  return parseProject(name, raw.deploy[name]);
}

export function updateProject(name: string, data: Partial<Omit<Project, 'name'>>): void {
  const raw = readRaw();
  if (!raw.deploy) raw.deploy = {};
  if (!raw.deploy[name]) raw.deploy[name] = {};
  const sec = raw.deploy[name];
  if (data.server !== undefined) sec.server = data.server;
  if (data.remoteDir !== undefined) sec.remote_dir = data.remoteDir;
  if (data.backupDir !== undefined) sec.backup_dir = data.backupDir;
  if (data.localDir !== undefined) sec.local_dir = data.localDir;
  if (data.exclude !== undefined) {
    sec.exclude = data.exclude.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (data.restartCmd !== undefined) sec.restart_cmd = data.restartCmd;
  if (data.bindPorts !== undefined) sec['bind-port'] = data.bindPorts;
  writeRaw(raw);
}

export function addProject(project: Project): void {
  const raw = readRaw();
  if (!raw.deploy) raw.deploy = {};
  raw.deploy[project.name] = {
    server: project.server,
    remote_dir: project.remoteDir,
    backup_dir: project.backupDir,
    local_dir: project.localDir,
    exclude: project.exclude.split(',').map(s => s.trim()).filter(Boolean),
    restart_cmd: project.restartCmd,
    'bind-port': project.bindPorts,
  };
  writeRaw(raw);
}

export function deleteProject(name: string): void {
  const raw = readRaw();
  if (raw.deploy && raw.deploy[name]) {
    delete raw.deploy[name];
  }
  writeRaw(raw);
}

function parseProject(name: string, sec: RawConfig['deploy'][string]): Project {
  const serverArr = sec.server || [];
  const portsVal = sec['bind-port'];
  let ports: number[] = [];
  if (typeof portsVal === 'number') {
    ports = [portsVal];
  } else if (Array.isArray(portsVal)) {
    ports = portsVal.map(p => Number(p));
  }

  let excludeStr: string;
  if (Array.isArray(sec.exclude)) {
    excludeStr = sec.exclude.join(',');
  } else {
    excludeStr = sec.exclude || '';
  }

  return {
    name,
    server: serverArr.map((s: string) => s.trim()).filter(Boolean),
    remoteDir: (sec.remote_dir || '').trim(),
    backupDir: (sec.backup_dir || '').trim(),
    localDir: (sec.local_dir || '').trim(),
    exclude: excludeStr,
    restartCmd: (sec.restart_cmd || '').trim(),
    bindPorts: ports.filter((p: number) => !isNaN(p)),
  };
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getScriptDir(): string {
  return SCRIPT_DIR;
}

export function getLogDir(): string {
  return process.env.LOG_BASE_DIR || path.join(__dirname, '../../../logs');
}

export interface RemoteCommand {
  name: string;
  server: string[];
  command: string;
  group: string;
}

export function getCommands(): RemoteCommand[] {
  const raw = readRaw();
  if (!raw.command) return [];
  return Object.keys(raw.command).map(name => {
    const sec = raw.command![name];
    return {
      name,
      server: sec.server || [],
      command: sec.command || '',
      group: sec.group || '未分组',
    };
  });
}

export function getCommand(name: string): RemoteCommand | null {
  const raw = readRaw();
  if (!raw.command || !raw.command[name]) return null;
  const sec = raw.command[name];
  return {
    name,
    server: sec.server || [],
    command: sec.command || '',
    group: sec.group || '未分组',
  };
}

export interface CommandHistory {
  commandName: string;
  server: string;
  status: 'success' | 'error';
  time: string;
}

export function getCommandHistory(count: number = 3): CommandHistory[] {
  const logFile = path.join(getLogDir(), 'exec_remote_script.log');
  if (!fs.existsSync(logFile)) return [];

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean).reverse();

  const history: CommandHistory[] = [];
  for (const line of lines) {
    if (history.length >= count) break;
    
    const match = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\] 命令 (.+) 执行(.+)，服务器 (.+)/);
    if (match) {
      history.push({
        commandName: match[3],
        server: match[5],
        status: match[4].includes('成功') ? 'success' : 'error',
        time: match[1],
      });
    }
  }

  return history;
}