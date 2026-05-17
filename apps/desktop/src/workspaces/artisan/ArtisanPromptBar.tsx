import React, { useState, useEffect, useRef } from 'react';
import { useArtisanStream } from '../../core/ai/useArtisanStream';
import { useAiStore } from '../../core/store/useAiStore';
import type { ArtisanStreamChunk } from '../../core/ai/useArtisanStream';

export const ArtisanPromptBar: React.FC<{
  onStartGeneration: (name: string) => void;
  onCodeUpdate: (code: string) => void;
  onDone: () => void;
}> = ({ onStartGeneration, onCodeUpdate, onDone }) => {
  const [prompt, setPrompt] = useState('');
  const { isStreaming, models, activeModelId, setActiveModel } = useAiStore();
  const { generateComponent } = useArtisanStream();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [prompt]);

  // Consume pending artisan prompts from AI Components / AI Actions
  useEffect(() => {
    const check = () => {
      const pending = sessionStorage.getItem('artisan_prompt');
      if (pending && !isStreaming) {
        sessionStorage.removeItem('artisan_prompt');
        setPrompt(pending);
        textareaRef.current?.focus();
      }
    };
    check();
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isStreaming || !activeModelId) return;

    // Create a generic component name for scratch (could be extracted from prompt by an LLM, but we'll use a standard one for now)
    const componentName = 'GeneratedComponent'; 
    const model = models.find(m => m.id === activeModelId);

    if (!model) return;

    setPrompt('');
    onStartGeneration(componentName);

    await generateComponent(
      componentName,
      prompt,
      model.id,
      model.providerId,
      (chunk: ArtisanStreamChunk) => {
        if (chunk.type === 'code') {
          onCodeUpdate(chunk.content);
        } else if (chunk.type === 'done') {
          onDone();
        } else if (chunk.type === 'error') {
          console.error('Artisan generation error:', chunk.error);
          onDone();
        }
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <div className="absolute bottom-xl left-1/2 -translate-x-1/2 w-[600px] bg-surface-container-highest/90 backdrop-blur-md border border-outline-variant/50 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-sm flex flex-col gap-sm z-50 transition-all">
      <div className="flex gap-sm">
        <textarea
          ref={textareaRef}
          data-artisan-prompt
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "Generating component..." : "What do you want to build? (e.g., 'A modern pricing card')"}
          disabled={isStreaming}
          className="flex-1 bg-transparent resize-none overflow-y-auto text-body-sm text-on-surface placeholder:text-outline p-xs focus:outline-none min-h-[40px] max-h-[120px] leading-relaxed"
          rows={1}
        />
        <div className="flex flex-col justify-end">
          {isStreaming ? (
            <button
              onClick={() => useAiStore.setState({ isStreaming: false })}
              className="p-xs rounded-lg bg-error/20 text-error hover:bg-error/30 transition-colors w-10 h-10 flex items-center justify-center"
              title="Stop Generation"
            >
              <span className="material-symbols-outlined text-[20px]">stop</span>
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim()}
              className="p-xs rounded-lg bg-secondary text-on-secondary hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed w-10 h-10 flex items-center justify-center"
              title="Generate (Enter)"
            >
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Footer controls */}
      <div className="flex items-center justify-between border-t border-outline-variant/30 pt-xs mt-xs">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-outline text-[16px]">tune</span>
          <select
            className="bg-transparent text-label-caps text-on-surface-variant focus:outline-none cursor-pointer"
            value={activeModelId ?? ''}
            onChange={e => setActiveModel(e.target.value)}
          >
            {models.map(m => (
              <option key={m.id} value={m.id} className="bg-surface-container text-on-surface">
                {m.name} ({m.isLocal ? 'Local' : 'Cloud'})
              </option>
            ))}
          </select>
        </div>
        <span className="text-[10px] text-outline font-label-caps tracking-widest">
          AETHER ARTISAN V1
        </span>
      </div>
    </div>
  );
};
