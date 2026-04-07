import { v4 as uuidv4 } from 'uuid';
import { Task, TaskType, TaskStatus } from '../types';
import { runScript } from './scriptRunner';

export type LogListener = (taskId: string, chunk: string) => void;
export type StatusListener = (task: Task) => void;

// 限制：最多保留 100 条任务记录，单个任务日志最多 2000 条
const MAX_TASKS = 100;
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
  emitStatus(updated);
  return updated;
}

// 清理最旧的任务，保留最近 100 条
function pruneOldTasks() {
  if (tasks.size <= MAX_TASKS) return;

  const completed: [string, Task][] = [];
  tasks.forEach((t, id) => {
    if (t.status === 'success' || t.status === 'failed') {
      completed.push([id, t]);
    }
  });

  // 按开始时间排序，删除最旧的
  completed.sort((a, b) => new Date(a[1].startTime).getTime() - new Date(b[1].startTime).getTime());

  const toDelete = tasks.size - MAX_TASKS;
  for (let i = 0; i < toDelete && i < completed.length; i++) {
    const [id] = completed[i];
    tasks.delete(id);
    logBuffers.delete(id);
  }
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
    onExit: (code) => {
      console.log(`[Task] 执行完成: ${task.type} / ${task.project} exitCode=${code}`);
      const status: TaskStatus = code === 0 ? 'success' : 'failed';
      updateTask(running, { status, endTime: new Date().toISOString(), exitCode: code });
      runningTaskId = null;
      pruneOldTasks();
      processNext();
    },
  });
}

export function createTask(type: TaskType, project: string, dryRun = false): Task {
  const task: Task = {
    id: uuidv4(),
    type,
    project,
    status: 'pending',
    dryRun,
    startTime: new Date().toISOString(),
  };
  tasks.set(task.id, task);
  queue.push(task.id);
  processNext();
  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function getLogBuffer(taskId: string): string[] {
  return logBuffers.get(taskId) ?? [];
}

export function getAllTasks(): Task[] {
  return Array.from(tasks.values()).sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
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
