// Vitest test setup — mock the Tauri IPC bridge so tests run in Node/jsdom
// without a real Tauri runtime. All invoke() calls become controllable stubs.
import { vi } from 'vitest';

const keychain: Record<string, string> = {};
const agentMemory: Record<string, unknown> = {};

// ── Mock @tauri-apps/api/core (invoke) ────────────────────────────────────────
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    // Keychain stubs
    if (cmd === 'store_secret') {
      keychain[args!.key as string] = args!.secret as string;
      return;
    }
    if (cmd === 'retrieve_secret') {
      const val = keychain[args!.key as string];
      if (!val) throw new Error('not found');
      return val;
    }
    if (cmd === 'delete_secret') {
      delete keychain[args!.key as string];
      return;
    }
    // Filesystem stubs
    if (cmd === 'fs_read_file') return '// stub file content';
    if (cmd === 'fs_write_file') return { success: true };
    // Agent memory stubs
    if (cmd === 'read_agent_memory') {
      return agentMemory[args!.agent_id as string] ?? { agentId: args!.agent_id, facts: [], history: [] };
    }
    if (cmd === 'write_agent_memory') {
      agentMemory[(args!.memory as any).agentId] = args!.memory;
      return;
    }
    // Workflow stubs
    if (cmd === 'execute_workflow') return { success: true, nodeResults: {} };
    if (cmd === 'ai_chat_stream') return;

    console.warn(`[test-mock] Unhandled invoke: ${cmd}`, args);
    return null;
  }),
}));

// ── Mock @tauri-apps/plugin-store (used by persistence.ts) ───────────────────
vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(async () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    has: vi.fn(async () => false),
    entries: vi.fn(async () => []),
    keys: vi.fn(async () => []),
    values: vi.fn(async () => []),
    length: vi.fn(async () => 0),
    onKeyChange: vi.fn(() => () => {}),
    onChange: vi.fn(() => () => {}),
  })),
  Store: vi.fn().mockImplementation(() => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    save: vi.fn(async () => {}),
  })),
}));

// ── Mock @tauri-apps/plugin-dialog ────────────────────────────────────────────
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(async () => null),
  save: vi.fn(async () => null),
  message: vi.fn(async () => {}),
  ask: vi.fn(async () => true),
  confirm: vi.fn(async () => true),
}));

// ── Reset stateful mocks between tests ───────────────────────────────────────
beforeEach(() => {
  Object.keys(keychain).forEach(k => delete keychain[k]);
  Object.keys(agentMemory).forEach(k => delete agentMemory[k]);
});

