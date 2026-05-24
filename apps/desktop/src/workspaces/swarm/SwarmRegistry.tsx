import React, { useState } from 'react';
import { useSwarmStore } from '../../core/store/useSwarmStore';
import type { AgentPersona } from '../../core/store/useSwarmStore';
import type { Capability } from '../../core/ai/tools/types';
import { useAiStore } from '../../core/store/useAiStore';

// ── All available capabilities for the UI ────────────────────────────────────

const ALL_CAPABILITIES: { id: Capability; label: string; icon: string }[] = [
  { id: 'READ_FS', label: 'Read Files', icon: 'folder_open' },
  { id: 'WRITE_FS', label: 'Write Files', icon: 'edit_document' },
  { id: 'EXEC_CMD', label: 'Execute Commands', icon: 'terminal' },
  { id: 'INTERNET_ACCESS', label: 'Internet Access', icon: 'public' },
  { id: 'BROWSER_CONTROL', label: 'Browser Control', icon: 'web' },
  { id: 'DEPLOYMENT_ACCESS', label: 'Deployment', icon: 'cloud_upload' },
  { id: 'WORKFLOW_EXECUTION', label: 'Workflow Exec', icon: 'account_tree' },
  { id: 'SYSTEM_AUTOMATION', label: 'System Auto', icon: 'smart_toy' },
];

// ── Agent Card ───────────────────────────────────────────────────────────────

