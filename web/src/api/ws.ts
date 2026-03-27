import { WsMessage } from '../types';
import { getToken } from './http';

// 通过 Vite 代理走 /ws 路径，不直连 3001
const WS_BASE = `ws://${window.location.host}/ws`;

export function createTaskWs(
  taskId: string,
  onMessage: (msg: WsMessage) => void
): () => void {
  const token = getToken();
  const ws = new WebSocket(`${WS_BASE}?taskId=${taskId}&token=${encodeURIComponent(token)}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data) as WsMessage;
      onMessage(msg);
    } catch {
      // ignore
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error', err);
  };

  return () => {
    ws.close();
  };
}
