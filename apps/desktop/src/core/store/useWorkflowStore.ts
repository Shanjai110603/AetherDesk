import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// ── Types ────────────────────────────────────────────────────────────────────

export type NodeCategory = 'trigger' | 'ai' | 'execution' | 'integration' | 'logic';

export interface WorkflowPort {
  id: string;
  label: string;
  type: 'input' | 'output';
}

export interface WorkflowNode {
  id: string;
  type: string; // The template ID (e.g. 'local_llm')
  category: NodeCategory;
  label: string;
  icon: string;
  iconColor: string;
  x: number;
  y: number;
  width: number;
  ports: WorkflowPort[];
  config: Record<string, string>;
  status?: 'idle' | 'running' | 'success' | 'error'; // Execution status
  output?: string; // Execution output
}

export type EdgeCondition = 'always' | 'success' | 'error';

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  active: boolean;
  condition: EdgeCondition;
  isFlowing?: boolean; // True when data is actively flowing through this edge
}

export interface ExecutionStep {
  id: string;
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startMs: number;
  durationMs: number;
}

// ── Node Library Definitions ─────────────────────────────────────────────────

export interface NodeTemplate {
  type: string;
  label: string;
  category: NodeCategory;
  icon: string;
  iconColor: string;
  defaultConfig: Record<string, string>;
  ports: WorkflowPort[];
}

export const NODE_LIBRARY: NodeTemplate[] = [
  // Triggers
  {
    type: 'cron', label: 'Cron Schedule', category: 'trigger',
    icon: 'schedule', iconColor: 'text-secondary-fixed-dim',
    defaultConfig: { interval: '15m' },
    ports: [{ id: 'out', label: 'Output', type: 'output' }],
  },
  {
    type: 'webhook', label: 'HTTP Webhook', category: 'trigger',
    icon: 'webhook', iconColor: 'text-secondary-fixed-dim',
    defaultConfig: { method: 'POST', path: '/hook' },
    ports: [{ id: 'out', label: 'Output', type: 'output' }],
  },
  {
    type: 'file_watch', label: 'File Watcher', category: 'trigger',
    icon: 'folder_open', iconColor: 'text-secondary-fixed-dim',
    defaultConfig: { path: './', pattern: '*.json' },
    ports: [{ id: 'out', label: 'Output', type: 'output' }],
  },
  // AI Orchestration
  {
    type: 'agent', label: 'Autonomous Agent', category: 'ai',
    icon: 'smart_toy', iconColor: 'text-primary',
    defaultConfig: { role: 'Planner', model: 'llama3:8b', system_prompt: 'You are a Planner agent. Break down the task into subtasks.' },
    ports: [{ id: 'in', label: 'Task Input', type: 'input' }, { id: 'out', label: 'Result', type: 'output' }, { id: 'tools', label: 'Tool Output', type: 'output' }],
  },
  {
    type: 'llm_prompt', label: 'LLM Prompt', category: 'ai',
    icon: 'psychology', iconColor: 'text-primary',
    defaultConfig: { model: 'llama3:8b', prompt: '', temperature: '0.7' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }, { id: 'err', label: 'Error', type: 'output' }],
  },
  {
    type: 'json_transform', label: 'JSON Transformer', category: 'ai',
    icon: 'data_object', iconColor: 'text-primary',
    defaultConfig: { expression: '$.data' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }],
  },
  {
    type: 'classifier', label: 'AI Classifier', category: 'ai',
    icon: 'category', iconColor: 'text-primary',
    defaultConfig: { labels: 'positive,negative,neutral' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }],
  },
  // Execution
  {
    type: 'python', label: 'Python Script', category: 'execution',
    icon: 'code', iconColor: 'text-tertiary',
    defaultConfig: { script: 'print("hello")' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }],
  },
  {
    type: 'bash', label: 'Bash Execute', category: 'execution',
    icon: 'terminal', iconColor: 'text-tertiary',
    defaultConfig: { command: 'echo ok' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }],
  },
  // Integration
  {
    type: 'discord', label: 'Discord Webhook', category: 'integration',
    icon: 'forum', iconColor: 'text-secondary',
    defaultConfig: { channel: '#ops-stream', webhookUrl: '' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }],
  },
  {
    type: 'http_request', label: 'HTTP Request', category: 'integration',
    icon: 'language', iconColor: 'text-secondary',
    defaultConfig: { method: 'GET', url: 'https://' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }],
  },
  // Logic
  {
    type: 'condition', label: 'If/Else', category: 'logic',
    icon: 'call_split', iconColor: 'text-error',
    defaultConfig: { expression: 'data.status === "ok"' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'true', label: 'True', type: 'output' }, { id: 'false', label: 'False', type: 'output' }],
  },
  {
    type: 'merge', label: 'Merge', category: 'logic',
    icon: 'merge', iconColor: 'text-error',
    defaultConfig: {},
    ports: [{ id: 'in1', label: 'Input 1', type: 'input' }, { id: 'in2', label: 'Input 2', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }],
  },
];

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  trigger: 'Triggers',
  ai: 'AI Orchestration',
  execution: 'Execution',
  integration: 'Integration',
  logic: 'Logic & Flow',
};

