import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { createTaskWs } from '../api/ws';
import { WsMessage, TaskStatus } from '../types';

export function useTaskWs(
  taskId: string | null,
  terminal: Terminal | null,
  onStatusChange?: (status: TaskStatus) => void
) {
  const closeRef = useRef<(() => void) | null>(null);

  const connect = useCallback((id: string) => {
    if (closeRef.current) {
      closeRef.current();
      closeRef.current = null;
    }

    const close = createTaskWs(id, (msg: WsMessage) => {
      if (msg.type === 'log' && terminal) {
        terminal.write(msg.data);
      }
      if ((msg.type === 'status' || msg.type === 'complete') && onStatusChange) {
        onStatusChange(msg.data as TaskStatus);
      }
    });

    closeRef.current = close;
  }, [terminal, onStatusChange]);

  useEffect(() => {
    if (taskId && terminal) {
      connect(taskId);
    }
    return () => {
      if (closeRef.current) closeRef.current();
    };
  }, [taskId, terminal]);
}

export function useTerminal(containerRef: React.RefObject<HTMLDivElement>) {
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0D0D0D',
        foreground: '#E6EDF3',
        cursor: '#4680FF',
        selectionBackground: '#264F78',
      },
      fontFamily: '"Noto Sans Mono", "Cascadia Code", "Consolas", "DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.5,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [containerRef]);

  const clear = useCallback(() => {
    termRef.current?.clear();
  }, []);

  const write = useCallback((text: string) => {
    termRef.current?.write(text);
  }, []);

  return { terminal: termRef.current, clear, write, fitAddon: fitAddonRef.current };
}
