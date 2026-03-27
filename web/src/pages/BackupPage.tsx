import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import {
  Archive, Play, Loader, Package,
  Server, HardDrive, FolderOpen, RotateCcw, Tag,
  CheckCircle, XCircle, RefreshCw, MinusCircle,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { api } from '../api/http';
import { createTaskWs } from '../api/ws';
import TerminalOutput from '../components/TerminalOutput';
import TaskStatusBadge from '../components/TaskStatusBadge';
import { TaskStatus, PreflightData } from '../types';

interface AllBackupStatus {
  name: string;
  backed: boolean | null;  // null = 查询中
  detail: string;
  servers: PreflightData['backup']['servers'];
}

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

  // 单项目备份状态
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // 全部项目备份状态
  const [allBackup, setAllBackup] = useState<AllBackupStatus[]>([]);
  const [allBackupLoading, setAllBackupLoading] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  // projects 加载完成后，若当前是 all，立即加载全部备份状态
  useEffect(() => {
    if (projects.length === 0) return;
    if (selectedProject === 'all') {
      loadAllBackup();
    }
  }, [projects]);

  // 切换项目时重置并重新加载
  useEffect(() => {
    if (selectedProject === 'all') {
      setPreflight(null);
      if (projects.length > 0) loadAllBackup();
    } else {
      setAllBackup([]);
      loadPreflight();
    }
  }, [selectedProject]);

  const loadPreflight = async () => {
    if (!selectedProject || selectedProject === 'all') return;
    setPreflightLoading(true);
    const res = await api.deployPreflight(selectedProject);
    setPreflightLoading(false);
    if (res.success && res.data) {
      setPreflight(res.data);
    }
  };

  const loadAllBackup = async () => {
    if (projects.length === 0) return;
    setAllBackupLoading(true);
    // 并发查询所有项目
    const results = await Promise.all(
      projects.map(async (p) => {
        const res = await api.deployPreflight(p.name);
        if (res.success && res.data) {
          return {
            name: p.name,
            backed: res.data.backup.backed,
            detail: res.data.backup.detail,
            servers: res.data.backup.servers ?? [],
          } as AllBackupStatus;
        }
        return {
          name: p.name,
          backed: null,
          detail: '查询失败',
          servers: [],
        } as AllBackupStatus;
      })
    );
    setAllBackup(results);
    setAllBackupLoading(false);
  };

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
        // 备份完成后刷新今日备份状态
        if (selectedProject === 'all') {
          loadAllBackup();
        } else {
          loadPreflight();
        }
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

        {/* 项目配置信息卡片（仅选择具体项目时显示） */}
        {selectedProject && selectedProject !== 'all' && (() => {
          const proj = projects.find(p => p.name === selectedProject);
          if (!proj) return null;
          return (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
              <div className="flex items-start gap-2 text-xs">
                <Server size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary mr-2">目标服务器</span>
                  <span className="font-mono text-text-primary">{proj.server.join('、') || '—'}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <HardDrive size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary mr-2">远程目录</span>
                  <span className="font-mono text-text-primary">{proj.remoteDir || '—'}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <FolderOpen size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-text-secondary mr-2">备份目录</span>
                  <span className="font-mono text-text-primary">{proj.backupDir || '—'}</span>
                </div>
              </div>
              {proj.restartCmd && (
                <div className="flex items-start gap-2 text-xs">
                  <RotateCcw size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-text-secondary mr-2">重启命令</span>
                    <span className="font-mono text-text-primary">{proj.restartCmd}</span>
                  </div>
                </div>
              )}
              {proj.bindPorts.length > 0 && (
                <div className="flex items-start gap-2 text-xs">
                  <Tag size={13} className="text-text-secondary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-text-secondary mr-2">监听端口</span>
                    <span className="font-mono text-text-primary">{proj.bindPorts.join('、')}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* 全部项目今日备份状态面板 */}
      {selectedProject === 'all' && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
              <Archive size={16} className="text-primary-cyan" />
              今日备份状态 — 全部项目
            </h2>
            <button
              onClick={loadAllBackup}
              disabled={allBackupLoading}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={allBackupLoading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>

          {allBackupLoading && allBackup.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-text-secondary py-1">
              <Loader size={14} className="animate-spin" />
              查询中...
            </div>
          )}

          {allBackup.length > 0 && (
            <div className="space-y-2">
              {allBackup.map((item) => (
                <div
                  key={item.name}
                  className={`rounded-lg border px-4 py-3 ${
                    item.backed === null
                      ? 'border-border bg-bg-tertiary'
                      : item.backed
                      ? 'border-status-success/30 bg-status-success/5'
                      : 'border-status-error/30 bg-status-error/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.backed === null
                      ? <MinusCircle size={14} className="text-text-secondary flex-shrink-0" />
                      : item.backed
                      ? <CheckCircle size={14} className="text-status-success flex-shrink-0" />
                      : <XCircle size={14} className="text-status-error flex-shrink-0" />}
                    <span className={`text-sm font-medium ${
                      item.backed === null
                        ? 'text-text-secondary'
                        : item.backed
                        ? 'text-status-success'
                        : 'text-status-error'
                    }`}>
                      {item.name}
                    </span>
                    <span className="text-xs text-text-secondary ml-auto">{item.detail}</span>
                  </div>

                  {/* 服务器明细（折叠展示，仅有多台时显示） */}
                  {item.servers && item.servers.length > 1 && (
                    <div className="mt-2 pl-6 space-y-1">
                      {item.servers.map(srv => (
                        <div key={srv.server} className="flex items-center gap-2 text-xs text-text-secondary">
                          {srv.success
                            ? <CheckCircle size={11} className="text-status-success flex-shrink-0" />
                            : <XCircle size={11} className="text-status-error flex-shrink-0" />}
                          <span className="font-mono">{srv.server}</span>
                          {srv.success && srv.time && (
                            <span className="ml-1">{srv.time.slice(11, 16)}</span>
                          )}
                          {srv.success && srv.backupFile && (
                            <span className="font-mono text-text-muted truncate max-w-xs" title={srv.backupFile}>
                              {srv.backupFile.split('/').pop()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 单台服务器时直接展示时间 */}
                  {item.servers && item.servers.length === 1 && item.servers[0].success && (
                    <div className="mt-1 pl-6 text-xs text-text-secondary">
                      {item.servers[0].time && <span>{item.servers[0].time}</span>}
                      {item.servers[0].backupFile && (
                        <span className="font-mono ml-2 text-text-muted" title={item.servers[0].backupFile}>
                          {item.servers[0].backupFile.split('/').pop()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 今日备份状态面板（仅选择具体项目时显示） */}
      {selectedProject && selectedProject !== 'all' && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold text-text-primary flex items-center gap-2">
              <Archive size={16} className="text-primary-cyan" />
              今日备份状态
            </h2>
            <button
              onClick={loadPreflight}
              disabled={preflightLoading}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={preflightLoading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>

          {preflightLoading && (
            <div className="flex items-center gap-2 text-sm text-text-secondary py-1">
              <Loader size={14} className="animate-spin" />
              查询中...
            </div>
          )}

          {preflight && !preflightLoading && (
            <div className={`rounded-lg p-4 border ${
              preflight.backup.backed
                ? 'bg-status-success/5 border-status-success/30'
                : 'bg-status-error/5 border-status-error/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {preflight.backup.backed
                  ? <CheckCircle size={16} className="text-status-success flex-shrink-0" />
                  : <XCircle size={16} className="text-status-error flex-shrink-0" />}
                <span className={`text-sm font-medium ${preflight.backup.backed ? 'text-status-success' : 'text-status-error'}`}>
                  {preflight.backup.backed ? '今日已备份 ✓' : '今日尚未备份 ✗'}
                </span>
              </div>

              {preflight.backup.servers && preflight.backup.servers.length > 0 && (
                <div className="mt-2 space-y-1.5 pl-6">
                  {preflight.backup.servers.map(srv => (
                    <div key={srv.server} className="flex items-start gap-2 text-xs">
                      {srv.success
                        ? <CheckCircle size={12} className="text-status-success flex-shrink-0 mt-0.5" />
                        : <XCircle size={12} className="text-status-error flex-shrink-0 mt-0.5" />}
                      <div>
                        <span className={`font-mono font-medium ${srv.success ? 'text-status-success' : 'text-status-error'}`}>
                          {srv.server}
                        </span>
                        {srv.success && srv.time && (
                          <span className="text-text-secondary ml-2">{srv.time}</span>
                        )}
                        {srv.success && srv.backupFile && (
                          <div className="text-text-secondary font-mono truncate max-w-xs mt-0.5" title={srv.backupFile}>
                            {srv.backupFile.split('/').pop()}
                          </div>
                        )}
                        {!srv.success && (
                          <span className="text-text-secondary ml-2">今日尚无成功记录</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-text-secondary mt-2 pl-6">{preflight.backup.detail}</div>
            </div>
          )}
        </div>
      )}

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