// ── Store ────────────────────────────────────────────────────────────────────

interface WorkflowStoreState {
  // Canvas
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  canvasOffset: { x: number; y: number };
  canvasZoom: number;
  draggingEdge: { sourceNodeId: string; sourcePortId: string; cursorX: number; cursorY: number } | null;

  // Execution
  executionSteps: ExecutionStep[];
  isExecuting: boolean;

  // Actions
  addNode: (template: NodeTemplate, x: number, y: number) => void;
  moveNode: (nodeId: string, x: number, y: number) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: Omit<WorkflowEdge, 'id'>) => void;
  removeEdge: (edgeId: string) => void;
  updateNodeConfig: (nodeId: string, key: string, value: string) => void;
  updateEdgeCondition: (edgeId: string, condition: EdgeCondition) => void;
  setEdgeFlowing: (edgeId: string, flowing: boolean) => void;
  panCanvas: (dx: number, dy: number) => void;
  zoomCanvas: (delta: number) => void;

  // Edge Dragging
  startEdgeDrag: (sourceNodeId: string, sourcePortId: string, cursorX: number, cursorY: number) => void;
  updateEdgeDrag: (cursorX: number, cursorY: number) => void;
  completeEdgeDrag: (targetNodeId: string, targetPortId: string) => void;
  cancelEdgeDrag: () => void;

  // Execution
  executeWorkflow: () => Promise<void>;
  updateNodeStatus: (nodeId: string, status: 'idle' | 'running' | 'success' | 'error') => void;
  updateNodeOutput: (nodeId: string, output: string) => void;
  resetEdgeFlows: () => void;
}

// Demo default nodes
const defaultNodes: WorkflowNode[] = [
  {
    id: 'node-1', type: 'cron', label: 'Trigger', category: 'trigger',
    icon: 'schedule', iconColor: 'text-secondary-fixed-dim',
    x: 80, y: 120, width: 200,
    config: { interval: '15m' },
    ports: [{ id: 'out', label: 'Output', type: 'output' }],
  },
  {
    id: 'node-2', type: 'llm_prompt', label: 'OpenAI Orchestrator', category: 'ai',
    icon: 'psychology', iconColor: 'text-primary',
    x: 420, y: 200, width: 260,
    config: { model: 'gpt-4-turbo', prompt: 'Summarize the latest system logs and format as Discord markdown...', temperature: '0.7' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }, { id: 'err', label: 'Error', type: 'output' }],
  },
  {
    id: 'node-3', type: 'discord', label: 'Discord Webhook', category: 'integration',
    icon: 'forum', iconColor: 'text-secondary',
    x: 820, y: 350, width: 200,
    config: { channel: '#ops-stream' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }],
  },
  {
    id: 'node-4', type: 'http_request', label: 'Backup API', category: 'integration',
    icon: 'language', iconColor: 'text-secondary',
    x: 820, y: 140, width: 200,
    config: { method: 'POST', url: 'https://backup.api/store' },
    ports: [{ id: 'in', label: 'Input', type: 'input' }, { id: 'out', label: 'Output', type: 'output' }],
  },
];

const defaultEdges: WorkflowEdge[] = [
  { id: 'edge-1', sourceNodeId: 'node-1', sourcePortId: 'out', targetNodeId: 'node-2', targetPortId: 'in', active: true, condition: 'always' },
  { id: 'edge-2', sourceNodeId: 'node-2', sourcePortId: 'out', targetNodeId: 'node-3', targetPortId: 'in', active: true, condition: 'success' },
  { id: 'edge-3', sourceNodeId: 'node-2', sourcePortId: 'err', targetNodeId: 'node-4', targetPortId: 'in', active: false, condition: 'error' },
];

