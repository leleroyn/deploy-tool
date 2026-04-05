// 共享类型定义（前后端通用）

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

export interface PortStatus {
  project: string;
  server: string;
  port: number;
  online: boolean;
  checkedAt: string;
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
