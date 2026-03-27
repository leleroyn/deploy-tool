import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { Archive, Play, Loader, Package } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { api } from '../api/http';
import { createTaskWs } from '../api/ws';
import TerminalOutput from '../components/TerminalOutput';
import TaskStatusBadge from '../components/TaskStatusBadge';
import { TaskStatus } from '../types';

const BackupPage: React.FC = () => {
  const location = useLocation();
  const { projects, loadProjects } = useAppStore();
  const [selectedProject, setSelectedProject] = useState<string>(
    (location.state as any)?.project || 'all'
  );
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [backupResult, setBackupResult] = useState<string[]>([]);
  const terminalRef = useRef<Terminal | null>(null);
  const wsCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const handleBackup = async () => {
    if (isRunning) return;

    if (terminalRef.current) {
      terminalRef.current.clear();
      terminalRef.current.write('\x1b[90m备份任务启动中...\r\n\x1b[0m');
    }

    setIsRunning(true);
    setTaskStatus('running');
    setBackupResult([]);

    const res = await api.backup(selectedProject);
    if (!res.success || !res.data) {
      setTaskStatus('failed');
      setIsRunning(false);
      terminalRef.current?.write(`\r\n\x1b[31m[错误] ${res.error || '启动失败'}\x1b[0m\r\n`);
      return;
    }

    const taskId = res.data.id;
    const results: string[] = [];

    if (wsCloseRef.current) wsCloseRef.current();
    wsCloseRef.current = createTaskWs(taskId, (msg) => {
      if (msg.type === 'log' && terminalRef.current) {
        terminalRef.current.write(msg.data);
        // 提取备份文件信息
        const match = msg.data.match(/备份成功:\s*(.+?)\s*\((.+?)\)/);
        if (match) results.push(`${match[1]} (${match[2]})`);
      }
      if (msg.type === 'complete') {
        setTaskStatus(msg.data as TaskStatus);
        setIsRunning(false);
        setBackupResult([...results]);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <h2 className="text-[14px] font-semibold text-text-primary mb-5 flex items-center gap-2">
          <Archive size={16} className="text-primary-cyan" />
          备份配置
        </h2>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-text-secondary mb-2">选择项目</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              disabled={isRunning}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary-cyan/60 transition-colors disabled:opacity-50"
            >
              <option value="all">全部项目</option>
              {projects.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleBackup}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isRunning ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
              {isRunning ? '备份中...' : '执行备份'}
            </button>

            {taskStatus && <TaskStatusBadge status={taskStatus} />}
          </div>
        </div>
      </div>

      {/* Backup results */}
      {backupResult.length > 0 && (
        <div className="bg-status-success/5 border border-status-success/20 rounded-xl p-4">
          <h3 className="text-xs font-medium text-status-success mb-3 flex items-center gap-1.5">
            <Package size={13} />
            备份文件
          </h3>
          <div className="space-y-1.5">
            {backupResult.map((r, i) => (
              <div key={i} className="text-xs font-mono text-text-muted bg-bg-tertiary rounded px-3 py-1.5 border border-border">
                {r}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terminal */}
      <TerminalOutput
        onTerminalReady={(term) => { terminalRef.current = term; }}
        minHeight={380}
      />
    </div>
  );
};

export default BackupPage;
