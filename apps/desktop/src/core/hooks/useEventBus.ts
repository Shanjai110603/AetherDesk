import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export type PlatformEvent = 
  // Workflow Events
  | { type: 'WorkflowStarted'; payload: { workflow_id: string } }
  | { type: 'NodeQueued'; payload: { node_id: string } }
  | { type: 'NodeRunning'; payload: { node_id: string } }
  | { type: 'NodeCompleted'; payload: { node_id: string; result: string } }
  | { type: 'NodeError'; payload: { node_id: string; error: string } }
  | { type: 'WorkflowFinished'; payload: { workflow_id: string } }
  
  // Agent Events
  | { type: 'AgentSpawned'; payload: { agent_id: string; role: string } }
  | { type: 'AgentStep'; payload: { agent_id: string; step_type: string } }
  | { type: 'AgentCompleted'; payload: { agent_id: string } }

  // Workspace Events
  | { type: 'WorkspaceIndexed'; payload: { path: string } }
  | { type: 'FileModified'; payload: { path: string } }

  // Tool/Sandbox Events
  | { type: 'ToolExecutionRequested'; payload: { tool_name: string; execution_id: string } }
  | { type: 'ToolExecutionCompleted'; payload: { tool_name: string; execution_id: string; success: boolean } };


export function useEventBus(onEvent: (event: PlatformEvent) => void) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<PlatformEvent>('platform-event', (event) => {
        onEvent(event.payload);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [onEvent]);
}
