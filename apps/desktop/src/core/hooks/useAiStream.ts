import { useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { useAiStore } from '../store/useAiStore';
import type { AIChatMessage } from '../store/useAiStore';
import { useCostStore } from '../store/useCostStore';
import { useRouterStore } from '../store/useRouterStore';

// ── Normalized stream event types (mirrors Rust StreamEvent enum) ─────────────
export interface StreamEvent {
  type: 'token' | 'started' | 'completed' | 'telemetry' | 'error';
  content?: string;
  model?: string;
  total_tokens?: number;
  prompt_tokens?: number;
  finish_reason?: string;
  inference_ms?: number;
  tokens_per_sec?: number;
  code?: string;
  message?: string;
}

// ── Canonical AetherDesk Intelligence Request ─────────────────────────────────
export interface IntelligenceRequest {
  session_id: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  // Future fields (reserved for agent/tool/workflow expansion)
  tools?: unknown[];
  workflow_context?: string;
  runtime_context?: string;
}

export function useAiStream() {
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const sendMessage = useCallback(async (
    sessionId: string,
    userContent: string,
    modelId?: string,
    providerId?: string,
  ) => {
    const { sessions, addMessage, getApiKey, models } = useAiStore.getState();
    const session = sessions[sessionId];
    if (!session) return;

    let finalModelId = modelId;
    let finalProviderId = providerId;

    if (!finalModelId || !finalProviderId) {
      try {
        const { selectBestModel } = useRouterStore.getState();
        const context = {
          taskType: userContent.includes('calculate') ? 'formatting' : 'generic',
          costSensitivity: 'standard',
          targetLatency: 'normal',
          contextSize: userContent.length,
        };
        finalModelId = await selectBestModel(context as any);
        const matchedModel = models.find(m => m.id === finalModelId);
        finalProviderId = matchedModel ? matchedModel.providerId : 'ollama';
      } catch {
        finalModelId = finalModelId || useAiStore.getState().activeModelId || 'llama3:8b';
        const matchedModel = models.find(m => m.id === finalModelId);
        finalProviderId = finalProviderId || (matchedModel ? matchedModel.providerId : 'ollama');
      }
    }

    // 1. Add the user message immediately
    const userMsg: AIChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    };
    addMessage(sessionId, userMsg);

    // 2. Create a streaming placeholder for the assistant reply
    const assistantMsg: AIChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(sessionId, assistantMsg);
    const assistantMsgId = assistantMsg.id;

    // 3. Subscribe to the session's event channel
    const eventName = `ai_stream_${sessionId}`;
    if (unlistenRef.current) {
      unlistenRef.current();
    }

    unlistenRef.current = await listen<StreamEvent>(eventName, (event) => {
      const payload = event.payload;
      const store = useAiStore.getState();

      switch (payload.type) {
        case 'token': {
          if (!payload.content) break;
          const currentSession = store.sessions[sessionId];
          if (!currentSession) break;
          const updated = currentSession.messages.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: m.content + payload.content }
              : m
          );
          useAiStore.setState({
            sessions: {
              ...store.sessions,
              [sessionId]: { ...currentSession, messages: updated }
            }
          });
          break;
        }

        case 'telemetry': {
          useAiStore.setState({
            lastTelemetry: {
              inference_ms: payload.inference_ms ?? 0,
              tokens_per_sec: payload.tokens_per_sec ?? 0,
              provider: finalProviderId,
              model: finalModelId,
            }
          });
          // ── Record cost telemetry ───────────────────────────────────
          if (payload.total_tokens != null && payload.prompt_tokens != null) {
            const inputToks = payload.prompt_tokens;
            const outputToks = payload.total_tokens - payload.prompt_tokens;
            // Rough cost estimate; real prices should come from model metadata
            const costPer1kIn  = finalModelId.includes('gpt-4') ? 0.03 : finalModelId.includes('gpt-3') ? 0.002 : 0.0001;
            const costPer1kOut = finalModelId.includes('gpt-4') ? 0.06 : finalModelId.includes('gpt-3') ? 0.002 : 0.0001;
            const costUsd = (inputToks / 1000) * costPer1kIn + (outputToks / 1000) * costPer1kOut;
            useCostStore.getState().recordTokens({
              sessionId,
              providerId: finalProviderId,
              modelId: finalModelId,
              inputTokens: inputToks,
              outputTokens: outputToks,
              costUsd,
              timestamp: Date.now(),
            });
          }
          break;
        }

        case 'completed': {
          useAiStore.setState({ isStreaming: false });
          unlistenRef.current?.();
          unlistenRef.current = null;
          break;
        }

        case 'error': {
          console.error(`[AetherDesk Intelligence] Stream error from ${finalProviderId}:`, payload.message);
          // Surface the error in the chat as a system message
          const errSession = store.sessions[sessionId];
          if (errSession) {
            const errUpdated = errSession.messages.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: `⚠️ **Error:** ${payload.message ?? 'Unknown error from AI provider.'}` }
                : m
            );
            useAiStore.setState({
              sessions: {
                ...store.sessions,
                [sessionId]: { ...errSession, messages: errUpdated }
              }
            });
          }
          useAiStore.setState({ isStreaming: false });
          break;
        }
      }
    });

    // 4. Construct the canonical intelligence request
    let finalUserContent = userContent;
    let contextSymbols: Array<{ name: string; kind: string; file_path: string; snippet: string }> | undefined;

    // Lightweight heuristic for RAG trigger
    const lowerContent = userContent.toLowerCase();
    if (lowerContent.includes('@workspace') || 
        lowerContent.includes('how does') || 
        lowerContent.includes('where is') || 
        lowerContent.includes('what is') || 
        lowerContent.includes('explain')) {
      
      try {
        // We import the tool broker dynamically or just use invoke directly since we are in a hook
        const results = await invoke<any[]>('semantic_query_symbols', { query: userContent });
        
        if (results && results.length > 0) {
          contextSymbols = results.slice(0, 5); // Take top 5 to avoid blowing up context window
          
          let contextString = `\n\n=== WORKSPACE SEMANTIC CONTEXT ===\nThe following symbols were retrieved from the workspace AST based on your query:\n\n`;
          contextSymbols.forEach(sym => {
            contextString += `--- Symbol: ${sym.name} (${sym.kind}) ---\nFile: ${sym.file_path}\n\`\`\`\n${sym.snippet}\n\`\`\`\n\n`;
          });
          contextString += `Please use this context to answer the user's question accurately.\n====================================\n`;
          
          finalUserContent = userContent + contextString;

          // Update the user message in the UI to attach the context symbols (for the Symbol Reference UI)
          useAiStore.setState(state => {
            const currentSession = state.sessions[sessionId];
            if (!currentSession) return state;
            const updated = currentSession.messages.map(m =>
              m.id === userMsg.id ? { ...m, contextSymbols: contextSymbols } : m
            );
            return { sessions: { ...state.sessions, [sessionId]: { ...currentSession, messages: updated } } };
          });
        }
      } catch (err) {
        console.warn("Semantic RAG failed:", err);
      }
    }

    const historyMessages = session.messages
      .filter(m => m.content.length > 0)
      .map(m => ({ role: m.role, content: m.content }));

    const request: IntelligenceRequest = {
      session_id: sessionId,
      model: finalModelId,
      messages: [...historyMessages, { role: 'user', content: finalUserContent }],
      temperature: 0.7,
    };

    // 5. Look up the API key for cloud providers (transient in-memory only)
    const apiKey = getApiKey(finalProviderId as any) ?? null;

    // 6. Dispatch to Rust unified intelligence router
    useAiStore.setState({ isStreaming: true });
    try {
      await invoke('ai_chat_stream', {
        request,
        provider: finalProviderId,
        apiKey,
      });
    } catch (err: any) {
      console.error('[AetherDesk Intelligence] invoke failed:', err);
      const store = useAiStore.getState();
      const errSession = store.sessions[sessionId];
      if (errSession) {
        const errMsg = errSession.messages.map(m =>
          m.id === assistantMsgId
            ? { ...m, content: `⚠️ **Failed to connect:** ${String(err)}` }
            : m
        );
        useAiStore.setState({
          sessions: {
            ...store.sessions,
            [sessionId]: { ...errSession, messages: errMsg }
          }
        });
      }
      useAiStore.setState({ isStreaming: false });
    }
  }, []);

  useEffect(() => {
    return () => { unlistenRef.current?.(); };
  }, []);

  return { sendMessage };
}
