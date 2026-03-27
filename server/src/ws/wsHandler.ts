import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { onLog, onStatus, getTask } from '../tasks/taskQueue';
import { WsMessage } from '../types';
import { verifyToken } from '../auth';

interface ClientInfo {
  ws: WebSocket;
  taskId?: string;
}

const clients: Set<ClientInfo> = new Set();

export function setupWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    // 校验 token：从 query 参数读取 ?token=xxx
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token') || '';

    if (!verifyToken(token)) {
      ws.close(4401, 'Unauthorized');
      return;
    }

    const clientInfo: ClientInfo = { ws };
    clients.add(clientInfo);

    // 解析订阅的 taskId: /ws?taskId=xxx&token=xxx
    const taskId = url.searchParams.get('taskId');
    if (taskId) {
      clientInfo.taskId = taskId;
      const task = getTask(taskId);
      if (task) {
        send(ws, { type: 'status', taskId, data: task.status });
      }
    }

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && msg.taskId) {
          clientInfo.taskId = msg.taskId;
          const task = getTask(msg.taskId);
          if (task) {
            send(ws, { type: 'status', taskId: msg.taskId, data: task.status });
          }
        }
      } catch {
        // ignore
      }
    });

    ws.on('close', () => {
      clients.delete(clientInfo);
    });

    ws.on('error', () => {
      clients.delete(clientInfo);
    });
  });

  // 监听日志事件，推送给订阅了对应 taskId 的客户端
  onLog((taskId, chunk) => {
    broadcast(taskId, { type: 'log', taskId, data: chunk });
  });

  onStatus((task) => {
    broadcast(task.id, { type: 'status', taskId: task.id, data: task.status });
    if (task.status === 'success' || task.status === 'failed') {
      broadcast(task.id, { type: 'complete', taskId: task.id, data: task.status });
    }
  });
}

function broadcast(taskId: string, message: WsMessage) {
  const payload = JSON.stringify(message);
  clients.forEach(c => {
    if (c.taskId === taskId && c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(payload);
    }
  });
}

function send(ws: WebSocket, message: WsMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}


