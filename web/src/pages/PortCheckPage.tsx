import React, { useState, useRef, useEffect } from 'react';
import { Radio, Play, RefreshCw, Loader, CheckCircle, XCircle, Terminal } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { api } from '../api/http';
import { createTaskWs } from '../api/ws';
import { Project } from '../types';

interface PortResult {
  project: string;
  server: string;
  port: number;
  online: boolean;
}

const PortCheckPage: React.FC = () => {
  const { projects, loadProjects } = useAppStore();
  const [results, setResults] = useState<PortResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedProject, setSelectedProject] = useState('all');
  const [terminalOutput, setTerminalOutput] = useState('');
  const wsCloseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const parseResults = (projects: Project[], logText: string): PortResult[] => {
    const out: PortResult[] = [];
    const clean = logText.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
    const lines = clean.split(/\r?\n/);

    projects.forEach(proj => {
      if (selectedProject !== 'all' && proj.name !== selectedProject) return;
      proj.server.forEach(srv => {
        proj.bindPorts.forEach(port => {
          const portStr = String(port);
          const matchLine = lines.find(l => l.includes(`[${srv}]`) && l.includes(portStr));
          const online = !!matchLine && matchLine.includes('正常');
          out.push({ project: proj.name, server: srv, port, online });
        });
      });
    });

    return out;
  };

  const handleCheck = async () => {
    if (isRunning) return;

    setTerminalOutput('端口检测启动中...\n');
    setIsRunning(true);
    setResults([]);

    const res = await api.checkPorts(selectedProject);
    if (!res.success || !res.data) {
      setIsRunning(false);
      setTerminalOutput(prev => prev + `\n[错误] ${res.error || '启动失败'}\n`);
      return;
    }

    const taskId = res.data.id;
    let allLogs = '';

    if (wsCloseRef.current) wsCloseRef.current();
    wsCloseRef.current = createTaskWs(taskId, (msg) => {
      if (msg.type === 'log') {
        setTerminalOutput(prev => prev + msg.data);
        allLogs += msg.data;
      }
      if (msg.type === 'complete') {
        setIsRunning(false);
        // 简单根据日志来推断端口状态
        const parsed = parseResults(projects, allLogs);
        setResults(parsed);
      }
    });
  };

  const targetProjects = selectedProject === 'all'
    ? projects
    : projects.filter(p => p.name === selectedProject);

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="bg-bg-secondary border border-border rounded-xl p-6">
        <h2 className="text-[14px] font-semibold text-text-primary mb-5 flex items-center gap-2">
          <Radio size={16} className="text-status-success" />
          端口检测
        </h2>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-text-secondary mb-2">选择项目</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              disabled={isRunning}
              className="w-full bg-bg-tertiary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-status-success/60 transition-colors disabled:opacity-50"
            >
              <option value="all">全部项目</option>
              {projects.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleCheck}
            disabled={isRunning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
          >
            {isRunning ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
            {isRunning ? '检测中...' : '开始检测'}
          </button>
        </div>
      </div>

      {/* Port overview grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-medium text-text-secondary">端口状态总览</h3>
          <button
            onClick={handleCheck}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-bg-secondary border border-border rounded-lg transition-all disabled:opacity-40"
          >
            <RefreshCw size={11} className={isRunning ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {targetProjects.map((proj) => (
            <div key={proj.name} className="bg-bg-secondary border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text-primary">{proj.name}</span>
                <span className="text-xs text-text-secondary">{proj.server.join(', ')}</span>
              </div>

              {proj.bindPorts.length === 0 ? (
                <span className="text-xs text-text-secondary">无端口配置</span>
              ) : (
                <div className="space-y-2">
                  {proj.server.map(srv => (
                    <div key={srv}>
                      <div className="text-[10px] text-text-tertiary mb-1 font-mono">{srv}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {proj.bindPorts.map(port => {
                          const result = results.find(
                            r => r.project === proj.name && r.server === srv && r.port === port
                          );
                          const online = result?.online;
                          const checked = result !== undefined;
                          return (
                            <div
                              key={port}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${
                                !checked ? 'bg-bg-tertiary border-border text-text-secondary' :
                                online ? 'bg-status-success/10 border-status-success/30 text-status-success' :
                                'bg-status-error/10 border-status-error/30 text-status-error'
                              }`}
                            >
                              {checked ? (
                                online ? <CheckCircle size={9} /> : <XCircle size={9} />
                              ) : (
                                <span className="w-2 h-2 rounded-full bg-border" />
                              )}
                              :{port}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 执行输出 */}
      {terminalOutput && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Terminal size={14} />
            执行输出
          </h2>
          <pre className="bg-bg-tertiary border border-border rounded-lg p-4 text-xs font-mono text-text-primary overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
            {terminalOutput}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PortCheckPage;
