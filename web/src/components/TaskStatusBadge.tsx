import React from 'react';
import { TaskStatus } from '../types';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  showLabel?: boolean;
}

const config: Record<TaskStatus, { color: string; dot: string; label: string }> = {
  pending: {
    color: 'text-text-secondary bg-bg-tertiary border-border',
    dot: 'bg-text-secondary',
    label: '等待中',
  },
  running: {
    color: 'text-primary-light bg-primary/10 border-primary/30',
    dot: 'bg-primary-light animate-pulse',
    label: '执行中',
  },
  success: {
    color: 'text-status-success bg-status-success/10 border-status-success/30',
    dot: 'bg-status-success',
    label: '成功',
  },
  failed: {
    color: 'text-status-error bg-status-error/10 border-status-error/30',
    dot: 'bg-status-error',
    label: '失败',
  },
};

const TaskStatusBadge: React.FC<TaskStatusBadgeProps> = ({ status, showLabel = true }) => {
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {showLabel && c.label}
    </span>
  );
};

export default TaskStatusBadge;
