import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Archive, Radio, RefreshCw, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import ProjectCard from '../components/ProjectCard';
import TaskStatusBadge from '../components/TaskStatusBadge';
import { Task } from '../types';

const taskTypeLabel: Record<string, string> = {
  deploy: '部署',
  backup: '备份',
  'check-ports': '端口检测',
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projects, tasks, loadProjects, loadTasks, checkHealth } = useAppStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkHealth();
    loadProjects();
    loadTasks();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([loadProjects(), loadTasks(), checkHealth()]);
    setLoading(false);
  };

  const recentTasks = tasks.slice(0, 10);

  const stats = {
    total: projects.length,
    success: tasks.filter(t => t.status === 'success').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    running: tasks.filter(t => t.status === 'running').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '项目总数', value: stats.total, icon: Activity, color: 'text-primary-light', bg: 'bg-primary/10', border: 'border-primary/20' },
          { label: '执行中', value: stats.running, icon: Clock, color: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/20' },
          { label: '成功任务', value: stats.success, icon: CheckCircle, color: 'text-status-success', bg: 'bg-status-success/10', border: 'border-status-success/20' },
          { label: '失败任务', value: stats.failed, icon: XCircle, color: 'text-status-error', bg: 'bg-status-error/10', border: 'border-status-error/20' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-xl border ${stat.border} ${stat.bg} p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-lg ${stat.bg} border ${stat.border} flex items-center justify-center`}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
              <p className="text-xs text-text-secondary">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-primary-light inline-block" />
            项目列表
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/ports')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-tertiary border border-border transition-all"
            >
              <Radio size={12} />
              端口检测
            </button>
            <button
              onClick={handleRefresh}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary bg-bg-secondary hover:bg-bg-tertiary border border-border transition-all ${loading ? 'opacity-60' : ''}`}
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              刷新
            </button>
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 text-text-secondary">
            <Activity size={40} className="mx-auto mb-3 opacity-30" />
            <p>暂无项目配置</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard key={project.name} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2 mb-4">
          <span className="w-1 h-4 rounded-full bg-primary-cyan inline-block" />
          快捷操作
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: '一键部署', desc: '选择项目进行部署', icon: Rocket, to: '/deploy', color: 'from-primary/20 to-primary/5 border-primary/30 hover:border-primary/60', iconColor: 'text-primary-light' },
            { label: '项目备份', desc: '备份全部或单个项目', icon: Archive, to: '/backup', color: 'from-primary-cyan/20 to-primary-cyan/5 border-primary-cyan/30 hover:border-primary-cyan/60', iconColor: 'text-primary-cyan' },
            { label: '端口检测', desc: '检查服务端口状态', icon: Radio, to: '/ports', color: 'from-status-success/20 to-status-success/5 border-status-success/30 hover:border-status-success/60', iconColor: 'text-status-success' },
          ].map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.to)}
              className={`flex items-center gap-4 p-4 rounded-xl border bg-gradient-to-br ${action.color} text-left transition-all duration-200 hover:translate-y-[-1px]`}
            >
              <div className="w-10 h-10 rounded-lg bg-white border border-border/60 flex items-center justify-center shadow-sm">
                <action.icon size={20} className={action.iconColor} />
              </div>
              <div>
                <p className="text-text-primary font-medium text-sm">{action.label}</p>
                <p className="text-text-secondary text-xs mt-0.5">{action.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-status-warning inline-block" />
            最近任务
          </h2>
          <button
            onClick={() => navigate('/logs')}
            className="text-xs text-primary-light hover:text-primary transition-colors"
          >
            查看全部 →
          </button>
        </div>

        {recentTasks.length === 0 ? (
          <div className="text-center py-8 text-text-secondary bg-bg-secondary rounded-xl border border-border">
            <p className="text-sm">暂无任务记录</p>
          </div>
        ) : (
          <div className="bg-bg-secondary rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">类型</th>
                  <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">项目</th>
                  <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">状态</th>
                  <th className="text-left px-4 py-3 text-xs text-text-secondary font-medium">时间</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task: Task, idx) => (
                  <tr
                    key={task.id}
                    className={`border-b border-border/50 hover:bg-bg-tertiary transition-colors ${idx === recentTasks.length - 1 ? 'border-0' : ''}`}
                  >
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {taskTypeLabel[task.type] || task.type}
                      {task.dryRun && <span className="ml-1.5 text-[10px] text-status-warning bg-status-warning/10 px-1 rounded">DRY</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-text-primary">{task.project}</span>
                    </td>
                    <td className="px-4 py-3">
                      <TaskStatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-secondary font-mono">
                      {new Date(task.startTime).toLocaleString('zh-CN', { hour12: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