const AgentCard: React.FC<{
  agent: AgentPersona;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ agent, isSelected, onSelect }) => {
  const { togglePersonaActive } = useSwarmStore();

  return (
    <div
      onClick={onSelect}
      className={`w-full p-md rounded-lg border transition-all text-left cursor-pointer ${
        isSelected
          ? 'bg-secondary/10 border-secondary/40 shadow-[0_0_12px_rgba(47,217,244,0.1)]'
          : agent.isActive
          ? 'bg-surface-container-high border-outline-variant/50 hover:border-secondary/30'
          : 'bg-surface-container border-outline-variant/30 opacity-50 hover:opacity-80'
      }`}
    >
      <div className="flex items-center gap-md">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          agent.isActive ? 'bg-surface-container-highest' : 'bg-surface-container'
        }`}>
          <span className={`material-symbols-outlined text-[20px] ${agent.iconColor}`}
            style={{ fontVariationSettings: agent.isActive ? "'FILL' 1" : "'FILL' 0" }}
          >{agent.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-sm">
            <span className="text-body-sm font-bold text-on-surface truncate">{agent.name}</span>
            {agent.isActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#4caf50] flex-shrink-0" />
            )}
          </div>
          <span className="text-[10px] text-outline font-mono">{agent.role}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); togglePersonaActive(agent.id); }}
          className={`w-8 h-5 rounded-full flex items-center transition-all flex-shrink-0 cursor-pointer ${
            agent.isActive ? 'bg-secondary justify-end' : 'bg-outline-variant/50 justify-start'
          }`}
          title={agent.isActive ? 'Deactivate' : 'Activate'}
        >
          <div className="w-3.5 h-3.5 bg-white rounded-full mx-[3px] shadow-sm" />
        </button>
      </div>
      <div className="flex gap-1 mt-sm flex-wrap">
        {agent.capabilities.map(cap => (
          <span key={cap} className="text-[8px] font-mono px-1 py-px bg-surface-container-lowest border border-outline-variant/30 rounded text-outline">
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── Agent Detail Panel ───────────────────────────────────────────────────────

const AgentDetail: React.FC<{ agent: AgentPersona }> = ({ agent }) => {
  const { updatePersonaCapability, updatePersonaPrompt, getMemory, clearMemory } = useSwarmStore();
  const memory = getMemory(agent.id);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(agent.systemPrompt);

  return (
    <div className="flex-1 overflow-y-auto p-lg space-y-lg">
      {/* Header */}
      <div className="flex items-center gap-lg">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-surface-container-highest border border-outline-variant/30`}>
          <span className={`material-symbols-outlined text-[28px] ${agent.iconColor}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >{agent.icon}</span>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-on-surface">{agent.name}</h2>
          <p className="text-body-sm text-outline">{agent.role}</p>
          <div className="flex items-center gap-sm mt-1">
            <span className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-[#4caf50]' : 'bg-outline-variant'}`} />
            <span className="text-[10px] text-outline font-mono">{agent.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
          </div>
        </div>
        
        {/* Model Selection */}
        <div className="flex flex-col items-end">
          <label className="text-[10px] font-label-caps text-outline uppercase tracking-widest font-bold mb-xs">Assigned Model</label>
          <select
            className="bg-surface-container-highest border border-outline-variant rounded p-xs text-[11px] text-on-surface font-code-md focus:outline-none focus:border-secondary transition-colors"
            value={agent.modelId || ''}
            onChange={e => useSwarmStore.getState().updatePersonaModel(agent.id, e.target.value || undefined)}
          >
            <option value="">(Default Active Model)</option>
            <optgroup label="Local (Ollama)">
              {useAiStore.getState().models.filter(m => m.providerId === 'ollama').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </optgroup>
            <optgroup label="Cloud">
              {useAiStore.getState().models.filter(m => m.providerId !== 'ollama').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {/* Capabilities */}
      <div className="space-y-sm">
        <label className="text-[10px] font-label-caps text-outline uppercase tracking-widest font-bold">Sandbox Capabilities</label>
        <div className="grid grid-cols-2 gap-xs">
          {ALL_CAPABILITIES.map(cap => {
            const enabled = agent.capabilities.includes(cap.id);
            return (
              <button
                key={cap.id}
                onClick={() => updatePersonaCapability(agent.id, cap.id, !enabled)}
                className={`flex items-center gap-sm p-sm rounded border transition-all ${
                  enabled
                    ? 'bg-secondary/10 border-secondary/30 text-secondary'
                    : 'bg-surface-container-high border-outline-variant/30 text-outline hover:text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]"
                  style={{ fontVariationSettings: enabled ? "'FILL' 1" : "'FILL' 0" }}
                >{cap.icon}</span>
                <span className="text-[10px] font-bold">{cap.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* System Prompt */}
      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-label-caps text-outline uppercase tracking-widest font-bold">System Prompt</label>
          {editingPrompt ? (
            <div className="flex gap-xs">
              <button
                onClick={() => { updatePersonaPrompt(agent.id, promptDraft); setEditingPrompt(false); }}
                className="text-[9px] font-bold text-secondary hover:text-secondary-fixed-dim uppercase cursor-pointer"
              >Save</button>
              <button
                onClick={() => { setPromptDraft(agent.systemPrompt); setEditingPrompt(false); }}
                className="text-[9px] font-bold text-outline hover:text-on-surface uppercase cursor-pointer"
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setEditingPrompt(true)}
              className="text-[9px] font-bold text-secondary hover:text-secondary-fixed-dim uppercase cursor-pointer"
            >Edit</button>
          )}
        </div>
        {editingPrompt ? (
          <textarea
            className="w-full h-40 bg-surface-container-highest border border-outline-variant rounded-lg p-md text-[12px] text-on-surface font-mono leading-relaxed focus:outline-none focus:border-secondary resize-none"
            value={promptDraft}
            onChange={e => setPromptDraft(e.target.value)}
          />
        ) : (
          <div className="bg-surface-container-highest border border-outline-variant/30 rounded-lg p-md text-[11px] text-on-surface-variant font-mono leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
            {agent.systemPrompt}
          </div>
        )}
      </div>

      {/* Memory */}
      <div className="space-y-sm">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-label-caps text-outline uppercase tracking-widest font-bold">
            Persistent Memory ({memory.length} entries)
          </label>
          {memory.length > 0 && (
            <button
              onClick={() => clearMemory(agent.id)}
              className="text-[9px] font-bold text-error hover:text-error/80 uppercase cursor-pointer"
            >Clear</button>
          )}
        </div>
        <div className="bg-surface-container-highest border border-outline-variant/30 rounded-lg overflow-hidden">
          {memory.length === 0 ? (
            <div className="flex items-center justify-center p-lg text-center">
              <div>
                <span className="material-symbols-outlined text-2xl text-outline block mb-xs">memory</span>
                <p className="text-[11px] text-outline">No memories yet</p>
                <p className="text-[9px] text-outline/60 mt-xs">Memories are created when this agent executes tasks</p>
              </div>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto divide-y divide-outline-variant/20">
              {memory.slice(-20).reverse().map(entry => (
                <div key={entry.id} className="p-sm flex gap-sm">
                  <span className={`material-symbols-outlined text-[12px] mt-px flex-shrink-0 ${
                    entry.type === 'observation' ? 'text-primary' :
                    entry.type === 'decision' ? 'text-secondary' :
                    entry.type === 'tool_result' ? 'text-tertiary' :
                    'text-[#9c27b0]'
                  }`}>
                    {entry.type === 'observation' ? 'visibility' :
                     entry.type === 'decision' ? 'psychology' :
                     entry.type === 'tool_result' ? 'build' :
                     'auto_awesome'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-on-surface-variant truncate">{entry.content}</p>
                    <span className="text-[8px] text-outline font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString()} · {entry.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Swarm Registry ──────────────────────────────────────────────────────

export const SwarmRegistry: React.FC = () => {
  const { personas, activeAgentId, setActiveAgent } = useSwarmStore();
  const selectedAgent = personas.find(p => p.id === activeAgentId);
  const activeCount = personas.filter(p => p.isActive).length;

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', background: '#0f0f11' }}>
      {/* Left: Agent List */}
      <div style={{ width: 300, minWidth: 280, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#908fa0', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Swarm Registry</span>
            <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{activeCount} active · {personas.length} total</div>
          </div>
          <span className="material-symbols-outlined text-[18px] text-outline" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {personas.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isSelected={activeAgentId === agent.id}
              onSelect={() => setActiveAgent(agent.id === activeAgentId ? null : agent.id)}
            />
          ))}
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedAgent ? (
          <AgentDetail agent={selectedAgent} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center technical-grid">
            <div className="z-10">
              <span className="material-symbols-outlined text-5xl text-outline block mb-md" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
              <h3 className="text-lg font-bold text-on-surface-variant mb-xs">Swarm Registry</h3>
              <p className="text-body-sm text-outline max-w-xs">
                Select an agent persona to configure its capabilities, system prompt, and view its persistent memory.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
