// 前端共享类型定义

export interface User {
  id: string;
  username: string;
  role: 'ops_admin' | 'system_admin';
  avatar?: string;
  is_frozen?: boolean;
  created_at?: string;
}

export interface Project {
  name: string;
  server: string[];
  remoteDir: string;
  backupDir: string;
  localDir: string;
  exclude: string;
  restartCmd: string;
  bindPorts: number[];
}

export interface SSHConfig {
  user: string;
  key: string;
}

export type TaskType = 'deploy' | 'backup' | 'check-ports' | 'remote';
export type TaskStatus = 'pending' | 'running' | 'success' | 'failed';

export enum AuditEventType {
  LOGIN = '登录',
  BACKUP = '备份',
  DEPLOY = '部署',
  REMOTE_CMD = '远程命令',
  USER_MGMT = '用户管理',
  SYS_SETTINGS = '系统设置',
  PORT_CHECK = '端口检测',
}

export interface Task {
  id: string;
  type: TaskType;
  project: string;
  status: TaskStatus;
  dryRun?: boolean;
  startTime: string;
  endTime?: string;
  exitCode?: number;
}

export interface WsMessage {
  type: 'log' | 'status' | 'complete';
  taskId: string;
  data: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LogFileMeta {
  key: string;
  filename: string;
  size: number;
  lastModified: string | null;
}

export interface LocalDirFile {
  name: string;
  size: string;
  mtime: string;
  isDir: boolean;
}

export interface ServerBackupRecord {
  server: string;
  success: boolean;
  time: string | null;
  backupFile: string | null;
}

export interface PreflightData {
  backup: {
    backed: boolean;
    detail: string;
    servers: ServerBackupRecord[];
  };
  localDir: string;
  localDirExists: boolean;
  files: LocalDirFile[];
}

export interface RemoteCommand {
  name: string;
  server: string[];
  command: string;
  group: string;
}

export interface AuditLog {
  id: string;
  operator_id: string;
  operator_name: string;
  event_type: string;
  target: string;
  result: string;
  timestamp: string;
}

export interface CommandExecResult {
  server: string;
  success: boolean;
  output: string;
}

export interface CommandHistory {
  commandName: string;
  server: string;
  status: 'success' | 'error';
  time: string;
}

export type GroupedCommands = {
  [group: string]: RemoteCommand[];
};
