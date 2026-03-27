import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalOutputProps {
  onTerminalReady?: (terminal: Terminal) => void;
  className?: string;
  minHeight?: number;
}

const TerminalOutput: React.FC<TerminalOutputProps> = ({
  onTerminalReady,
  className = '',
  minHeight = 300,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0D0D0D',
        foreground: '#E6EDF3',
        cursor: '#4680FF',
        selectionBackground: '#264F78',
        black: '#0D0D0D',
        brightBlack: '#30363D',
        red: '#F85149',
        brightRed: '#FF7B72',
        green: '#3FB950',
        brightGreen: '#56D364',
        yellow: '#D29922',
        brightYellow: '#E3B341',
        blue: '#4680FF',
        brightBlue: '#58A6FF',
        magenta: '#BC8CFF',
        brightMagenta: '#D2A8FF',
        cyan: '#00B5AD',
        brightCyan: '#39C5CF',
        white: '#C9D1D9',
        brightWhite: '#E6EDF3',
      },
      fontFamily: '"Noto Sans Mono", "Cascadia Code", "Consolas", "DejaVu Sans Mono", "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.5,
      scrollback: 5000,
      convertEol: true,
      cursorStyle: 'block',
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    setTimeout(() => fitAddon.fit(), 50);

    termRef.current = term;

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    if (onTerminalReady) {
      onTerminalReady(term);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  return (
    <div
      className={`rounded-lg overflow-hidden border border-border ${className}`}
      style={{ background: '#0D0D0D', minHeight }}
    >
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-bg-secondary">
        <div className="w-3 h-3 rounded-full bg-status-error opacity-80" />
        <div className="w-3 h-3 rounded-full bg-status-warning opacity-80" />
        <div className="w-3 h-3 rounded-full bg-status-success opacity-80" />
        <span className="ml-2 text-xs text-text-secondary font-mono">Terminal Output</span>
      </div>
      <div ref={containerRef} style={{ minHeight: minHeight - 36, padding: '8px' }} />
    </div>
  );
};

export default TerminalOutput;
