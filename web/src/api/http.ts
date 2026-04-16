import { ApiResponse, Project, SSHConfig, Task, LogFileMeta, PreflightData, GroupedCommands, CommandHistory } from '../types';

const BASE = '/api';

/** 从 sessionStorage 读取 token */
export function getToken(): string {
  return sessionStorage.getItem('deploy_token') || '';
}

/** 保存 token */
export function setToken(token: string): void {
  sessionStorage.setItem('deploy_token', token);
}

/** 清除 token */
export function clearToken(): void {
  sessionStorage.removeItem('deploy_token');
}

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${url}`, {
    headers,
    ...options,
  });
  const data = await res.json();
  return data as ApiResponse<T>;
}

export const api = {
  // 认证
  login: (username: string, password: string) =>
    request<{ token?: string; requireOtpSetup?: boolean; requireOtpVerify?: boolean; tempToken?: string }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }
    ),
  otpSetup: (tempToken: string) =>
    request<{ qrCode?: string; tempToken?: string }>('/auth/otp/setup', { method: 'POST', body: JSON.stringify({ tempToken }) }),
  otpVerify: (tempToken: string, code: string) =>
    request<{ token: string }>('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ tempToken, code }) }),
  otpVerifyLogin: (tempToken: string, code: string) =>
    request<{ token: string }>('/auth/otp/verify-login', { method: 'POST', body: JSON.stringify({ tempToken, code }) }),
  logout: () =>
    request('/auth/logout', { method: 'POST' }),
  me: () =>
    request<any>('/auth/me'),
  updateMe: (data: { avatar?: string; password?: string }) =>
    request<any>('/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<any>('/users/change-password', { method: 'POST', body: JSON.stringify(data) }),
  getUsers: () => request<any[]>('/users'),
  createUser: (data: { username: string; password: string; role: string }) =>
    request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) =>
    request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetUserOtp: (id: string) =>
    request<any>(`/users/${id}/reset-otp`, { method: 'POST' }),


  // 项目
  getProjects: () => request<Project[]>('/projects'),
  getProject: (name: string) => request<Project>(`/projects/${name}`),
  updateProject: (name: string, data: Partial<Project>) =>
    request<Project>(`/projects/${name}`, { method: 'PUT', body: JSON.stringify(data) }),
  createProject: (data: Project) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  deleteProject: (name: string) =>
    request(`/projects/${name}`, { method: 'DELETE' }),

  // 任务
  getTasks: () => request<Task[]>('/tasks'),
  getTask: (id: string) => request<Task>(`/tasks/${id}`),
  deploy: (project: string, dryRun = false) =>
    request<Task>('/tasks/deploy', { method: 'POST', body: JSON.stringify({ project, dryRun }) }),
  backup: (project: string) =>
    request<Task>('/tasks/backup', { method: 'POST', body: JSON.stringify({ project }) }),
  checkPorts: (project: string) =>
    request<Task>('/tasks/check-ports', { method: 'POST', body: JSON.stringify({ project }) }),

  // SSH
  getSSHConfig: () => request<SSHConfig>('/ssh-config'),
  updateSSHConfig: (data: Partial<SSHConfig>) =>
    request<SSHConfig>('/ssh-config', { method: 'PUT', body: JSON.stringify(data) }),

  // 日志
  getLogFiles: () => request<LogFileMeta[]>('/logs/files'),
  getLog: (type: string) => request<string>(`/logs/${type}`),
  clearLog: (type: string) => request(`/logs/${type}`, { method: 'DELETE' }),

  // 健康检查
  health: () => request<{ status: string }>('/health'),

  // 部署预检 & 文件管理
  deployPreflight: (project: string) =>
    request<PreflightData>(`/deploy/preflight/${encodeURIComponent(project)}`),

  deployUpload: (project: string, file: File, onProgress?: (pct: number) => void): Promise<ApiResponse<{ filename: string; size: string; savedTo: string }>> => {
    return new Promise((resolve) => {
      const token = getToken();
      const formData = new FormData();
      formData.append('file', file);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/deploy/upload/${encodeURIComponent(project)}`);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({ success: false, error: '响应解析失败' }); }
      };
      xhr.onerror = () => resolve({ success: false, error: '网络错误' });
      xhr.send(formData);
    });
  },

  deployDeleteFile: (project: string, filename: string) =>
    request(`/deploy/files/${encodeURIComponent(project)}/${encodeURIComponent(filename)}`, { method: 'DELETE' }),

  // 远程命令
  getCommands: () => request<GroupedCommands>('/commands'),
  execCommand: (name: string) =>
    request<Task>(`/tasks/remote`, { method: 'POST', body: JSON.stringify({ commandName: name }) }),
  getCommandHistory: (count: number = 100) => request<CommandHistory[]>(`/commands/history?count=${count}`),
};
