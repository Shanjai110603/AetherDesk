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

  startRuntime: (workspacePath: string, command: string) => Promise<void>;
  stopRuntime: () => Promise<void>;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

export const useRuntimeStore = create<RuntimeStoreState>((set, get) => ({
  status: 'idle',
  port: null,
  pid: null,
  sessionId: 'runtime-1',
  logs: [],
  previewUrl: null,

  startRuntime: async (workspacePath, command) => {
    const { sessionId } = get();
    set({ status: 'starting', logs: [] });
    get().addLog({ type: 'system', message: `▶ Starting: ${command}` });

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
    get().addLog({ type: 'system', message: '⏹ Runtime stopped.' });
    set({ status: 'stopped', pid: null, previewUrl: null });
  },

  addLog: (log) => {
    const entry: LogEntry = { ...log, id: Math.random().toString(36), timestamp: Date.now() };
    set(state => ({ logs: [...state.logs.slice(-500), entry] })); // keep last 500
  },

  clearLogs: () => set({ logs: [] }),
}));
