import { useAiStore } from '../store/useAiStore';
import { useAiStream } from '../hooks/useAiStream';
import { platformToolBroker } from './tools/ToolBroker';
import { useSwarmStore } from '../store/useSwarmStore';

export interface AgentLoopState {
  status: 'idle' | 'running' | 'waiting_approval' | 'completed' | 'error';
  currentStep: number;
  maxSteps: number;
  logs: string[];
}

export function useAgentLoop() {
  const { sendMessage } = useAiStream();

  /**
   * Starts an autonomous execution loop.
   * This implements a basic ReAct (Reasoning and Acting) loop.
   */
  const startAutonomousLoop = async (
    objective: string,
    modelId: string,
    providerId: string,
    onStateChange: (state: Partial<AgentLoopState>) => void,
    agentId?: string
  ): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      onStateChange({ status: 'running', currentStep: 0, logs: ['Starting autonomous loop...'] });

      const { newSession } = useAiStore.getState();
      const { personas, addMemoryEntry } = useSwarmStore.getState();
      
      // Always create a new session for delegated tasks to keep reasoning context isolated
      newSession();
      const sessionId = useAiStore.getState().activeSessionId;

      if (!sessionId) {
        onStateChange({ status: 'error', logs: ['Failed to create session'] });
        reject('Failed to create session');
        return;
      }

      const agent = agentId ? personas.find(p => p.id === agentId) : null;
      const personaPrompt = agent ? agent.systemPrompt : 'You are an autonomous AI agent running inside AetherDesk.';
      const activeModelId = agent?.modelId || modelId;

      // System prompt setting up the ReAct pattern
      const systemPrompt = `${personaPrompt}
Your objective is: ${objective}
You have access to tools. To use a tool, you MUST output a JSON block like this:
\`\`\`tool_call
{
  "tool": "search_workspace",
  "args": { "query": "auth component" }
}
\`\`\`
If you have completed the objective, output:
\`\`\`tool_call
{
  "tool": "complete_objective",
  "args": { "summary": "I have finished the task." }
}
\`\`\`
Do not output multiple tool calls at once. Output one tool call, wait for the result, then proceed.`;

      // Wire up the delegate task callback to spawn a sub-loop
      platformToolBroker.onDelegateTask = async (subAgentId: string, subObjective: string) => {
        onStateChange({ logs: [`Delegating to ${subAgentId}: ${subObjective}`] });
        try {
          const result = await startAutonomousLoop(
            subObjective,
            modelId,
            providerId,
            (state) => {
              if (state.logs) {
                onStateChange({ logs: state.logs.map(log => `[${subAgentId}] ${log}`) });
              }
            },
            subAgentId
          );
          onStateChange({ logs: [`Delegation to ${subAgentId} completed.`] });
          return result;
        } catch (e: any) {
          throw new Error(`Sub-agent ${subAgentId} failed: ${e.message || e}`);
        }
      };

      // 1. Send the initial system prompt and objective
      try {
        await sendMessage(sessionId, systemPrompt, activeModelId, providerId);
        if (agent) {
          addMemoryEntry(agent.id, { type: 'observation', content: `Objective received: ${objective}` });
        }
      } catch (e: any) {
        onStateChange({ status: 'error', logs: [`Failed to communicate: ${e.message}`] });
        reject(`Failed to communicate: ${e.message}`);
        return;
      }

      // 2. Loop until complete (max 10 steps to prevent infinite loops)
      const maxSteps = 10;
      for (let step = 1; step <= maxSteps; step++) {
        onStateChange({ currentStep: step });
        
        // Get the last message from the assistant
        const session = useAiStore.getState().sessions[sessionId];
        const lastMsg = session.messages[session.messages.length - 1];

        if (!lastMsg || lastMsg.role !== 'assistant') {
          onStateChange({ logs: [`[Step ${step}] Waiting for assistant response...`] });
          break; // Wait for streaming to finish conceptually
        }

        // 3. Parse for tool calls
        const toolCallMatch = lastMsg.content.match(/```tool_call\s*(\{[\s\S]*?\})\s*```/);
        
        if (toolCallMatch) {
          try {
            const toolReq = JSON.parse(toolCallMatch[1]);
            onStateChange({ logs: [`[Step ${step}] Executing tool: ${toolReq.tool}`] });

            if (toolReq.tool === 'complete_objective') {
              onStateChange({ status: 'completed', logs: [`Objective complete: ${toolReq.args.summary}`] });
              resolve(toolReq.args.summary || 'Task completed with no summary.');
              return;
            }

            if (agent) {
              addMemoryEntry(agent.id, { type: 'decision', content: `Decided to use tool: ${toolReq.tool}` });
            }

            // 4. Route through Tool Broker
            const result = await platformToolBroker.executeTool({ 
              name: toolReq.tool, 
              parameters: toolReq.args,
              execution_id: 'auto-' + Date.now()
            });
            
            if (agent) {
              addMemoryEntry(agent.id, { type: 'tool_result', content: `Tool ${toolReq.tool} executed successfully` });
            }

            // 5. Send result back to model
            const toolResultMsg = `Tool execution result for ${toolReq.tool}:\n${JSON.stringify(result)}`;
            await sendMessage(sessionId, toolResultMsg, activeModelId, providerId);

          } catch (e: any) {
            onStateChange({ logs: [`[Step ${step}] Error: ${e.message}`] });
            // Send error back so agent can correct itself
            await sendMessage(sessionId, `Tool failed: ${e.message}`, activeModelId, providerId);
          }
        } else {
          // No tool call found, perhaps the agent is just reasoning.
          onStateChange({ logs: [`[Step ${step}] Agent reasoned without acting.`] });
          break;
        }
      }

      onStateChange({ status: 'idle', logs: ['Loop paused or max steps reached'] });
      reject('Max steps reached without completion.');
    });
  };

  return { startAutonomousLoop };
}
