import * as fs from 'fs';
import * as path from 'path';
import * as ini from 'ini';
import { Project, SSHConfig } from '../types';

// 优先从环境变量读取路径，方便 Docker 容器挂载
const SCRIPT_DIR = process.env.SCRIPT_DIR || path.join(__dirname, '../../../script');
const CONFIG_FILE = process.env.CONFIG_FILE || path.join(SCRIPT_DIR, 'config.ini');

function readRaw(): Record<string, any> {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`配置文件不存在: ${CONFIG_FILE}`);
  }
  const content = fs.readFileSync(CONFIG_FILE, 'utf-8').replace(/\r\n/g, '\n');
  return ini.parse(content);
}

function writeRaw(data: Record<string, any>): void {
  const content = ini.stringify(data);
  fs.writeFileSync(CONFIG_FILE, content, 'utf-8');
}

export function getSSHConfig(): SSHConfig {
  const raw = readRaw();
  const ssh = raw['ssh'] || {};
  return {
    user: (ssh.user || 'root').trim(),
    key: (ssh.key || '').trim(),
  };
}

export function updateSSHConfig(config: Partial<SSHConfig>): void {
  const raw = readRaw();
  if (!raw['ssh']) raw['ssh'] = {};
  if (config.user !== undefined) raw['ssh'].user = config.user;
  if (config.key !== undefined) raw['ssh'].key = config.key;
  writeRaw(raw);
}

export function getProjects(): Project[] {
  const raw = readRaw();
  return Object.keys(raw)
    .filter(k => k !== 'ssh')
    .map(name => parseProject(name, raw[name]));
}

export function getProject(name: string): Project | null {
  const raw = readRaw();
  if (!raw[name] || name === 'ssh') return null;
  return parseProject(name, raw[name]);
}

export function updateProject(name: string, data: Partial<Omit<Project, 'name'>>): void {
  const raw = readRaw();
  if (!raw[name]) raw[name] = {};
  const sec = raw[name];
  if (data.server !== undefined) sec.server = data.server.join(',');
  if (data.remoteDir !== undefined) sec.remote_dir = data.remoteDir;
  if (data.backupDir !== undefined) sec.backup_dir = data.backupDir;
  if (data.localDir !== undefined) sec.local_dir = data.localDir;
  if (data.exclude !== undefined) sec.exclude = data.exclude;
  if (data.restartCmd !== undefined) sec.restart_cmd = data.restartCmd;
  if (data.bindPorts !== undefined) sec['bind-port'] = data.bindPorts.join(',');
  writeRaw(raw);
}

export function addProject(project: Project): void {
  const raw = readRaw();
  raw[project.name] = {
    server: project.server.join(','),
    remote_dir: project.remoteDir,
    backup_dir: project.backupDir,
    local_dir: project.localDir,
    exclude: project.exclude,
    restart_cmd: project.restartCmd,
    'bind-port': project.bindPorts.join(','),
  };
  writeRaw(raw);
}

export function deleteProject(name: string): void {
  const raw = readRaw();
  delete raw[name];
  writeRaw(raw);
}

function parseProject(name: string, sec: Record<string, any>): Project {
  const serverRaw = (sec.server || '').trim();
  const portsRaw = (sec['bind-port'] || '').trim();
  return {
    name,
    server: serverRaw ? serverRaw.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
    remoteDir: (sec.remote_dir || '').trim(),
    backupDir: (sec.backup_dir || '').trim(),
    localDir: (sec.local_dir || '').trim(),
    exclude: (sec.exclude || '').trim(),
    restartCmd: (sec.restart_cmd || '').trim(),
    bindPorts: portsRaw
      ? portsRaw.split(',').map((p: string) => parseInt(p.trim(), 10)).filter((p: number) => !isNaN(p))
      : [],
  };
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getScriptDir(): string {
  return SCRIPT_DIR;
}
