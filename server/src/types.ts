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
  operatorId: string;
  operatorName: string;
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
