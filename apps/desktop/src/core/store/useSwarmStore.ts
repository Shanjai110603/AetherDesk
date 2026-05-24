import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Capability } from '../ai/tools/types';
import { useWorkspaceStore } from './useWorkspaceStore';

// ── Agent Persona ────────────────────────────────────────────────────────────

export interface AgentPersona {
  id: string;
  name: string;
  role: string;
  icon: string;
  iconColor: string;
  systemPrompt: string;
  capabilities: Capability[];
  isActive: boolean;
  modelId?: string; // e.g. 'llama3:8b' or 'claude-3-opus-20240229'
}

export interface AgentMemoryEntry {
  id: string;
  agentId: string;
  type: 'observation' | 'decision' | 'tool_result' | 'reflection';
  content: string;
  timestamp: number;
  metadata?: Record<string, string>;
}

// ── Default Personas ─────────────────────────────────────────────────────────

const DEFAULT_PERSONAS: AgentPersona[] = [
  {
    id: 'architect',
    name: 'Architect',
    role: 'System Architect',
    icon: 'architecture',
    iconColor: 'text-primary',
    systemPrompt: `You are a System Architect agent inside AetherDesk. Your responsibilities:
- Analyze system architecture and propose structural improvements
- Review code organization, module boundaries, and dependency graphs
- Recommend design patterns and architectural decisions
- You have READ_FS access to inspect the codebase. You do NOT modify files directly.`,
    capabilities: ['READ_FS'],
    isActive: true,
  },
  {
    id: 'frontend-engineer',
    name: 'Frontend Engineer',
    role: 'UI/UX Developer',
    icon: 'web',
    iconColor: 'text-secondary',
    systemPrompt: `You are a Frontend Engineer agent inside AetherDesk. Your responsibilities:
- Build and refine React components, styling, and layouts
- Ensure accessibility, responsiveness, and performance
- Work with TypeScript, CSS, and the AetherDesk design system
- You have READ_FS and WRITE_FS access to implement changes.`,
    capabilities: ['READ_FS', 'WRITE_FS'],
    isActive: true,
  },
  {
    id: 'backend-engineer',
    name: 'Backend Engineer',
    role: 'Systems Developer',
    icon: 'dns',
    iconColor: 'text-tertiary',
    systemPrompt: `You are a Backend Engineer agent inside AetherDesk. Your responsibilities:
- Develop Rust backend modules, Tauri commands, and system services
- Manage data persistence, IPC communication, and performance optimization
- You have READ_FS, WRITE_FS, and EXEC_CMD access.`,
    capabilities: ['READ_FS', 'WRITE_FS', 'EXEC_CMD'],
    isActive: true,
  },
  {
    id: 'qa-tester',
    name: 'QA Tester',
    role: 'Quality Assurance',
    icon: 'bug_report',
    iconColor: 'text-error',
    systemPrompt: `You are a QA Tester agent inside AetherDesk. Your responsibilities:
- Review code for bugs, edge cases, and potential regressions
- Write and suggest test cases
- Verify that changes meet requirements and do not break existing functionality
- You have READ_FS access only. You do NOT modify code.`,
    capabilities: ['READ_FS'],
    isActive: true,
  },
  {
    id: 'devops',
    name: 'DevOps',
    role: 'Infrastructure & Deployment',
    icon: 'cloud_upload',
    iconColor: 'text-[#ff9800]',
    systemPrompt: `You are a DevOps agent inside AetherDesk. Your responsibilities:
- Manage build pipelines, CI/CD configuration, and deployment processes
- Monitor system health and optimize infrastructure
- You have READ_FS, EXEC_CMD, and DEPLOYMENT_ACCESS.`,
    capabilities: ['READ_FS', 'EXEC_CMD', 'DEPLOYMENT_ACCESS'],
    isActive: false,
  },
  {
    id: 'research-agent',
    name: 'Research Agent',
    role: 'Knowledge & Analysis',
    icon: 'science',
    iconColor: 'text-[#9c27b0]',
    systemPrompt: `You are a Research Agent inside AetherDesk. Your responsibilities:
- Gather information, analyze documentation, and synthesize findings
- Provide technical research and comparative analysis
- You have READ_FS and INTERNET_ACCESS.`,
    capabilities: ['READ_FS', 'INTERNET_ACCESS'],
    isActive: false,
  },
  {
    id: 'ui-designer',
    name: 'UI Designer',
    role: 'Visual Design',
    icon: 'palette',
    iconColor: 'text-[#e91e63]',
    systemPrompt: `You are a UI Designer agent inside AetherDesk. Your responsibilities:
- Design component layouts, color schemes, and visual hierarchies
- Ensure design consistency with the AetherDesk design system
- Suggest UI/UX improvements based on modern design principles
- You have READ_FS access to inspect existing designs.`,
    capabilities: ['READ_FS'],
    isActive: false,
  },
];

