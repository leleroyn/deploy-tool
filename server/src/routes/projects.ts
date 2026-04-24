import { Router, Request, Response } from 'express';
import { getProjects, getProject, updateProject, addProject, deleteProject } from '../config/iniManager';
import { requireSystemAdmin } from '../auth';
import { auditService } from '../services/auditService';
import { AuditEventType } from '../types';

const router = Router();

// GET /api/projects - All authenticated users can read
router.get('/', (_req: Request, res: Response) => {
  try {
    const projects = getProjects();
    res.json({ success: true, data: projects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:name - All authenticated users can read
router.get('/:name', (req: Request, res: Response) => {
  try {
    const project = getProject(req.params.name);
    if (!project) {
      return res.status(404).json({ success: false, error: '项目不存在' });
    }
    res.json({ success: true, data: project });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/projects/:name - Only system_admin can modify
router.put('/:name', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    updateProject(req.params.name, req.body);
    await auditService.log(user.id, user.username, AuditEventType.SYS_SETTINGS, req.params.name, '成功', req.ip);
    const project = getProject(req.params.name);
    res.json({ success: true, data: project });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects - Only system_admin can create
router.post('/', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const project = req.body;
    if (!project.name) {
      return res.status(400).json({ success: false, error: '项目名称不能为空' });
    }
    addProject(project);
    await auditService.log(user.id, user.username, AuditEventType.SYS_SETTINGS, project.name, '成功', req.ip);
    res.json({ success: true, data: project });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/projects/:name - Only system_admin can delete
router.delete('/:name', requireSystemAdmin, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    deleteProject(req.params.name);
    await auditService.log(user.id, user.username, AuditEventType.SYS_SETTINGS, req.params.name, '成功', req.ip);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
