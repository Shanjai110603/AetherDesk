import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type RuntimeStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopped';

export interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'system' | 'info';
  message: string;
  timestamp: number;
}

interface RuntimeStoreState {
  status: RuntimeStatus;
  port: number | null;
  pid: number | null;
  sessionId: string;
  logs: LogEntry[];
  previewUrl: string | null;

  isTerminalActive: boolean;
  terminalLogs: LogEntry[];

  startRuntime: (workspacePath: string, command: string) => Promise<void>;
  stopRuntime: () => Promise<void>;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;

  spawnTerminal: (workspacePath: string) => Promise<void>;
  sendTerminalInput: (input: string) => Promise<void>;
  addTerminalLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearTerminalLogs: () => void;
}

export const useRuntimeStore = create<RuntimeStoreState>((set, get) => ({
  status: 'idle',
  port: null,
  pid: null,
  sessionId: 'runtime-1',
  logs: [],
  previewUrl: null,

  isTerminalActive: false,
  terminalLogs: [],

  startRuntime: async (workspacePath, command) => {
    const { sessionId } = get();
    set({ status: 'starting' });
    get().addLog({ type: 'system', message: `▶ Starting dev server: ${command}` });

    try {
      const result = await invoke<{ running: boolean; pid: number | null; port: number | null }>('runtime_start', {
        workspacePath,
        command,
        sessionId,
      });

      set({
        status: result.running ? 'running' : 'error',
        pid: result.pid,
        port: result.port,
        previewUrl: result.port ? `http://localhost:${result.port}` : null,
      });
    } catch (err) {
      const msg = String(err);
      get().addLog({ type: 'stderr', message: `✗ ${msg}` });
      set({ status: 'error' });
    }
  },

  stopRuntime: async () => {
    const { sessionId } = get();
    try {
      await invoke('runtime_stop', { sessionId });
    } catch (_) {}
    get().addLog({ type: 'system', message: '⏹ Dev server stopped.' });
    set({ status: 'stopped', pid: null, previewUrl: null });
  },

  addLog: (log) => {
    const entry: LogEntry = { ...log, id: Math.random().toString(36), timestamp: Date.now() };
    set(state => ({ logs: [...state.logs.slice(-500), entry] }));
  },

  clearLogs: () => set({ logs: [] }),

  spawnTerminal: async (workspacePath) => {
    set({ isTerminalActive: true });
    try {
      await invoke('terminal_spawn', {
        workspacePath,
        sessionId: 'interactive-terminal',
      });
    } catch (err) {
      const msg = String(err);
      get().addTerminalLog({ type: 'stderr', message: `Terminal initialization failed: ${msg}` });
    }
  },

  sendTerminalInput: async (input) => {
    try {
      await invoke('terminal_send_input', {
        sessionId: 'interactive-terminal',
        input,
      });
    } catch (err) {
      const msg = String(err);
      get().addTerminalLog({ type: 'stderr', message: `Terminal input failed: ${msg}` });
    }
  },

  addTerminalLog: (log) => {
    const entry: LogEntry = { ...log, id: Math.random().toString(36), timestamp: Date.now() };
    set(state => ({ terminalLogs: [...state.terminalLogs.slice(-1000), entry] }));
  },

  clearTerminalLogs: () => set({ terminalLogs: [] }),
}));
