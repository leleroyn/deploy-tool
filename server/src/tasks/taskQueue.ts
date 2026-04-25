import { v4 as uuidv4 } from 'uuid';
import { Task, TaskType, TaskStatus } from '../types';
import { runScript } from './scriptRunner';
import { auditService } from '../services/auditService';
import { AuditEventType } from '../types';
import { db } from '../db';

export type LogListener = (taskId: string, chunk: string) => void;
export type StatusListener = (task: Task) => void;

// 单个任务日志最多 2000 条
const MAX_LOG_ENTRIES = 2000;

const tasks: Map<string, Task> = new Map();
const logBuffers: Map<string, string[]> = new Map(); // taskId -> 已发日志缓冲
const logListeners: Set<LogListener> = new Set();
const statusListeners: Set<StatusListener> = new Set();

// 当前正在运行的任务 id
let runningTaskId: string | null = null;
// 等待队列
const queue: string[] = [];

export function onLog(listener: LogListener): () => void {
  logListeners.add(listener);
  return () => logListeners.delete(listener);
}

export function onStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

// Database helpers
function dbInsertTask(id: string, type: string, project: string, status: string, dryRun: number, startTime: string, operatorId: string, operatorName: string, operatorIp: string) {
  db.prepare(`
    INSERT INTO tasks (id, type, project, status, dry_run, start_time, operator_id, operator_name, operator_ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, project, status, dryRun, startTime, operatorId, operatorName, operatorIp);
}

function dbUpdateTask(id: string, status: string, startTime: string, endTime: string | undefined, exitCode: number | undefined) {
  db.prepare(`
    UPDATE tasks SET status = ?, start_time = ?, end_time = ?, exit_code = ? WHERE id = ?
  `).run(status, startTime, endTime, exitCode, id);
}

function dbGetAllTasksSql(): Task[] {
  const rows = db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC`).all();
  return (rows as any[]).map(taskRowToTask);
}

function dbGetTaskSql(id: string): Task | undefined {
  const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(id);
  return row ? taskRowToTask(row as any) : undefined;
}

