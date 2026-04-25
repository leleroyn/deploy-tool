import React, { useEffect, useState } from 'react';
import { FileText, Download, Trash2, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { api } from '../api/http';
import { useAppStore } from '../store/appStore';
import TaskStatusBadge from '../components/TaskStatusBadge';
import { LogFileMeta, Task } from '../types';

const typeLabel: Record<string, string> = {
  deploy: '部署',
  backup: '备份',
  'check-ports': '端口检测',
  remote: '远程维护',
};

const logTypeMap: Record<string, string> = {
  deploy: '部署日志',
  backup: '备份日志',
  ports: '端口检测日志',
  remote: '远程维护日志',
};

const LogsPage: React.FC = () => {
  const { tasks, taskTotal, loadTasks, user } = useAppStore();
  const [logFiles, setLogFiles] = useState<LogFileMeta[]>([]);
  const [activeLog, setActiveLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  // 内联确认：存待删除的 key，避免 iframe 中 window.confirm 被拦截
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const isSystemAdmin = user?.role === 'system_admin';

  useEffect(() => {
    loadTasks(page, limit);
    loadLogFiles();
  }, [page]);


  const loadLogFiles = async () => {
    const res = await api.getLogFiles();
    if (res.success && res.data) setLogFiles(res.data);
  };

  const handleViewLog = async (key: string) => {
    setLoading(true);
    setActiveLog(key);
    const res = await api.getLog(key);
    if (res.success) setLogContent(res.data || '（日志为空）');
    setLoading(false);
  };

  const handleClearLog = async (key: string) => {
    await api.clearLog(key);
    if (activeLog === key) setLogContent('');
    setConfirmKey(null);
    loadLogFiles();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Task history */}
      <div>
        <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2 mb-4">
          <span className="w-1 h-4 rounded-full bg-primary-light inline-block" />
          任务记录
          <button
            onClick={() => loadTasks(page, limit)}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary bg-bg-secondary border border-border rounded-lg transition-all"
          >
            <RefreshCw size={11} />
            刷新
          </button>
        </h2>

        {tasks.length === 0 ? (
          <div className="text-center py-12 bg-bg-secondary rounded-xl border border-border text-text-secondary">
            暂无任务记录
          </div>
        ) : (
          <div>
            <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">任务 ID</th>
                    <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">类型</th>
                    <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">项目</th>
                    <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">状态</th>
                    <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">开始时间</th>
                    <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">耗时</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task: Task, idx) => {
                    const dur = task.endTime
                      ? Math.round((new Date(task.endTime).getTime() - new Date(task.startTime).getTime()) / 1000)
                      : null;
                    return (
                      <tr key={task.id} className={`border-b border-border/50 hover:bg-bg-tertiary transition-colors ${idx === tasks.length - 1 ? 'border-0' : ''}`}>
                        <td className="px-4 py-3 text-[11px] font-mono text-text-secondary">{task.id.slice(0, 8)}...</td>
                        <td className="px-4 py-3 text-xs text-text-muted">
                          {typeLabel[task.type] || task.type}
                          {task.dryRun && <span className="ml-1 text-[10px] text-status-warning bg-status-warning/10 px-1 rounded">DRY</span>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-text-primary">{task.project}</td>
                        <td className="px-4 py-3"><TaskStatusBadge status={task.status} /></td>
                        <td className="px-4 py-3 text-xs text-text-secondary font-mono">
                          {new Date(task.startTime).toLocaleString('zh-CN', { hour12: false })}
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {dur !== null ? `${dur}s` : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {taskTotal > limit && (
              <div className="flex items-center justify-between mt-3 px-1">
                <span className="text-xs text-text-secondary">共 {taskTotal} 条记录</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-2.5 py-1 text-xs rounded border border-border bg-bg-secondary text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    上一页
                  </button>
                  <span className="text-xs text-text-secondary">
                    第 {page} / {Math.ceil(taskTotal / limit)} 页
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= Math.ceil(taskTotal / limit) - 1}
                    className="px-2.5 py-1 text-xs rounded border border-border bg-bg-secondary text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log files */}
      <div>
        <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2 mb-4">
          <span className="w-1 h-4 rounded-full bg-status-warning inline-block" />
          日志文件
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {logFiles.map((file) => (
            <div key={file.key} className={`bg-bg-secondary border rounded-xl p-4 transition-all cursor-pointer ${activeLog === file.key ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-border hover:border-border/80'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-text-secondary" />
                  <span className="text-sm font-medium text-text-primary">{logTypeMap[file.key]}</span>
                </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleViewLog(file.key)}
                      className="p-1 rounded text-text-secondary hover:text-primary-light hover:bg-primary/10 transition-all"
                      title="查看"
                    >
                      <Download size={13} />
                    </button>
                    {isSystemAdmin && (
                      <button
                        onClick={() => setConfirmKey(file.key)}
                        className="p-1 rounded text-text-secondary hover:text-status-error hover:bg-status-error/10 transition-all"
                        title="清空日志内容"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

              </div>
              <p className="text-xs font-mono text-text-secondary">{file.filename}</p>
              <div className="flex items-center justify-between mt-2 text-[11px] text-text-secondary">
                <span>{formatSize(file.size)}</span>
                {file.lastModified && (
                  <span>{new Date(file.lastModified).toLocaleDateString('zh-CN')}</span>
                )}
              </div>

              {/* 内联确认 */}
              {confirmKey === file.key && (
                <div className="mt-3 pt-3 border-t border-status-error/30 flex items-center gap-2">
                  <AlertTriangle size={13} className="text-status-error flex-shrink-0" />
                  <span className="text-xs text-status-error flex-1">确认清空日志内容？</span>
                  <button
                    onClick={() => handleClearLog(file.key)}
                    className="px-2.5 py-1 text-xs rounded bg-status-error text-white hover:bg-status-error/80 transition-colors"
                  >
                    确认
                  </button>
                  <button
                    onClick={() => setConfirmKey(null)}
                    className="p-1 rounded text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Log content viewer */}
        {activeLog && (
          <div className="bg-bg-secondary border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-xs font-medium text-text-secondary">{logTypeMap[activeLog]}</span>
              <button onClick={() => setActiveLog(null)} className="text-xs text-text-secondary hover:text-text-primary">
                关闭
              </button>
            </div>
            {loading ? (
              <div className="p-6 text-center text-text-secondary text-sm">加载中...</div>
            ) : (
              <pre className="p-4 text-[12px] font-mono text-text-muted overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap leading-5">
                {logContent}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsPage;