const defaultSteps: ExecutionStep[] = [
  { id: 'step-1', nodeId: 'node-1', status: 'completed', startMs: 0, durationMs: 120 },
  { id: 'step-2', nodeId: 'node-2', status: 'completed', startMs: 120, durationMs: 2400 },
  { id: 'step-3', nodeId: 'node-3', status: 'completed', startMs: 2520, durationMs: 80 },
];

export const useWorkflowStore = create<WorkflowStoreState>((set, get) => ({
  nodes: defaultNodes,
  edges: defaultEdges,
  selectedNodeId: 'node-2',
  selectedEdgeId: null,
  canvasOffset: { x: 0, y: 0 },
  canvasZoom: 1,
  draggingEdge: null,
  executionSteps: defaultSteps,
  isExecuting: false,

  addNode: (template, x, y) => {
    const id = `node-${Date.now()}`;
    const node: WorkflowNode = {
      id, type: template.type, label: template.label, category: template.category,
      icon: template.icon, iconColor: template.iconColor,
      x, y, width: 220,
      config: { ...template.defaultConfig },
      ports: template.ports.map(p => ({ ...p })),
    };
    set(state => ({ nodes: [...state.nodes, node], selectedNodeId: id }));
  },

  moveNode: (nodeId, x, y) => set(state => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, x, y } : n),
  })),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId, selectedEdgeId: null }),
  selectEdge: (edgeId) => set({ selectedEdgeId: edgeId, selectedNodeId: null }),

  removeNode: (nodeId) => set(state => ({
    nodes: state.nodes.filter(n => n.id !== nodeId),
    edges: state.edges.filter(e => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
    selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
  })),

  addEdge: (edge) => {
    const id = `edge-${Date.now()}`;
    set(state => ({ edges: [...state.edges, { ...edge, id }] }));
  },

  removeEdge: (edgeId) => set(state => ({
    edges: state.edges.filter(e => e.id !== edgeId),
  })),

  updateNodeConfig: (nodeId, key, value) => set(state => ({
    nodes: state.nodes.map(n =>
      n.id === nodeId ? { ...n, config: { ...n.config, [key]: value } } : n
    ),
  })),

  updateEdgeCondition: (edgeId, condition) => set(state => ({
    edges: state.edges.map(e => e.id === edgeId ? { ...e, condition } : e),
  })),

  setEdgeFlowing: (edgeId, flowing) => set(state => ({
    edges: state.edges.map(e => e.id === edgeId ? { ...e, isFlowing: flowing } : e),
  })),

  panCanvas: (dx, dy) => set(state => ({
    canvasOffset: { x: state.canvasOffset.x + dx, y: state.canvasOffset.y + dy },
  })),

  zoomCanvas: (delta) => set(state => ({
    canvasZoom: Math.max(0.3, Math.min(2, state.canvasZoom + delta)),
  })),

  startEdgeDrag: (sourceNodeId, sourcePortId, cursorX, cursorY) => set({
    draggingEdge: { sourceNodeId, sourcePortId, cursorX, cursorY },
  }),

  updateEdgeDrag: (cursorX, cursorY) => set(state => ({
    draggingEdge: state.draggingEdge ? { ...state.draggingEdge, cursorX, cursorY } : null,
  })),

  completeEdgeDrag: (targetNodeId, targetPortId) => set(state => {
    if (!state.draggingEdge) return state;
    // Auto-detect condition based on source port
    const sourcePort = state.draggingEdge.sourcePortId;
    const condition: EdgeCondition = sourcePort === 'err' ? 'error' : sourcePort === 'true' ? 'success' : sourcePort === 'false' ? 'error' : 'always';
    const newEdge: WorkflowEdge = {
      id: `edge-${Date.now()}`,
      sourceNodeId: state.draggingEdge.sourceNodeId,
      sourcePortId: state.draggingEdge.sourcePortId,
      targetNodeId,
      targetPortId,
      active: true,
      condition,
    };
    return { edges: [...state.edges, newEdge], draggingEdge: null };
  }),

  cancelEdgeDrag: () => set({ draggingEdge: null }),

  executeWorkflow: async () => {
    const { nodes, edges } = get();
    set({ isExecuting: true, executionSteps: [] });
    // Reset all node statuses and edge flows
    set(state => ({
      nodes: state.nodes.map(n => ({ ...n, status: 'idle', output: undefined })),
      edges: state.edges.map(e => ({ ...e, isFlowing: false }))
    }));

    try {
      await invoke('execute_workflow', { graph: { nodes, edges } });
    } catch (err) {
      console.error('Workflow execution failed:', err);
      set({ isExecuting: false });
    }
  },

  updateNodeStatus: (nodeId, status) => set(state => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, status } : n)
  })),

  updateNodeOutput: (nodeId, output) => set(state => ({
    nodes: state.nodes.map(n => n.id === nodeId ? { ...n, output } : n)
  })),

  resetEdgeFlows: () => set(state => ({
    edges: state.edges.map(e => ({ ...e, isFlowing: false }))
  })),
}));