// ── Store ────────────────────────────────────────────────────────────────────

interface SwarmStoreState {
  personas: AgentPersona[];
  memory: Record<string, AgentMemoryEntry[]>; // agentId -> entries
  activeAgentId: string | null;

  // Actions
  setActiveAgent: (agentId: string | null) => void;
  togglePersonaActive: (agentId: string) => void;
  updatePersonaCapability: (agentId: string, capability: Capability, enabled: boolean) => void;
  updatePersonaPrompt: (agentId: string, prompt: string) => void;
  updatePersonaModel: (agentId: string, modelId?: string) => void;

  // Memory
  addMemoryEntry: (agentId: string, entry: Omit<AgentMemoryEntry, 'id' | 'timestamp' | 'agentId'>) => void;
  clearMemory: (agentId: string) => void;
  getMemory: (agentId: string) => AgentMemoryEntry[];

  // Persistence
  saveMemoryToDisk: (agentId: string) => Promise<void>;
  loadMemoryFromDisk: (agentId: string) => Promise<void>;
}

export const useSwarmStore = create<SwarmStoreState>((set, get) => ({
  personas: DEFAULT_PERSONAS,
  memory: {},
  activeAgentId: null,

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  togglePersonaActive: (agentId) => set(state => ({
    personas: state.personas.map(p =>
      p.id === agentId ? { ...p, isActive: !p.isActive } : p
    ),
  })),

  updatePersonaCapability: (agentId, capability, enabled) => set(state => ({
    personas: state.personas.map(p => {
      if (p.id !== agentId) return p;
      const caps = enabled
        ? [...new Set([...p.capabilities, capability])]
        : p.capabilities.filter(c => c !== capability);
      return { ...p, capabilities: caps };
    }),
  })),

  updatePersonaPrompt: (agentId, prompt) => set(state => ({
    personas: state.personas.map(p =>
      p.id === agentId ? { ...p, systemPrompt: prompt } : p
    ),
  })),

  updatePersonaModel: (agentId, modelId) => set(state => ({
    personas: state.personas.map(p =>
      p.id === agentId ? { ...p, modelId } : p
    ),
  })),

  addMemoryEntry: (agentId, entry) => set(state => {
    const existing = state.memory[agentId] || [];
    const newEntry: AgentMemoryEntry = {
      ...entry,
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      agentId,
      timestamp: Date.now(),
    };
    return { memory: { ...state.memory, [agentId]: [...existing, newEntry] } };
  }),

  clearMemory: (agentId) => set(state => ({
    memory: { ...state.memory, [agentId]: [] },
  })),

  getMemory: (agentId) => get().memory[agentId] || [],

  saveMemoryToDisk: async (agentId) => {
    const entries = get().memory[agentId] || [];
    const ws = useWorkspaceStore.getState().currentWorkspace;
    const path = ws ? `${ws.path}/.aether/agent-memory/${agentId}.json` : `.aether/agent-memory/${agentId}.json`;
    try {
      const data = JSON.stringify(entries, null, 2);
      await invoke('fs_write_file', {
        path,
        content: data,
      });
    } catch (err) {
      console.error(`Failed to save memory for agent ${agentId}:`, err);
    }
  },

  loadMemoryFromDisk: async (agentId) => {
    const ws = useWorkspaceStore.getState().currentWorkspace;
    const path = ws ? `${ws.path}/.aether/agent-memory/${agentId}.json` : `.aether/agent-memory/${agentId}.json`;
    try {
      const data = await invoke<string>('fs_read_file', {
        path,
      });
      const entries: AgentMemoryEntry[] = JSON.parse(data);
      set(state => ({ memory: { ...state.memory, [agentId]: entries } }));
    } catch (e) {
      // File doesn't exist yet — that's fine, start with empty memory
    }
  },
}));
