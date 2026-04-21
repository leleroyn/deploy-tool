import { Router, Request, Response } from 'express';
import { getProjects, getProject, updateProject, addProject, deleteProject } from '../config/iniManager';
import { requireSystemAdmin } from '../auth';

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
router.put('/:name', requireSystemAdmin, (req: Request, res: Response) => {
  try {
    updateProject(req.params.name, req.body);
    const project = getProject(req.params.name);
    res.json({ success: true, data: project });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects - Only system_admin can create
router.post('/', requireSystemAdmin, (req: Request, res: Response) => {
  try {
    const project = req.body;
    if (!project.name) {
      return res.status(400).json({ success: false, error: '项目名称不能为空' });
    }
    addProject(project);
    res.json({ success: true, data: project });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/projects/:name - Only system_admin can delete
router.delete('/:name', requireSystemAdmin, (req: Request, res: Response) => {
  try {
    deleteProject(req.params.name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
