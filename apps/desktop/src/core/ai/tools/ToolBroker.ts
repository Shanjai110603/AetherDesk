import { invoke } from '@tauri-apps/api/core';
import type { ToolCall, ToolResult, IToolHandler, Capability } from './types';

// Built-in basic tools
const fsReadTool: IToolHandler = {
  schema: {
    name: 'fs_read',
    description: 'Read the contents of a file at the given absolute path.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path']
    },
    requiredCapabilities: ['READ_FS'],
    isDestructive: false
  },
  execute: async (params) => {
    try {
      const content = await invoke<string>('fs_read_file', { path: params.path });
      return { success: true, payload: content };
    } catch (e: any) {
      return { success: false, error: e.toString() };
    }
  }
};

const fsWriteTool: IToolHandler = {
  schema: {
    name: 'fs_write',
    description: 'Write content to a file at the given absolute path. Overwrites the file if it exists.',
    parameters: {
      type: 'object',
      properties: { 
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content']
    },
    requiredCapabilities: ['WRITE_FS'],
    isDestructive: true // Require user approval to overwrite files
  },
  execute: async (params) => {
    try {
      if (typeof params.path !== 'string' || typeof params.content !== 'string') {
        return { success: false, error: 'path and content must be strings' };
      }
      await invoke('fs_write_file', { path: params.path, content: params.content });
      return { success: true, payload: `Successfully wrote to ${params.path}` };
    } catch (e: any) {
      return { success: false, error: e.toString() };
    }
  }
};

const execCmdTool: IToolHandler = {
  schema: {
    name: 'execute_terminal',
    description: 'Execute a terminal command.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command']
    },
    requiredCapabilities: ['EXEC_CMD'],
    isDestructive: true // Triggers approval UX
  },
  execute: async (params) => {
    try {
      if (typeof params.command !== 'string') {
        return { success: false, error: 'Command must be a string' };
      }
      const output = await invoke<string>('execute_sandboxed_command', { command: params.command });
      return { success: true, payload: output };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};

const semanticQueryTool: IToolHandler = {
  schema: {
    name: 'semantic_query',
    description: 'Query the semantic intelligence engine for symbols (functions, classes, structs) in the workspace.',
    parameters: {
      type: 'object',
      properties: { 
        query: { type: 'string' }
      },
      required: ['query']
    },
    requiredCapabilities: ['READ_FS'],
    isDestructive: false
  },
  execute: async (params) => {
    try {
      if (typeof params.query !== 'string') {
        return { success: false, error: 'Query must be a string' };
      }
      
      const results = await invoke<any[]>('semantic_query_symbols', { query: params.query });
      return { success: true, payload: results };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};

const delegateTaskTool: IToolHandler = {
  schema: {
    name: 'delegate_task',
    description: 'Delegate a sub-task to another specialized agent persona.',
    parameters: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'The ID of the agent persona to delegate to (e.g., frontend-engineer, qa-tester).' },
        objective: { type: 'string', description: 'The specific task or objective for the delegated agent.' }
      },
      required: ['agentId', 'objective']
    },
    requiredCapabilities: ['WORKFLOW_EXECUTION'],
    isDestructive: false
  },
  execute: async (params, context: any) => {
    if (typeof params.agentId !== 'string' || typeof params.objective !== 'string') {
      return { success: false, error: 'agentId and objective must be strings' };
    }
    if (context.onDelegateTask) {
      try {
        const result = await context.onDelegateTask(params.agentId, params.objective);
        return { success: true, payload: result };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    return { success: false, error: 'Task delegation is not supported in this context.' };
  }
};

export class ToolBroker {
  private handlers: Map<string, IToolHandler> = new Map();
  // Mock capabilities for now (In real architecture, these are passed per-agent)
  private activeCapabilities: Set<Capability> = new Set(['READ_FS', 'WORKFLOW_EXECUTION']);
  
  // UX Approval Callback (Injected by React)
  public onRequestApproval?: (toolName: string, commandDetails: Record<string, unknown>) => Promise<boolean>;
  
  // Delegation Callback (Injected by React/AgentLoop)
  public onDelegateTask?: (agentId: string, objective: string) => Promise<string>;

  constructor() {
    this.register(fsReadTool);
    this.register(fsWriteTool);
    this.register(execCmdTool);
    this.register(semanticQueryTool);
    this.register(delegateTaskTool);
  }

  register(handler: IToolHandler) {
    this.handlers.set(handler.schema.name, handler);
  }

  setCapabilities(caps: Capability[]) {
    this.activeCapabilities = new Set(caps);
  }

  async executeTool(call: ToolCall): Promise<ToolResult> {
    const handler = this.handlers.get(call.name);
    if (!handler) {
      return { success: false, error: `Tool ${call.name} not found.` };
    }

    // 1. Check Capabilities
    for (const cap of handler.schema.requiredCapabilities) {
      if (!this.activeCapabilities.has(cap)) {
        return { success: false, error: `Agent lacks required capability: ${cap}` };
      }
    }

    // 2. UX Approval for Destructive actions
    if (handler.schema.isDestructive && this.onRequestApproval) {
      const approved = await this.onRequestApproval(call.name, call.parameters);
      if (!approved) {
        return { success: false, error: `User denied execution of tool: ${call.name}` };
      }
    }

    // 3. Execute
    try {
      const context = { onDelegateTask: this.onDelegateTask };
      const result = await handler.execute(call.parameters, context);
      return result;
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// Global Singleton
export const platformToolBroker = new ToolBroker();
