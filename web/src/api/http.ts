import { ApiResponse, Project, SSHConfig, Task, LogFileMeta, PreflightData, GroupedCommands, CommandExecResult, CommandHistory } from '../types';

const BASE = '/api';

/** 从 localStorage 读取 token */
export function getToken(): string {
  return localStorage.getItem('deploy_token') || '';
}

/** 保存 token */
export function setToken(token: string): void {
  localStorage.setItem('deploy_token', token);
}

/** 清除 token */
export function clearToken(): void {
  localStorage.removeItem('deploy_token');
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
  login: (password: string) =>
    request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () =>
    request('/auth/logout', { method: 'POST' }),

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