function dbGetTasksPaginatedSql(limit: number, offset: number): { tasks: Task[]; total: number } {
  const rows = db.prepare(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(limit, offset);
  const totalRow = db.prepare(`SELECT COUNT(*) as total FROM tasks`).get();
  return {
    tasks: (rows as any[]).map(taskRowToTask),
    total: (totalRow as any).total,
  };
}

function dbRecoverTasksSql() {
  const stmt = db.prepare(`UPDATE tasks SET status = ?, exit_code = ? WHERE status = ?`);
  stmt.run('failed', -1, 'running');
  stmt.run('failed', -2, 'pending');
}

function taskRowToTask(row: Record<string, any>): Task {
  return {
    id: row.id,
    type: row.type,
    project: row.project,
    status: row.status,
    dryRun: row.dry_run ? true : false,
    startTime: row.start_time || '',
    endTime: row.end_time,
    exitCode: row.exit_code,
    operatorId: row.operator_id,
    operatorName: row.operator_name,
    operatorIp: row.operator_ip,
  };
}

export function dbGetAllTasks(): Task[] {
  return dbGetAllTasksSql();
}

export function dbGetTask(id: string): Task | undefined {
  return dbGetTaskSql(id);
}

export function dbGetTasksPaginated(limit: number, offset: number): { tasks: Task[]; total: number } {
  return dbGetTasksPaginatedSql(limit, offset);
}

export function dbRecoverTasks() {
  dbRecoverTasksSql();
}

export function dbGetTaskStats(): Record<string, number> {
  const rows = db.prepare(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`).all();
  const stats: Record<string, number> = { pending: 0, running: 0, success: 0, failed: 0 };
  (rows as any[]).forEach((r: any) => { stats[r.status] = r.count; });
  return stats;
}

function emitLog(taskId: string, chunk: string) {
  // 缓冲日志，供后续连接的 WebSocket 回放
  if (!logBuffers.has(taskId)) logBuffers.set(taskId, []);
  const buf = logBuffers.get(taskId)!;
  // 只保留最新日志，防止单个任务日志无限增长
  if (buf.length < MAX_LOG_ENTRIES) {
    buf.push(chunk);
  }
  logListeners.forEach(l => l(taskId, chunk));
}

function emitStatus(task: Task) {
  statusListeners.forEach(l => l(task));
}

function updateTask(task: Task, updates: Partial<Task>): Task {
  const updated = { ...task, ...updates };
  tasks.set(task.id, updated);
  dbUpdateTask(task.id, updated.status, updated.startTime, updated.endTime, updated.exitCode);
  emitStatus(updated);
  return updated;
}

function processNext() {
  if (runningTaskId !== null) return;
  if (queue.length === 0) return;

  const taskId = queue.shift()!;
  const task = tasks.get(taskId);
  if (!task) return processNext();

  runningTaskId = taskId;
  const running = updateTask(task, { status: 'running', startTime: new Date().toISOString() });
  console.log(`[Task] 开始执行: ${task.type} / ${task.project} (id=${taskId})`);

  let scriptName: 'deploy' | 'backup' | 'check-ports' | 'remote';
  let args: string[];
  let env: Record<string, string> | undefined;

  if (task.type === 'deploy') {
    scriptName = 'deploy';
    args = [task.project];
    env = task.dryRun ? { DRY_RUN: '1' } : {};
  } else if (task.type === 'backup') {
    scriptName = 'backup';
    args = [task.project];
    env = {};
  } else if (task.type === 'remote') {
    scriptName = 'remote';
    args = [task.project];
    env = {};
  } else {
    scriptName = 'check-ports';
    args = [task.project];
    env = {};
  }

  runScript({
    script: scriptName,
    args,
    env,
    onData: (chunk) => {
      process.stdout.write(chunk); // 同时打印到后端终端
      emitLog(taskId, chunk);
    },
    onExit: async (code) => {
      console.log(`[Task] 执行完成: ${task.type} / ${task.project} exitCode=${code}`);
      const status: TaskStatus = code === 0 ? 'success' : 'failed';
      updateTask(running, { status, endTime: new Date().toISOString(), exitCode: code });

      // 记录审计日志
      const eventTypeMap: Record<string, string> = {
        'deploy': AuditEventType.DEPLOY,
        'backup': AuditEventType.BACKUP,
        'remote': AuditEventType.REMOTE_CMD,
        'check-ports': AuditEventType.PORT_CHECK
      };
      await auditService.log(
        task.operatorId,
        task.operatorName,
        eventTypeMap[task.type] || task.type,
        task.project,
        status === 'success' ? '成功' : '失败',
        task.operatorIp
      );

      runningTaskId = null;
       processNext();
    },
  });
}

export function createTask(type: TaskType, project: string, operatorId: string, operatorName: string, dryRun = false, operatorIp?: string): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: uuidv4(),
    type,
    project,
    status: 'pending',
    dryRun,
    startTime: now,
    operatorId,
    operatorName,
    operatorIp,
  };
  tasks.set(task.id, task);
  dbInsertTask(task.id, type, project, 'pending', dryRun ? 1 : 0, now, operatorId, operatorName, operatorIp || '');
  queue.push(task.id);
  processNext();
  return task;
}

export function getTask(id: string): Task | undefined {
  // 先查内存（运行时任务），再查数据库（历史任务）
  return tasks.get(id) || dbGetTask(id);
}

export function getAllTasks(): Task[] {
  return dbGetAllTasks();
}

export function getLogBuffer(taskId: string): string[] {
  return logBuffers.get(taskId) ?? [];
}

export function isProjectBusy(project: string): boolean {
  if (runningTaskId !== null) {
    const task = tasks.get(runningTaskId);
    if (task?.project === project || task?.project === 'all') return true;
  }
  // 也检查队列中是否有相同项目
  for (const qId of queue) {
    const qTask = tasks.get(qId);
    if (qTask?.project === project || qTask?.project === 'all') return true;
  }
  return false;
}

export function initTaskQueue() {
  dbRecoverTasks();
}
