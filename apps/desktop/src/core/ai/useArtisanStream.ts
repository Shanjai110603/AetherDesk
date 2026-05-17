import { useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { useAiStore, ARTISAN_SESSION_ID } from '../store/useAiStore';
import { ARTISAN_SYSTEM_PROMPT } from './artisanPrompt';
import type { IntelligenceRequest, StreamEvent } from '../hooks/useAiStream';
import { useWorkspaceStore } from '../store/useWorkspaceStore';

export type ArtisanStreamChunk =
  | { type: 'start' }
  | { type: 'meta'; componentName: string }
  | { type: 'code'; content: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export function useArtisanStream() {
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const currentCode = useRef<string>('');
  const lastWriteTime = useRef<number>(0);

  const generateComponent = useCallback(async (
    componentName: string,
    userPrompt: string,
    modelId: string,
    providerId: string,
    onChunk: (chunk: ArtisanStreamChunk) => void
  ) => {
    const { getApiKey, activeArtisanNodeId } = useAiStore.getState();
    const { currentWorkspace } = useWorkspaceStore.getState();
    
    if (!currentWorkspace) {
      onChunk({ type: 'error', error: 'No workspace open.' });
      return;
    }

    const sessionId = ARTISAN_SESSION_ID;
    const eventName = `ai_stream_${sessionId}`;

    if (unlistenRef.current) {
      unlistenRef.current();
    }

    currentCode.current = '';
    onChunk({ type: 'start' });
    onChunk({ type: 'meta', componentName });

    const flushCodeToDisk = async (force: boolean = false) => {
      const now = Date.now();
      if (force || now - lastWriteTime.current > 500) { // Throttle file writes to 500ms
        lastWriteTime.current = now;
        try {
          await invoke('write_scratch_file', {
            componentName,
            code: currentCode.current,
            workspacePath: currentWorkspace.path
          });
        } catch (e) {
          console.error('Failed to write scratch file:', e);
        }
      }
    };

    unlistenRef.current = await listen<StreamEvent>(eventName, async (event) => {
      const payload = event.payload;

      switch (payload.type) {
        case 'token': {
          if (payload.content) {
            currentCode.current += payload.content;
            
            // Clean up markdown fences on the fly if the model ignored instructions
            let cleanCode = currentCode.current;
            if (cleanCode.startsWith('```tsx\n')) cleanCode = cleanCode.slice(7);
            if (cleanCode.startsWith('```javascript\n')) cleanCode = cleanCode.slice(14);
            if (cleanCode.startsWith('```jsx\n')) cleanCode = cleanCode.slice(7);
            if (cleanCode.startsWith('```\n')) cleanCode = cleanCode.slice(4);
            currentCode.current = cleanCode;

            onChunk({ type: 'code', content: currentCode.current });
            await flushCodeToDisk(false);
          }
          break;
        }

        case 'completed': {
          // Final markdown cleanup
          if (currentCode.current.endsWith('```')) {
            currentCode.current = currentCode.current.slice(0, -3);
          }
          onChunk({ type: 'code', content: currentCode.current });
          await flushCodeToDisk(true);

          // Save to generation history
          const store = useAiStore.getState();
          useAiStore.setState({
            artisanGenerationHistory: [
              ...store.artisanGenerationHistory,
              {
                id: crypto.randomUUID(),
                nodeId: activeArtisanNodeId ?? 'canvas',
                prompt: userPrompt,
                componentName,
                code: currentCode.current,
                timestamp: Date.now(),
                version: 1,
              }
            ],
            isStreaming: false
          });

          onChunk({ type: 'done' });
          unlistenRef.current?.();
          unlistenRef.current = null;
          break;
        }

        case 'error': {
          onChunk({ type: 'error', error: payload.message ?? 'Unknown error' });
          useAiStore.setState({ isStreaming: false });
          break;
        }
      }
    });

    const request: IntelligenceRequest = {
      session_id: sessionId,
      model: modelId,
      messages: [
        { role: 'system', content: ARTISAN_SYSTEM_PROMPT },
        { role: 'user', content: `Component Name: ${componentName}\n\nRequirements:\n${userPrompt}` }
      ],
      temperature: 0.7,
    };

    const apiKey = getApiKey(providerId as any) ?? null;
    useAiStore.setState({ isStreaming: true });

    try {
      await invoke('ai_chat_stream', { request, provider: providerId, apiKey });
    } catch (err: any) {
      onChunk({ type: 'error', error: String(err) });
      useAiStore.setState({ isStreaming: false });
    }
  }, []);

  return { generateComponent };
}
