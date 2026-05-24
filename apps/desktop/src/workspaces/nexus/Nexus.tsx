import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NexusSlashPalette } from './NexusSlashPalette';
import { NexusMentionPalette } from './NexusMentionPalette';
import { NEXUS_SLASH_COMMANDS, type SlashCommand } from './nexusCommands';
import { useAiStore } from '../../core/store/useAiStore';
import type { AIChatMessage } from '../../core/store/useAiStore';
import { useAiStream } from '../../core/hooks/useAiStream';
import { useAgentLoop, type AgentLoopState } from '../../core/ai/useAgentLoop';
import { AgentApprovalOverlay } from './AgentApprovalOverlay';
import { invoke } from '@tauri-apps/api/core';
import { onAnnotation, type AnnotationEventDetail } from '../../core/events/aetherDeskEvents';
import { useFilesystemStore, type FileNode } from '../../core/store/useFilesystemStore';
import { useSwarmStore } from '../../core/store/useSwarmStore';

interface StagedFileContext {
  path: string;
  name: string;
  content: string;
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap(node => node.is_dir ? flattenFiles(node.children ?? []) : [node]);
}

// ── Message Bubble ────────────────────────────────────────────────────────────
const MessageBubble: React.FC<{ msg: AIChatMessage; isStreaming: boolean; isLast: boolean }> = ({ msg, isStreaming, isLast }) => {
  if (msg.role === 'user') {
    // We strip the hidden semantic context from the UI display
    const displayContent = msg.content.split('\n\n=== WORKSPACE SEMANTIC CONTEXT ===')[0];
    
    return (
      <div className="flex flex-col items-end gap-xs">
        <div style={{ maxWidth: '80%' }} className="bg-surface-container-highest rounded-2xl rounded-tr-sm p-3 border border-outline-variant/40">
          <p className="text-[14px] text-on-surface whitespace-pre-wrap leading-relaxed">{displayContent}</p>
        </div>
        {msg.contextSymbols && msg.contextSymbols.length > 0 && (
          <div className="flex flex-col gap-1 items-end mt-1 max-w-[80%]">
            <span className="text-[10px] text-secondary font-bold uppercase tracking-widest flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px]">account_tree</span>
              Workspace Context Attached
            </span>
            <div className="flex flex-wrap gap-1 justify-end">
              {msg.contextSymbols.map((sym, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-surface-container-low border border-outline-variant/30 rounded px-2 py-1" title={sym.file_path}>
                  <span className="material-symbols-outlined text-[12px] text-outline">
                    {sym.kind.toLowerCase() === 'function' ? 'function' : sym.kind.toLowerCase() === 'class' ? 'data_object' : 'code'}
                  </span>
                  <span className="text-[10px] text-outline-variant font-mono">{sym.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  const showCursor = isStreaming && isLast && msg.role === 'assistant';
  const parts = msg.content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-lg bg-secondary/20 border border-secondary/30 flex items-center justify-center flex-shrink-0 mt-1">
        <span className="material-symbols-outlined text-secondary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-secondary-fixed-dim tracking-widest">AETHER CORE</span>
          {showCursor && <span className="text-[10px] text-secondary animate-pulse">STREAMING…</span>}
        </div>
        <div className="bg-surface-container-low border border-outline-variant/50 rounded-xl rounded-tl-sm p-3 flex flex-col gap-3">
          {parts.map((part, i) => {
            if (part.startsWith('```')) {
              const lines = part.slice(3, -3).split('\n');
              const lang = lines[0]?.trim() || '';
              const code = lines.slice(lang ? 1 : 0).join('\n');
              return (
                <div key={i} className="bg-surface-container-highest rounded-lg border border-outline-variant/40 overflow-hidden">
                  <div className="bg-surface-container-low px-3 py-1 border-b border-outline-variant/40 flex justify-between items-center">
                    <span className="text-[10px] text-outline font-mono">{lang || 'code'}</span>
                    <button className="flex items-center gap-1 text-outline hover:text-on-surface transition-colors" onClick={() => navigator.clipboard.writeText(code)}>
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                      <span className="text-[10px]">Copy</span>
                    </button>
                  </div>
                  <pre className="p-3 text-secondary-fixed-dim font-mono text-[13px] overflow-x-auto leading-relaxed"><code>{code}</code></pre>
                </div>
              );
            }
            if (!part.trim()) return null;
            return <p key={i} className="text-[14px] leading-relaxed text-on-surface whitespace-pre-wrap">{part}</p>;
          })}
          {showCursor && <span className="inline-block w-2 h-4 bg-secondary animate-pulse rounded-sm" />}
        </div>
      </div>
    </div>
  );
};

// ── Nexus ─────────────────────────────────────────────────────────────────────
const ContextChip: React.FC<{ icon: string; color: string; label: string; onRemove: () => void }> = ({
  icon,
  color,
  label,
  onRemove,
}) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '5px 8px',
    maxWidth: 280,
    background: `${color}14`,
    border: `1px solid ${color}40`,
    borderRadius: 8,
  }}>
    <span className="material-symbols-outlined" style={{ fontSize: 14, color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
    <span style={{ fontSize: 11, fontWeight: 600, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    <button
      onClick={onRemove}
      style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
      title="Remove context"
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
    </button>
  </div>
);

export const Nexus: React.FC = () => {
  const { models, activeModelId, sessions, activeSessionId, isStreaming, lastTelemetry, newSession } = useAiStore();
  const { sendMessage } = useAiStream();
  const { startAutonomousLoop } = useAgentLoop();
  const { fileTree } = useFilesystemStore();
  const { personas } = useSwarmStore();
  const [input, setInput] = useState('');
  const [slashMode, setSlashMode] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [mentionMode, setMentionMode] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFileContext[]>([]);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [showTempSlider, setShowTempSlider] = useState(false);
  // ── Agent Mode ──────────────────────────────────────────────────────────────
  const [agentMode, setAgentMode] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);
  const [agentLoopState, setAgentLoopState] = useState<AgentLoopState>({
    status: 'idle',
    currentStep: 0,
    maxSteps: 10,
    logs: [],
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeModel = models.find(m => m.id === activeModelId);
  const activeSession = activeSessionId ? sessions[activeSessionId] : null;
  const sessionList = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);
  const flatFiles = flattenFiles(fileTree);
  const slashCommands = NEXUS_SLASH_COMMANDS;

  // ── Staged Annotation (from Forge Preview) ────────────────────────────────
  const [stagedAnnotation, setStagedAnnotation] = useState<AnnotationEventDetail | null>(null);

  useEffect(() => {
    return onAnnotation((detail) => {
      setStagedAnnotation(detail);
    });
  }, []);

  // Detect slash trigger in input
  useEffect(() => {
    if (isStreaming) {
      setSlashMode(false);
      return;
    }
    const slashMatch = input.match(/(?:^|\s)\/([\w]*)$/);
    if (slashMatch) {
      setSlashMode(true);
      setSlashQuery(slashMatch[1] ?? '');
    } else {
      setSlashMode(false);
    }

    const mentionMatch = input.match(/(?:^|\s)@([\w.\-]*)$/);
    if (mentionMatch) {
      setMentionMode(true);
      setMentionQuery(mentionMatch[1] ?? '');
    } else {
      setMentionMode(false);
    }
  }, [input, isStreaming]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages.length, activeSession?.messages[activeSession?.messages.length - 1]?.content]);

  useEffect(() => {
    const pendingPrompt = sessionStorage.getItem('nexus_prompt');
    if (pendingPrompt && !isStreaming) {
      sessionStorage.removeItem('nexus_prompt');
      setInput(pendingPrompt);
    }
  }, [isStreaming]);

  const clearActiveSession = () => {
    if (!activeSessionId) return;
    useAiStore.setState(state => ({
      sessions: {
        ...state.sessions,
        [activeSessionId]: {
          ...state.sessions[activeSessionId],
          messages: [],
          title: 'New Session',
          updatedAt: Date.now(),
        },
      },
    }));
  };

  const attachFile = async (file: FileNode) => {
    if (file.is_dir) return;
    try {
      const content = await invoke<string>('fs_read_file', { path: file.path });
      setStagedFiles(prev => prev.some(item => item.path === file.path) ? prev : [...prev, { path: file.path, name: file.name, content }]);
      setInput(prev => prev.replace(/(?:^|\s)@[\w.\-]*$/, match => match.startsWith(' ') ? ' ' : ''));
      setMentionMode(false);
    } catch (e) {
      console.error('Failed to attach file:', e);
    }
  };

  const handleSlashCommand = async (cmd: SlashCommand, arg: string): Promise<boolean> => {
    if (cmd.id === 'clear') {
      clearActiveSession();
      setInput('');
      return true;
    }
    if (cmd.id === 'model') {
      setModelDropdownOpen(true);
      setInput('');
      return true;
    }
    if (cmd.id === 'search') {
      setInput(arg ? `Research this and synthesize actionable context:\n${arg}` : 'Research this and synthesize actionable context:\n');
      return true;
    }
    if (cmd.id === 'agent') {
      const [agentId, ...rest] = arg.split(/\s+/).filter(Boolean);
      const persona = personas.find(p => p.id === agentId || p.name.toLowerCase() === agentId?.toLowerCase());
      if (!persona) return false;
      setInput(`Delegate to ${persona.name} (${persona.role}):\n${rest.join(' ')}`);
      return false;
    }
    if (cmd.id === 'read') {
      const target = flatFiles.find(file => file.path === arg || file.name === arg || file.path.endsWith(arg));
      if (target) await attachFile(target);
      setInput('');
      return true;
    }
    if (cmd.id === 'run') {
      if (!arg.trim()) return false;
      try {
        const output = await invoke<string>('execute_sandboxed_command', { command: arg.trim() });
        setStagedFiles(prev => [...prev, { path: `terminal:${arg.trim()}`, name: `run: ${arg.trim()}`, content: output || '(no output)' }]);
        setInput('');
      } catch (e) {
        setStagedFiles(prev => [...prev, { path: `terminal:${arg.trim()}`, name: `run failed: ${arg.trim()}`, content: String(e) }]);
        setInput('');
      }
      return true;
    }
    return false;
  };

  const handleExecute = async () => {
    if ((!input.trim() && !stagedAnnotation && stagedFiles.length === 0) || isStreaming || !activeSessionId || !activeModelId || !activeModel) return;
    let text = input.trim();

    const commandMatch = text.match(/^\/(\w+)(?:\s+([\s\S]*))?$/);
    if (commandMatch) {
      const cmd = slashCommands.find(item => item.id === commandMatch[1]);
      if (cmd && await handleSlashCommand(cmd, commandMatch[2] ?? '')) return;
      text = input.trim();
    }

    if (stagedFiles.length > 0) {
      const fileBlock = stagedFiles.map(file => [
        `<details><summary>${file.name}</summary>`,
        '',
        `Path: ${file.path}`,
        '```',
        file.content.slice(0, 20000),
        '```',
        '</details>',
      ].join('\n')).join('\n\n');
      text = `${text}\n\n=== ATTACHED FILE CONTEXT ===\n${fileBlock}`.trim();
      setStagedFiles([]);
    }

    // Prepend annotation context if staged
    if (stagedAnnotation) {
      const annotationBlock = [
        `[Visual Annotation Attached from ${stagedAnnotation.sourceName ?? 'Preview'}]`,
        stagedAnnotation.targetLabel ? `Target: ${stagedAnnotation.targetLabel}` : '',
        stagedAnnotation.note ? `Note: ${stagedAnnotation.note}` : '',
        stagedAnnotation.imageDataUrl
          ? `\`\`\`image-data-url\n${stagedAnnotation.imageDataUrl}\n\`\`\``
          : '',
      ].filter(Boolean).join('\n');
      text = annotationBlock + (text ? '\n\n' + text : '');
      setStagedAnnotation(null);
    }
    if (!text) return;
    setInput('');

    if (agentMode) {
      // ── Agent Loop execution path ──────────────────────────────────────────
      if (!activeModelId || !activeModel) return;
      setAgentLoopState({ status: 'running', currentStep: 0, maxSteps: 10, logs: ['Initializing agent...'] });
      const selectedPersona = personas.find(p => p.id === selectedPersonaId);
      try {
        await startAutonomousLoop(
          text,
          activeModelId,
          activeModel.providerId,
          (update) => setAgentLoopState(prev => ({
            ...prev,
            ...update,
            logs: update.logs ? [...prev.logs, ...update.logs] : prev.logs,
          })),
          selectedPersona?.id,
        );
      } catch (err) {
        setAgentLoopState(prev => ({ ...prev, status: 'error', logs: [...prev.logs, `Error: ${String(err)}`] }));
      }
    } else {
      // ── Normal chat path ──────────────────────────────────────────────────
      await sendMessage(activeSessionId, text, activeModelId, activeModel.providerId);
    }
  };

  return (
    // Root: full width + height, horizontal flex — NO react-resizable-panels
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: '#0f0f11' }}>
      {/* Agent Approval Overlay — sits outside all layout so it overlays everything */}
      <AgentApprovalOverlay />

      {/* ── LEFT: Sessions sidebar ── fixed 220px */}
      <div style={{ width: 220, minWidth: 220, maxWidth: 220, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#908fa0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sessions</span>
          <button
            onClick={newSession}
            style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'transparent', border: 'none', color: '#908fa0', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title="New Session"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sessionList.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 16, opacity: 0.4, textAlign: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#908fa0', marginBottom: 8 }}>chat_bubble</span>
              <p style={{ fontSize: 11, color: '#908fa0' }}>No sessions yet</p>
              <p style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Click + to start</p>
            </div>
          )}
          {sessionList.map(s => {
            const isActive = s.id === activeSessionId;
            return (
              <button
                key={s.id}
                onClick={() => useAiStore.getState().setActiveSession(s.id)}
                style={{
                  padding: '8px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer', width: '100%', border: 'none',
                  background: isActive ? 'rgba(47, 217, 244, 0.1)' : 'transparent',
                  outline: isActive ? '1px solid rgba(47,217,244,0.2)' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#2fd9f4' : '#c4c3d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{s.title}</p>
                <p style={{ fontSize: 10, color: '#666', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.messages.length > 0 ? `${s.messages.length} messages` : 'Empty'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CENTER: Chat ── flex-1 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {/* Grid background */}
        <div className="technical-grid" style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }} />

        {/* Model bar */}
        <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', flexShrink: 0, position: 'relative', zIndex: 10 }}>
          {/* Agent mode toggle + model picker row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Agent Mode Pill */}
            <button
              onClick={() => { setAgentMode(m => !m); setAgentLoopState({ status: 'idle', currentStep: 0, maxSteps: 10, logs: [] }); }}
              title={agentMode ? 'Switch to Chat mode' : 'Switch to Agent mode'}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
                borderRadius: 8, border: '1px solid', cursor: 'pointer', fontWeight: 700, fontSize: 11,
                letterSpacing: '0.05em', transition: 'all 0.2s',
                background: agentMode ? 'rgba(232,140,72,0.15)' : 'rgba(255,255,255,0.06)',
                borderColor: agentMode ? 'rgba(232,140,72,0.4)' : 'rgba(255,255,255,0.1)',
                color: agentMode ? '#e88c48' : '#908fa0',
                boxShadow: agentMode ? '0 0 12px rgba(232,140,72,0.2)' : 'none',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>
                {agentMode ? 'smart_toy' : 'chat'}
              </span>
              {agentMode ? 'AGENT' : 'CHAT'}
            </button>

            {/* Model Dropdown */}
            <div style={{ position: 'relative' }}>
            <button
              onClick={() => setModelDropdownOpen(o => !o)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: '#e4e3f4' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#2fd9f4', fontVariationSettings: "'FILL' 1" }}>bolt</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{activeModel?.name || 'Select Model'}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#666' }}>expand_more</span>
            </button>
            {modelDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', marginTop: 4, left: 0, width: 240, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.5)', zIndex: 100, overflow: 'hidden' }}>
                {models.map(m => (
                  <button key={m.id} onClick={() => { useAiStore.getState().setActiveModel(m.id); setModelDropdownOpen(false); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: m.id === activeModelId ? 'rgba(47,217,244,0.08)' : 'transparent', border: 'none', cursor: 'pointer', color: '#c4c3d4', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = m.id === activeModelId ? 'rgba(47,217,244,0.08)' : 'transparent'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#2fd9f4' }}>{m.providerId === 'ollama' || m.providerId === 'local' ? 'memory' : 'cloud'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: '#666' }}>{m.providerId}</div>
                    </div>
                    {m.id === activeModelId && <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#2fd9f4' }}>check</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isStreaming && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: agentMode ? '#e88c48' : '#2fd9f4', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: agentMode ? '#e88c48' : '#2fd9f4', letterSpacing: '0.1em' }}>
                {agentMode ? `AGENT STEP ${agentLoopState.currentStep}/${agentLoopState.maxSteps}` : 'STREAMING'}
              </span>
            </div>
          )}
          {agentLoopState.status === 'running' && !isStreaming && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#e88c48', animation: 'pulse 1s infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#e88c48', letterSpacing: '0.1em' }}>AGENT RUNNING</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666', position: 'relative' }}>
            <button
              onClick={() => setShowTempSlider(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#908fa0', fontSize: 11, fontWeight: 600 }}
            >
              TEMP: {temperature.toFixed(1)}
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
            </button>
            {showTempSlider && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px', zIndex: 100, width: 200, boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#908fa0', letterSpacing: '0.1em', marginBottom: 8 }}>TEMPERATURE</div>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#2fd9f4' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666', marginTop: 4 }}>
                  <span>Precise</span><span>Creative</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 10 }}
          onClick={() => setModelDropdownOpen(false)}>
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-xl relative select-none">
              <div className="z-10 text-center flex flex-col items-center max-w-[280px]">
                <h2 className="text-title-sm font-bold text-on-surface select-none tracking-tight text-xl mb-xs">
                  Aether Desk
                </h2>
                <p className="text-body-sm text-outline mt-xs mb-md leading-relaxed select-none">
                  Ask anything, @ to mention, / for actions
                </p>
                
                {/* Dynamic model selector pill in the center */}
                <div className="flex items-center gap-xs bg-surface-container border border-outline-variant px-sm py-1 rounded-full text-label-caps text-secondary font-bold font-code-md cursor-pointer hover:border-secondary transition-all">
                  <span className="text-[12px] font-bold text-secondary mr-[2px]">+</span>
                  <span>{activeModel?.name || 'Ollama Model'}</span>
                </div>
              </div>
            </div>
          )}
          {activeSession?.messages.map((msg, i) => (
            <MessageBubble key={msg.id} msg={msg} isStreaming={isStreaming} isLast={i === activeSession.messages.length - 1} />
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, position: 'relative', zIndex: 10 }}>

          {/* Staged Annotation Chip */}
          {stagedAnnotation && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginBottom: 8,
              background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)',
              borderRadius: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#ff3b30', fontVariationSettings: "'FILL' 1" }}>draw</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#ff3b30', flex: 1 }}>
                Annotation from {stagedAnnotation.sourceName ?? 'Preview'}
                {stagedAnnotation.note ? ` — "${stagedAnnotation.note}"` : ''}
              </span>
              <button
                onClick={() => setStagedAnnotation(null)}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Remove annotation"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
              </button>
            </div>
          )}
          {stagedFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {stagedFiles.map(file => (
                <ContextChip
                  key={file.path}
                  icon={file.path.startsWith('terminal:') ? 'terminal' : 'description'}
                  color={file.path.startsWith('terminal:') ? '#4ade80' : '#ff9500'}
                  label={file.name}
                  onRemove={() => setStagedFiles(prev => prev.filter(item => item.path !== file.path))}
                />
              ))}
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <textarea
              style={{ width: '100%', background: 'transparent', border: 'none', padding: '12px 16px 8px', resize: 'none', height: 80, fontSize: 14, color: '#e4e3f4', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
              placeholder="Message The Nexus… (Enter to send, Shift+Enter for newline)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleExecute(); } }}
              disabled={isStreaming}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {slashMode ? (
                  <NexusSlashPalette
                    query={slashQuery}
                    commands={slashCommands}
                    onSelect={(cmd) => {
                      // Insert command text and close palette
                      setInput(prev => prev.replace(/(?:^|\s)\/[\w]*$/, match => match.startsWith(' ') ? ` ${cmd.insert}` : cmd.insert));
                      setSlashMode(false);
                    }}
                    onClose={() => setSlashMode(false)}
                  />
                ) : mentionMode ? (
                  <NexusMentionPalette
                    query={mentionQuery}
                    files={flatFiles}
                    onSelect={(file) => void attachFile(file)}
                    onClose={() => setMentionMode(false)}
                  />
                ) : (
                  [{ icon: 'attach_file', tip: 'Attach' }, { icon: 'search', tip: 'Search' }, { icon: 'smart_toy', tip: 'Agent' }].map(b => (
                    <button key={b.icon} title={b.tip}
                      onClick={async () => {
                        if (b.tip === 'Search') setInput(prev => prev + '/search ');
                        else if (b.tip === 'Agent') setInput(prev => prev + '@agent ');
                        else if (b.tip === 'Attach') {
                          try {
                            const { open } = await import('@tauri-apps/plugin-dialog');
                            const selected = await open({ multiple: false });
                            if (selected && typeof selected === 'string') {
                              const content = await invoke<string>('fs_read_file', { path: selected });
                              setInput(prev => prev + `\n\nFile attached: ${selected}\n\`\`\`\n${content}\n\`\`\`\n`);
                            }
                          } catch (e) {
                            console.error(e);
                          }
                        }
                      }}
                      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', color: '#666', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#2fd9f4'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666'; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{b.icon}</span>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={agentLoopState.status === 'running' || isStreaming
                  ? () => { useAiStore.setState({ isStreaming: false }); setAgentLoopState(prev => ({ ...prev, status: 'idle' })); }
                  : handleExecute}
                disabled={slashMode || mentionMode}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 8, border: 'none',
                  cursor: (input.trim() || stagedAnnotation || stagedFiles.length > 0) && !slashMode && !mentionMode ? 'pointer' : 'default',
                  fontWeight: 700, fontSize: 11,
                  background: (agentLoopState.status === 'running' || isStreaming)
                    ? (agentMode ? '#e88c48' : '#b00020')
                    : (input.trim() || stagedAnnotation || stagedFiles.length > 0) && !slashMode && !mentionMode
                      ? (agentMode ? '#e88c48' : '#2fd9f4')
                      : 'rgba(255,255,255,0.08)',
                  color: (agentLoopState.status === 'running' || isStreaming || ((input.trim() || stagedAnnotation || stagedFiles.length > 0) && !slashMode && !mentionMode)) ? '#000' : '#666',
                  transition: 'all 0.15s', letterSpacing: '0.05em',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {agentLoopState.status === 'running' || isStreaming ? 'stop' : agentMode ? 'play_arrow' : 'send'}
                </span>
                {agentLoopState.status === 'running' || isStreaming ? 'STOP' : agentMode ? 'RUN AGENT' : 'EXECUTE'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Context panel ── fixed 260px */}
      <div style={{ width: 260, minWidth: 260, maxWidth: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#908fa0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Active Context</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>



          {/* Agent Status Panel — shown in agent mode */}
          {agentMode && (
            <div style={{ marginBottom: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#e88c48', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>smart_toy</span>
                AGENT STATUS
              </p>
              <div style={{ background: 'rgba(232,140,72,0.05)', borderRadius: 8, border: '1px solid rgba(232,140,72,0.15)', overflow: 'hidden' }}>
                {/* Status row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 11, color: '#666' }}>Status</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: 4,
                    background: agentLoopState.status === 'running' ? 'rgba(232,140,72,0.2)' : agentLoopState.status === 'completed' ? 'rgba(47,217,244,0.15)' : agentLoopState.status === 'error' ? 'rgba(207,102,121,0.2)' : 'rgba(255,255,255,0.06)',
                    color: agentLoopState.status === 'running' ? '#e88c48' : agentLoopState.status === 'completed' ? '#2fd9f4' : agentLoopState.status === 'error' ? '#cf6679' : '#666',
                  }}>
                    {agentLoopState.status.toUpperCase()}
                  </span>
                </div>
                {/* Step progress */}
                <div style={{ padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#666' }}>Progress</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#e88c48' }}>{agentLoopState.currentStep} / {agentLoopState.maxSteps}</span>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, transition: 'width 0.4s',
                      background: agentLoopState.status === 'completed' ? '#2fd9f4' : agentLoopState.status === 'error' ? '#cf6679' : '#e88c48',
                      width: `${(agentLoopState.currentStep / agentLoopState.maxSteps) * 100}%`,
                    }} />
                  </div>
                </div>
                {/* Log tail */}
                <div style={{ maxHeight: 120, overflowY: 'auto', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {agentLoopState.logs.length === 0 ? (
                    <span style={{ fontSize: 10, color: '#444', fontStyle: 'italic' }}>No activity yet</span>
                  ) : (
                    agentLoopState.logs.slice(-8).map((log, i) => (
                      <div key={i} style={{ fontSize: 10, color: log.includes('Error') || log.includes('failed') ? '#cf6679' : log.includes('complete') || log.includes('success') ? '#2fd9f4' : '#908fa0', lineHeight: 1.4, fontFamily: 'monospace' }}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
                {/* Reset button */}
                {(agentLoopState.status === 'completed' || agentLoopState.status === 'error') && (
                  <button
                    onClick={() => setAgentLoopState({ status: 'idle', currentStep: 0, maxSteps: 10, logs: [] })}
                    style={{ width: '100%', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: 'none', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#908fa0', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em' }}
                  >
                    RESET
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Telemetry */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>TELEMETRY</p>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {[
                { label: 'Inference', value: lastTelemetry ? `${lastTelemetry.inference_ms}ms` : '—', color: '#2fd9f4' },
                { label: 'Tokens/sec', value: lastTelemetry ? lastTelemetry.tokens_per_sec.toFixed(1) : '—', color: '#e4e3f4' },
                { label: 'Provider', value: activeModel?.providerId || '—', color: '#c4c3d4' },
                { label: 'Status', value: isStreaming ? 'STREAMING' : 'IDLE', color: isStreaming ? '#2fd9f4' : '#666' },
              ].map((item, i) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 11, color: '#666' }}>{item.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item.label === 'Status' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: isStreaming ? '#2fd9f4' : '#444' }} />}
                    <span style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Session */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>SESSION</p>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {[
                { label: 'Messages', value: String(activeSession?.messages.length ?? 0), color: '#e4e3f4' },
                { label: 'Model', value: activeModel?.name ?? '—', color: '#2fd9f4' },
              ].map((item, i) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 11, color: '#666' }}>{item.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: item.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Utilities */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>AI UTILITIES</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[{ icon: 'analytics', label: 'Analyze' }, { icon: 'auto_stories', label: 'Summarize' }, { icon: 'terminal', label: 'Shell' }, { icon: 'search_check', label: 'Fact Check' }].map(({ icon, label }) => (
                <button key={label}
                  onClick={() => {
                    const prompts: Record<string, string> = {
                      'Analyze': 'Please analyze the current project context and identify areas for improvement.',
                      'Summarize': 'Summarize the current file or workspace context.',
                      'Shell': 'Write a shell script to automate my current task.',
                      'Fact Check': 'Fact check this statement: ',
                    };
                    setInput(prompts[label] || '');
                  }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(47,217,244,0.08)'; e.currentTarget.style.borderColor = 'rgba(47,217,244,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#2fd9f4' }}>{icon}</span>
                  <span style={{ fontSize: 10, color: '#c4c3d4', fontWeight: 500 }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
