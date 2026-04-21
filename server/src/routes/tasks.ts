import { Router, Request, Response } from 'express';
import { createTask, getTask, getAllTasks, isProjectBusy } from '../tasks/taskQueue';
import { getProjects, getCommand } from '../config/iniManager';

const router = Router();

// POST /api/tasks/deploy
router.post('/deploy', (req: Request, res: Response) => {
  const { project, dryRun } = req.body;
  const user = (req as any).user;
  if (!project) {
    return res.status(400).json({ success: false, error: '缺少项目名称' });
  }
  const projects = getProjects().map(p => p.name);
  if (!projects.includes(project)) {
    return res.status(404).json({ success: false, error: '项目不存在' });
  }
  if (isProjectBusy(project)) {
    return res.status(409).json({ success: false, error: '该项目正在执行中，请稍后再试' });
  }
  const task = createTask('deploy', project, user.id, user.username, !!dryRun);
  res.json({ success: true, data: task });
});

// POST /api/tasks/backup
router.post('/backup', (req: Request, res: Response) => {
  const { project } = req.body;
  const user = (req as any).user;
  if (!project) {
    return res.status(400).json({ success: false, error: '缺少项目名称' });
  }
  if (project !== 'all') {
    const projects = getProjects().map(p => p.name);
    if (!projects.includes(project)) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
  }
  if (isProjectBusy(project)) {
    return res.status(409).json({ success: false, error: '该项目正在执行中，请稍后再试' });
  }
  const task = createTask('backup', project, user.id, user.username);
  res.json({ success: true, data: task });
});

// POST /api/tasks/check-ports
router.post('/check-ports', (req: Request, res: Response) => {
  const { project } = req.body;
  const user = (req as any).user;
  if (!project) {
    return res.status(400).json({ success: false, error: '缺少项目名称' });
  }
  if (project !== 'all') {
    const projects = getProjects().map(p => p.name);
    if (!projects.includes(project)) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
  }
  if (isProjectBusy(project)) {
    return res.status(409).json({ success: false, error: '该项目正在执行中，请稍后再试' });
  }
  const task = createTask('check-ports', project, user.id, user.username);
  res.json({ success: true, data: task });
});

// POST /api/tasks/remote
router.post('/remote', (req: Request, res: Response) => {
  const { commandName } = req.body;
  const user = (req as any).user;
  if (!commandName) {
    return res.status(400).json({ success: false, error: '缺少命令名称' });
  }
  const cmd = getCommand(commandName);
  if (!cmd) {
    return res.status(404).json({ success: false, error: '命令不存在' });
  }
  if (isProjectBusy(commandName)) {
    return res.status(409).json({ success: false, error: '该命令正在执行中，请稍后再试' });
  }
  const task = createTask('remote', commandName, user.id, user.username);
  res.json({ success: true, data: task });
});

// GET /api/tasks
router.get('/', (_req: Request, res: Response) => {
  const tasks = getAllTasks();
  res.json({ success: true, data: tasks });
});

// GET /api/tasks/:id
router.get('/:id', (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, error: '任务不存在' });
  }
  res.json({ success: true, data: task });
});

export default router;
