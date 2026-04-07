import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { setupWebSocket } from './ws/wsHandler';
import { authMiddleware } from './auth';
import authRouter from './routes/auth';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import logsRouter from './routes/logs';
import sshRouter from './routes/ssh';
import deployRouter from './routes/deploy';
import commandsRouter from './routes/commands';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 请求日志（过滤敏感字段）
app.use((req, _res, next) => {
  const sensitivePaths = ['/api/auth', '/api/ssh-config'];
  const isSensitive = sensitivePaths.some(p => req.path.startsWith(p));

  if (isSensitive) {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path} [sensitive body omitted]`);
  } else {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`, req.body && Object.keys(req.body).length ? req.body : '');
  }
  next();
});

// 健康检查（不需要登录）
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } });
});

// 登录/登出（不需要登录）
app.use('/api/auth', authRouter);

// 以下路由需要登录
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/tasks', authMiddleware, tasksRouter);
app.use('/api/logs', authMiddleware, logsRouter);
app.use('/api/ssh-config', authMiddleware, sshRouter);
app.use('/api/deploy', authMiddleware, deployRouter);
app.use('/api/commands', authMiddleware, commandsRouter);

const server = http.createServer(app);
setupWebSocket(server);

// 托管前端静态文件（生产模式下）
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));
// SPA fallback：非 API 路由一律返回 index.html
app.get(/^(?!\/api|\/ws).*/, (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Deploy Tool Server running on http://localhost:${PORT}`);
});

// 全局错误处理中间件（放在所有路由之后）
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ success: false, error: '服务器内部错误' });
});

// 全局未捕获异常处理（防止进程静默崩溃）
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]', reason);
});

export default app;