import type { PlatformEvent } from '../hooks/useEventBus';

// Setup global listener for execution events
let isListening = false;
export async function setupWorkflowEvents() {
  if (isListening) return;
  isListening = true;

  await listen<PlatformEvent>('workflow-event', (event) => {
    const payload = event.payload;
    const store = useWorkflowStore.getState();

    switch (payload.type) {
      case 'WorkflowStarted':
        useWorkflowStore.setState({ isExecuting: true, executionSteps: [] });
        store.resetEdgeFlows();
        break;
      case 'NodeRunning': {
        const nodeId = payload.payload.node_id;
        store.updateNodeStatus(nodeId, 'running');
        // Activate incoming edges to show data flow into this node
        const { edges } = useWorkflowStore.getState();
        edges.filter(e => e.targetNodeId === nodeId).forEach(e => {
          store.setEdgeFlowing(e.id, true);
        });
        // Add to timeline
        useWorkflowStore.setState(s => ({
          executionSteps: [...s.executionSteps, {
            id: `step-${Date.now()}`,
            nodeId,
            startMs: Date.now(),
            durationMs: 0,
            status: 'running'
          }]
        }));
        break;
      }
      case 'NodeCompleted': {
        const nodeId = payload.payload.node_id;
        store.updateNodeStatus(nodeId, 'success');
        if (payload.payload.result) {
          store.updateNodeOutput(nodeId, payload.payload.result);
        }
        // Stop incoming edge flows, activate outgoing edges
        const { edges: edgesNow } = useWorkflowStore.getState();
        edgesNow.filter(e => e.targetNodeId === nodeId).forEach(e => {
          store.setEdgeFlowing(e.id, false);
        });
        // Activate outgoing edges that match the 'success' or 'always' condition
        edgesNow.filter(e => e.sourceNodeId === nodeId && (e.condition === 'success' || e.condition === 'always')).forEach(e => {
          store.setEdgeFlowing(e.id, true);
        });
        // Update timeline step duration
        useWorkflowStore.setState(s => ({
          executionSteps: s.executionSteps.map(step =>
            step.nodeId === nodeId && step.status === 'running'
              ? { ...step, status: 'completed', durationMs: Date.now() - step.startMs }
              : step
          )
        }));
        break;
      }
      case 'NodeError': {
        const nodeId = payload.payload.node_id;
        store.updateNodeStatus(nodeId, 'error');
        // Stop incoming edge flows, activate error outgoing edges
        const { edges: edgesErr } = useWorkflowStore.getState();
        edgesErr.filter(e => e.targetNodeId === nodeId).forEach(e => {
          store.setEdgeFlowing(e.id, false);
        });
        edgesErr.filter(e => e.sourceNodeId === nodeId && (e.condition === 'error' || e.condition === 'always')).forEach(e => {
          store.setEdgeFlowing(e.id, true);
        });
        // Update timeline step
        useWorkflowStore.setState(s => ({
          executionSteps: s.executionSteps.map(step =>
            step.nodeId === nodeId && step.status === 'running'
              ? { ...step, status: 'error', durationMs: Date.now() - step.startMs }
              : step
          )
        }));
        break;
      }
      case 'WorkflowFinished':
        useWorkflowStore.setState({ isExecuting: false });
        // Reset all edge flows after a short delay so user sees the final state
        setTimeout(() => store.resetEdgeFlows(), 2000);
        break;
    }
  });
}

