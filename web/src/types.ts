// 前端共享类型定义

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

export type TaskType = 'deploy' | 'backup' | 'check-ports';
export type TaskStatus = 'pending' | 'running' | 'success' | 'failed';

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
