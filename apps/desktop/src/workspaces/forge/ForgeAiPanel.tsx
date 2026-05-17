import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAiStore, FORGE_SESSION_ID } from '../../core/store/useAiStore';
import { useAiStream } from '../../core/hooks/useAiStream';
import type { AIChatMessage } from '../../core/store/useAiStore';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ForgeAiPanelProps {
  activeFileName?: string;
  activeLanguage?: string;
  getEditorSelection: () => string;      // Reads current Monaco selection
  getEditorContent: () => string;        // Reads full file content (for context)
  insertAtCursor: (text: string) => void; // Splices text into Monaco at cursor
}

// ── Message Bubble ────────────────────────────────────────────────────────────
const ForgeBubble: React.FC<{
  msg: AIChatMessage;
  isStreaming: boolean;
  isLast: boolean;
  onInsert: (code: string) => void;
}> = ({ msg, isStreaming, isLast, onInsert }) => {
  const showCursor = isStreaming && isLast && msg.role === 'assistant';

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-surface-container border border-outline-variant rounded-lg px-sm py-xs">
          <p className="text-body-sm text-on-surface whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  // Parse assistant message — split on code fences
  const parts = msg.content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center gap-xs">
        <span className="material-symbols-outlined text-secondary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
        <span className="text-label-caps text-secondary font-bold">AETHER CORE</span>
        {showCursor && <span className="text-label-caps text-secondary animate-pulse">STREAMING</span>}
      </div>
      <div className="flex flex-col gap-sm">
        {parts.map((part, i) => {
          if (part.startsWith('```')) {
            const lines = part.slice(3, -3).split('\n');
            const lang = lines[0]?.trim() || '';
            const code = lines.slice(lang ? 1 : 0).join('\n').trim();
            return (
              <div key={i} className="rounded border border-outline-variant overflow-hidden bg-surface-container-lowest">
                <div className="flex items-center justify-between px-sm py-xs bg-surface-container border-b border-outline-variant">
                  <span className="text-label-caps text-outline font-code-md">{lang || 'code'}</span>
                  <div className="flex items-center gap-sm">
                    <button
                      onClick={() => navigator.clipboard.writeText(code)}
                      className="text-outline hover:text-on-surface transition-colors flex items-center gap-xs text-label-caps"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                    <button
                      onClick={() => onInsert(code)}
                      className="flex items-center gap-xs text-label-caps text-secondary hover:text-secondary-fixed-dim transition-colors border border-secondary/30 px-xs py-[2px] rounded hover:bg-secondary/10"
                    >
                      <span className="material-symbols-outlined text-[14px]">keyboard_tab</span>
                      Insert
                    </button>
                  </div>
                </div>
                <pre className="px-sm py-xs text-secondary-fixed-dim font-code-md text-[12px] overflow-x-auto leading-relaxed max-h-64">
                  <code>{code}</code>
                </pre>
              </div>
            );
          }
          if (!part.trim()) return null;
          return (
            <p key={i} className="text-body-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
              {part}
            </p>
          );
        })}
        {showCursor && <span className="inline-block w-1.5 h-3.5 bg-secondary animate-pulse rounded-sm" />}
      </div>
    </div>
  );
};

