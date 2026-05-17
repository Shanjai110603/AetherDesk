export type Capability = 
  | 'READ_FS'
  | 'WRITE_FS'
  | 'EXEC_CMD'
  | 'INTERNET_ACCESS'
  | 'BROWSER_CONTROL'
  | 'DEPLOYMENT_ACCESS'
  | 'WORKFLOW_EXECUTION'
  | 'SYSTEM_AUTOMATION';

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
  requiredCapabilities: Capability[];
  isDestructive: boolean;
}

export interface ToolResult {
  success: boolean;
  payload?: unknown;
  error?: string;
}

export interface ToolCall {
  execution_id: string;
  name: string;
  parameters: Record<string, unknown>;
}

export interface IToolHandler {
  schema: ToolSchema;
  execute(params: Record<string, unknown>, context: unknown): Promise<ToolResult>;
}
