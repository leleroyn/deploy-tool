import { spawn } from 'child_process';
import * as path from 'path';
import { getScriptDir } from '../config/iniManager';

export interface RunOptions {
  script: 'deploy' | 'backup' | 'check-ports';
  args: string[];
  env?: Record<string, string>;
  onData: (chunk: string) => void;
  onExit: (code: number) => void;
}

export function runScript(opts: RunOptions): () => void {
  const scriptDir = getScriptDir();
  const scriptMap: Record<string, string> = {
    deploy: path.join(scriptDir, 'deploy.sh'),
    backup: path.join(scriptDir, 'backup_pj.sh'),
    'check-ports': path.join(scriptDir, 'check_ports.sh'),
  };

  const scriptPath = scriptMap[opts.script];
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    TERM: 'xterm-256color',
    // 确保 SSH agent 环境变量传递给子进程
    ...(process.env.SSH_AUTH_SOCK ? { SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK } : {}),
    ...(process.env.SSH_AGENT_PID ? { SSH_AGENT_PID: process.env.SSH_AGENT_PID } : {}),
    SKIP_SSH_INIT: '1', // 跳过脚本内部的 ssh-agent 初始化，直接使用已有 agent
    ...(opts.env || {}),
  };

  const child = spawn('bash', [scriptPath, ...opts.args], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (data: Buffer) => {
    opts.onData(data.toString());
  });

  child.stderr.on('data', (data: Buffer) => {
    opts.onData(data.toString());
  });

  child.on('close', (code: number | null) => {
    opts.onExit(code ?? 1);
  });

  child.on('error', (err: Error) => {
    opts.onData(`\r\n[错误] 脚本启动失败: ${err.message}\r\n`);
    opts.onExit(1);
  });

  // 返回 kill 函数
  return () => {
    child.kill('SIGTERM');
  };
}
