import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Play, Loader2, Clock, AlertTriangle, X, Shield } from 'lucide-react';
import { api } from '../api/http';
import { createTaskWs } from '../api/ws';
import { GroupedCommands, CommandHistory, Task, TaskStatus, User } from '../types';

interface CommandHistoryMap {
  [commandName: string]: CommandHistory[];
}

const RemoteMaintenancePage: React.FC = () => {
  const [groupedCommands, setGroupedCommands] = useState<GroupedCommands>({});
  const [loading, setLoading] = useState(true);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<CommandHistoryMap>({});
   const [runningTask, setRunningTask] = useState<Task | null>(null);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isExecuting, setIsExecuting] = useState(false);
   const [terminalOutput, setTerminalOutput] = useState('');
   const [showResults, setShowResults] = useState(false);
   const [currentUser, setCurrentUser] = useState<User | null>(null);
   const terminalRef = useRef<HTMLPreElement>(null);
   const wsCloseRef = useRef<(() => void) | null>(null);


  useEffect(() => {
    loadCurrentUser();
    loadCommands();
    loadHistory();
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  const loadCurrentUser = async () => {
    const res = await api.me();
    if (res.success && res.data) {
      setCurrentUser(res.data);
    }
  };

  const loadCommands = async () => {
    setLoading(true);
    const res = await api.getCommands();
    if (res.success && res.data) {
      setGroupedCommands(res.data);
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    const res = await api.getCommandHistory();
    if (res.success && res.data) {
      const map: CommandHistoryMap = {};
      res.data.forEach(item => {
        if (!map[item.commandName]) {
          map[item.commandName] = [];
        }
        if (map[item.commandName].length < 3) {
          map[item.commandName].push(item);
        }
      });
      setHistoryMap(map);
    }
  };

   const handleExecute = async (commandName: string) => {
     if (isSubmitting || (runningTask !== null && runningTask.project !== commandName)) return;

     setConfirmKey(null);
     setIsSubmitting(true);
     setIsExecuting(true);
     setTerminalOutput(`执行命令: ${commandName}\n`);
     setTerminalOutput(prev => prev + '─'.repeat(40) + '\n');
     setShowResults(true);

     try {
       const res = await api.execCommand(commandName);
       if (!res.success || !res.data) {
         setTerminalOutput(prev => prev + `执行失败: ${res.error}\n`);
         setIsSubmitting(false);
         setIsExecuting(false);
         return;
       }

       const taskId = res.data.id;
       setRunningTask(res.data);

       if (wsCloseRef.current) wsCloseRef.current();
       wsCloseRef.current = createTaskWs(taskId, (msg) => {
         if (msg.type === 'log') {
           setTerminalOutput(prev => prev + msg.data);
         }
         if (msg.type === 'complete' || msg.type === 'status') {
           const status = msg.data as TaskStatus;
           if (status === 'success' || status === 'failed') {
             setRunningTask(null);
             setIsExecuting(false);
             setTimeout(() => loadHistory(), 500);
           }
         }
       });

       // 关键修复：立即同步当前状态，防止极速命令导致的信号丢失
       const checkRes = await api.getTask(taskId);
       if (checkRes.success && checkRes.data) {
         const status = checkRes.data.status;
         if (status === 'success' || status === 'failed') {
           setRunningTask(null);
           setIsExecuting(false);
           setTimeout(() => loadHistory(), 500);
         }
       }

       // 方案 3: 超时兜底 (15秒)
       setTimeout(async () => {
         const retryRes = await api.getTask(taskId);
         if (retryRes.success && retryRes.data) {
           const status = retryRes.data.status;
           if (status === 'success' || status === 'failed') {
             setRunningTask(null);
             setIsExecuting(false);
             setTimeout(() => loadHistory(), 500);
           }
         }
       }, 15000);
     } catch (err) {
       console.error('Execute error:', err);
       setTerminalOutput(prev => prev + `\n\n[错误] 请求执行失败\n`);
       setRunningTask(null);
       setIsExecuting(false);
     } finally {
       setIsSubmitting(false);
     }
   };



  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
      </div>
    );
  }

  const groups = Object.keys(groupedCommands);

  if (groups.length === 0) {
    return (
      <div className="bg-bg-secondary border border-border rounded-xl p-8 text-center">
        <p className="text-text-secondary">暂无远程维护命令配置</p>
        <p className="text-xs text-text-tertiary mt-2">请在 config.toml 中添加 [command.xxx] 配置</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 命令分组卡片 */}
      {groups.map(group => (
        <div key={group} className="bg-bg-secondary border border-border rounded-xl p-6">
          <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {group}
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {groupedCommands[group].map(cmd => (
              <div 
                key={cmd.name} 
                className="bg-bg-tertiary border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-text-primary">{cmd.name}</h3>
                    {currentUser?.role === 'system_admin' && cmd.command && (
                      <p className="text-xs text-text-secondary mt-1 break-all truncate" title={cmd.command}>
                        {cmd.command}
                      </p>
                    )}
                    {currentUser?.role === 'system_admin' && cmd.allowedRoles && cmd.allowedRoles.length > 0 && (() => {
                      const isAllRoles = cmd.allowedRoles.includes('system_admin') && cmd.allowedRoles.includes('ops_admin');
                      const label = isAllRoles
                        ? '允许所有角色'
                        : cmd.allowedRoles.length === 1 && cmd.allowedRoles[0] === 'system_admin'
                          ? '仅 system_admin'
                          : cmd.allowedRoles.join(', ');
                      return (
                        <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] px-1.5 py-0.5 rounded ${isAllRoles ? 'bg-status-warning/10 text-status-warning' : 'bg-primary/10 text-primary'}`}>
                          {isAllRoles ? <AlertTriangle size={10} /> : <Shield size={10} />}
                          {label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* 最近执行记录 */}
                {historyMap[cmd.name] && historyMap[cmd.name].length > 0 && (
                  <div className="mb-3 p-2 bg-bg-secondary rounded border border-border">
                    <div className="flex items-center gap-1 text-[10px] text-text-tertiary mb-1">
                      <Clock size={10} />
                      最近执行
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {historyMap[cmd.name].map((item, idx) => (
                        <span 
                          key={idx}
                          className={`text-[10px] px-1.5 py-0.5 rounded ${
                            item.status === 'success' 
                              ? 'bg-status-success/10 text-status-success' 
                              : 'bg-status-error/10 text-status-error'
                          }`}
                        >
                          {item.status === 'success' ? '✓' : '✗'} {item.time}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">
                    服务器: {cmd.server.join(', ')}
                  </span>
{currentUser && cmd.allowedRoles && !cmd.allowedRoles.includes(currentUser.role) ? (
                    <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-bg-secondary text-text-tertiary text-xs font-medium">
                      <Shield size={12} />
                      权限不足
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmKey(cmd.name)}
                      disabled={isSubmitting || runningTask?.project === cmd.name}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-all disabled:opacity-40"
                    >
                      {isSubmitting || runningTask?.project === cmd.name ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      执行
                    </button>
                  )}


                </div>

                {/* 内联确认（参考日志历史） */}
                {confirmKey === cmd.name && currentUser && cmd.allowedRoles && cmd.allowedRoles.includes(currentUser.role) && (
                  <div className="mt-3 pt-3 border-t border-status-error/30 flex items-center gap-2">
                    <AlertTriangle size={13} className="text-status-error flex-shrink-0" />
                    <span className="text-xs text-status-error flex-1">确认执行此命令？</span>
                    <button
                      onClick={() => handleExecute(cmd.name)}
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
        </div>
      ))}

      {/* 执行结果 */}
      {showResults && (
        <div className="bg-bg-secondary border border-border rounded-xl p-6">
          <h2 className="text-[14px] font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Terminal size={14} />
            执行结果
            {runningTask && runningTask.status === 'running' && (
              <Loader2 size={12} className="animate-spin text-primary" />
            )}
          </h2>
          <pre 
            ref={terminalRef}
            className="bg-bg-tertiary border border-border rounded-lg p-4 text-xs font-mono text-text-primary overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto"
          >
            {terminalOutput || '暂无输出'}
          </pre>
        </div>
      )}
    </div>
  );
};

export default RemoteMaintenancePage;