// ── Main ForgeAiPanel ─────────────────────────────────────────────────────────
export const ForgeAiPanel: React.FC<ForgeAiPanelProps> = ({
  activeFileName,
  activeLanguage,
  getEditorSelection,
  getEditorContent,
  insertAtCursor,
}) => {
  const {
    sessions, models, activeModelId, isStreaming, clearForgeSession,
  } = useAiStore();
  const { sendMessage } = useAiStream();
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const session = sessions[FORGE_SESSION_ID];
  const activeModel = models.find(m => m.id === activeModelId);

  // Auto-scroll on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages.length, session?.messages[session?.messages.length - 1]?.content]);

  // Consume any pending AI actions from Forge workspace
  useEffect(() => {
    const pendingPrompt = sessionStorage.getItem('forge_ai_prompt');
    if (pendingPrompt && !isStreaming) {
      sessionStorage.removeItem('forge_ai_prompt');
      setInput(pendingPrompt);
    }
  }, [isStreaming]);

  // ── Build contextual prompt ─────────────────────────────────────────────────
  // Priority: selection → visible content (first 150 lines)
  const buildContextualPrompt = useCallback((userPrompt: string): string => {
    const selection = getEditorSelection().trim();
    const lang = activeLanguage ?? 'code';
    const file = activeFileName ?? 'untitled';

    if (selection) {
      return `File: \`${file}\` (${lang})\n\nSelected code:\n\`\`\`${lang}\n${selection}\n\`\`\`\n\n${userPrompt}`;
    }

    // No selection — inject first 150 lines as context
    const content = getEditorContent();
    const preview = content.split('\n').slice(0, 150).join('\n');
    return `File: \`${file}\` (${lang})\n\nFile context (first 150 lines):\n\`\`\`${lang}\n${preview}\n\`\`\`\n\n${userPrompt}`;
  }, [activeFileName, activeLanguage, getEditorSelection, getEditorContent]);

  const handleSend = useCallback(async (promptOverride?: string) => {
    const raw = (promptOverride ?? input).trim();
    if (!raw || isStreaming || !activeModelId) return;
    setInput('');
    const contextual = buildContextualPrompt(raw);
    await sendMessage(
      FORGE_SESSION_ID,
      contextual,
      activeModelId,
      activeModel?.providerId ?? 'ollama',
    );
  }, [input, isStreaming, activeModelId, activeModel, buildContextualPrompt, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Quick Actions ───────────────────────────────────────────────────────────
  const quickActions = [
    { label: 'Explain', icon: 'auto_awesome',   prompt: 'Explain this code clearly and concisely.' },
    { label: 'Refactor',icon: 'tune',           prompt: 'Refactor this code for clarity, efficiency, and best practices. Show only the improved code.' },
    { label: 'Fix',     icon: 'bug_report',     prompt: 'Identify and fix any bugs, errors, or issues in this code. Explain what was wrong.' },
    { label: 'Docs',    icon: 'description',    prompt: 'Add inline documentation and JSDoc/docstring comments to this code.' },
  ];

  return (
    <div className="flex flex-col h-full bg-surface">

      {/* Header */}
      <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant bg-surface-container-low flex-shrink-0">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          <span className="text-label-caps font-bold text-on-surface">AI ASSISTANT</span>
          {activeFileName && (
            <span className="text-label-caps text-outline font-code-md truncate max-w-[120px]">
              · {activeFileName}
            </span>
          )}
        </div>
        <button
          onClick={clearForgeSession}
          className="material-symbols-outlined text-outline hover:text-error transition-colors text-[16px]"
          title="Clear chat"
        >
          delete_sweep
        </button>
      </div>

      {/* Quick action bar */}
      <div className="flex gap-xs px-md py-xs border-b border-outline-variant flex-shrink-0 bg-surface-container-lowest overflow-x-auto">
        {quickActions.map(action => (
          <button
            key={action.label}
            onClick={() => handleSend(action.prompt)}
            disabled={isStreaming}
            className="flex items-center gap-xs text-label-caps text-outline hover:text-secondary hover:bg-surface-container transition-all px-sm py-xs rounded border border-outline-variant/50 hover:border-secondary/50 whitespace-nowrap disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[14px]">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-md flex flex-col gap-md">
        {(!session || session.messages.length === 0) && (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-xl opacity-50">
            <span className="material-symbols-outlined text-4xl text-outline mb-sm" style={{ fontVariationSettings: "'FILL' 1" }}>code</span>
            <p className="text-body-sm text-outline">
              Ask anything about{' '}
              <span className="text-secondary font-code-md">{activeFileName ?? 'your code'}</span>
            </p>
            <p className="text-label-caps text-outline mt-xs">Select code first for precise context</p>
          </div>
        )}
        {session?.messages.map((msg, i) => (
          <ForgeBubble
            key={msg.id}
            msg={msg}
            isStreaming={isStreaming}
            isLast={i === session.messages.length - 1}
            onInsert={insertAtCursor}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-sm flex-shrink-0 border-t border-outline-variant">
        <div className={`flex gap-xs bg-surface-container border rounded transition-colors duration-200 ${
          isStreaming ? 'border-secondary/50' : 'border-outline-variant focus-within:border-secondary'
        }`}>
          <textarea
            className="flex-1 bg-transparent px-sm py-sm text-body-sm text-on-surface placeholder:text-outline resize-none focus:outline-none h-16 leading-relaxed"
            placeholder={isStreaming ? 'Generating...' : 'Ask about this code... (Enter to send)'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
          />
          <div className="flex flex-col justify-end p-xs gap-xs">
            {isStreaming ? (
              <button
                onClick={() => useAiStore.setState({ isStreaming: false })}
                className="p-xs rounded bg-error/20 text-error hover:bg-error/30 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">stop</span>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="p-xs rounded bg-secondary text-on-secondary hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-default"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
