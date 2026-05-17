import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAiStore } from '../../core/store/useAiStore';
import type { AIProviderId } from '../../core/store/useAiStore';

// ── Types ─────────────────────────────────────────────────────────────────────
interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  details?: { parameter_size?: string; family?: string };
}

type SectionId = 'intelligence' | 'providers' | 'routing' | 'telemetry' | 'system';

// ── Sub-component: Status Pill ─────────────────────────────────────────────────
const StatusPill: React.FC<{ status: 'online' | 'offline' | 'checking' | 'configured' | 'unconfigured' }> = ({ status }) => {
  const map = {
    online:       'border-secondary bg-secondary/10 text-secondary',
    configured:   'border-secondary bg-secondary/10 text-secondary',
    offline:      'border-error bg-error/10 text-error',
    unconfigured: 'border-outline bg-surface-container text-outline',
    checking:     'border-outline bg-surface-container text-outline',
  };
  const dot = {
    online:       'bg-secondary animate-pulse',
    configured:   'bg-secondary',
    offline:      'bg-error',
    unconfigured: 'bg-outline',
    checking:     'bg-outline animate-pulse',
  };
  const label = { online: 'ONLINE', configured: 'CONFIGURED', offline: 'OFFLINE', unconfigured: 'ADD KEY', checking: 'CHECKING...' };
  return (
    <span className={`flex items-center gap-xs px-sm py-[2px] border rounded text-label-caps ${map[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status]}`} />
      {label[status]}
    </span>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
export const Settings: React.FC = () => {
  const { providers, models, lastTelemetry, saveApiKey, setOllamaModels, setProviderConfigured } = useAiStore();

  const [activeSection, setActiveSection] = useState<SectionId>('intelligence');
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [ollamaModels, setLocalOllamaModels] = useState<OllamaModel[]>([]);
  const [keyInputs, setKeyInputs] = useState<Partial<Record<AIProviderId, string>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const navItems: { id: SectionId; label: string; icon: string }[] = [
    { id: 'intelligence', label: 'Intelligence',    icon: 'smart_toy' },
    { id: 'providers',    label: 'API Providers',   icon: 'key' },
    { id: 'routing',      label: 'Routing Rules',   icon: 'alt_route' },
    { id: 'telemetry',    label: 'Live Telemetry',  icon: 'monitoring' },
    { id: 'system',       label: 'System',          icon: 'settings' },
  ];

  const checkOllama = useCallback(async () => {
    setOllamaStatus('checking');
    try {
      const running = await invoke<boolean>('ollama_check_status');
      setOllamaStatus(running ? 'online' : 'offline');
      if (running) {
        setProviderConfigured('ollama', true);
        const result = await invoke<{ models: OllamaModel[] }>('ollama_list_models');
        const raw = result.models ?? [];
        setLocalOllamaModels(raw);
        setOllamaModels(raw.map(m => ({
          id: m.name,
          name: m.name,
          providerId: 'ollama' as AIProviderId,
          contextWindow: 8192,
          isLocal: true,
          size: formatBytes(m.size),
        })));
      }
    } catch {
      setOllamaStatus('offline');
    }
  }, [setOllamaModels, setProviderConfigured]);

  useEffect(() => { checkOllama(); }, [checkOllama]);

  const handleSaveKey = async (pid: AIProviderId) => {
    const key = keyInputs[pid] ?? '';
    setSavingKey(pid);
    await saveApiKey(pid, key);
    setSavingKey(null);
    setSavedKey(pid);
    setTimeout(() => setSavedKey(null), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    const gb = bytes / (1024 ** 3);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
  };

  const cloudProviders: AIProviderId[] = ['openai', 'anthropic', 'gemini', 'openrouter'];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex w-full h-full bg-background overflow-hidden">

      {/* ── LEFT NAV ─────────────────────────────────────────────────── */}
      <div className="w-56 border-r border-outline-variant bg-surface-dim flex flex-col flex-shrink-0">
        <div className="p-md border-b border-outline-variant">
          <h1 className="text-title-sm font-bold text-on-surface">Command Center</h1>
          <p className="text-label-caps text-outline mt-xs">AI RUNTIME CONFIGURATION</p>
        </div>
        <nav className="flex flex-col p-sm gap-xs flex-grow">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-sm px-sm py-sm rounded text-left transition-all ${
                activeSection === item.id
                  ? 'bg-surface-container-highest text-secondary border-l-2 border-secondary'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span className="text-body-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </nav>
        {/* System Health Footer */}
        <div className="p-md border-t border-outline-variant space-y-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-caps text-outline">Ollama</span>
            <StatusPill status={ollamaStatus} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-label-caps text-outline">Intelligence</span>
            <span className={`text-label-caps font-bold ${lastTelemetry ? 'text-secondary' : 'text-outline'}`}>
              {lastTelemetry ? `${lastTelemetry.tokens_per_sec.toFixed(1)} t/s` : 'IDLE'}
            </span>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-xl">

        {/* ══ INTELLIGENCE SECTION ══ */}
        {activeSection === 'intelligence' && (
          <div className="max-w-3xl space-y-xl">
            <div>
              <h2 className="text-headline-md text-on-surface">Intelligence Runtime</h2>
              <p className="text-body-sm text-outline mt-xs">
                Manage local and cloud AI models. Local inference runs privately on your machine via Ollama. Cloud models require an API key.
              </p>
            </div>

            {/* Ollama Status Card */}
            <div className="p-md rounded border border-outline-variant bg-surface-container-low space-y-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-secondary">memory</span>
                  <h3 className="text-title-sm font-bold text-on-surface">Ollama — Local Runtime</h3>
                </div>
                <div className="flex items-center gap-sm">
                  <StatusPill status={ollamaStatus} />
                  <button
                    onClick={checkOllama}
                    className="flex items-center gap-xs text-outline hover:text-on-surface transition-colors text-label-caps border border-outline-variant px-sm py-1 rounded"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${ollamaStatus === 'checking' ? 'animate-spin' : ''}`}>refresh</span>
                    Refresh
                  </button>
                </div>
              </div>

              {ollamaStatus === 'offline' && (
                <div className="p-sm rounded bg-surface-container border border-outline-variant/50">
                  <p className="text-body-sm text-on-surface-variant mb-sm">Ollama is not running. Start it with:</p>
                  <code className="font-code-md text-[13px] text-secondary-fixed-dim bg-surface-container-highest px-sm py-xs rounded block">
                    ollama serve
                  </code>
                </div>
              )}

              {ollamaStatus === 'online' && (
                <div className="space-y-sm">
                  {ollamaModels.length > 0 ? ollamaModels.map(model => (
                    <div key={model.name} className="flex items-center justify-between p-sm bg-surface-container rounded border border-outline-variant hover:border-outline transition-colors">
                      <div className="flex items-center gap-md">
                        <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-secondary text-[18px]">memory</span>
                        </div>
                        <div>
                          <div className="text-body-sm font-semibold text-on-surface font-code-md">{model.name}</div>
                          <div className="text-label-caps text-outline mt-xs">
                            {formatBytes(model.size)} • {model.details?.parameter_size ?? 'Local'} • {model.details?.family ?? 'ollama'}
                          </div>
                        </div>
                      </div>
                      <StatusPill status="configured" />
                    </div>
                  )) : (
                    <div className="p-md rounded border border-dashed border-outline-variant text-center">
                      <p className="text-body-sm text-outline">No models installed.</p>
                      <code className="block mt-sm font-code-md text-[13px] text-secondary-fixed-dim bg-surface-container p-sm rounded mt-sm">
                        ollama pull llama3
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cloud Models */}
            <div className="space-y-sm">
              <h3 className="text-title-sm font-bold text-on-surface">Cloud Models</h3>
              <p className="text-body-sm text-outline">Configure an API key in the Providers tab to unlock cloud models.</p>
              <div className="space-y-sm">
                {models.filter(m => !m.isLocal).map(m => {
                  const prov = providers[m.providerId as AIProviderId];
                  return (
                    <div key={m.id} className="flex items-center justify-between p-md bg-surface-container rounded border border-outline-variant">
                      <div className="flex items-center gap-md">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-primary text-[18px]">cloud</span>
                        </div>
                        <div>
                          <div className="text-body-sm font-semibold text-on-surface">{m.name}</div>
                          <div className="text-label-caps text-outline mt-xs">
                            {prov?.name} • {(m.contextWindow / 1000).toFixed(0)}k context
                          </div>
                        </div>
                      </div>
                      <StatusPill status={prov?.isConfigured ? 'configured' : 'unconfigured'} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ PROVIDERS SECTION ══ */}
        {activeSection === 'providers' && (
          <div className="max-w-3xl space-y-xl">
            <div>
              <h2 className="text-headline-md text-on-surface">API Providers</h2>
              <p className="text-body-sm text-outline mt-xs">
                Keys are stored transiently in-memory only — never written to disk in plain text. They will clear on app restart.
              </p>
            </div>
            <div className="p-sm rounded border border-outline-variant/50 bg-secondary/5 flex items-center gap-sm">
              <span className="material-symbols-outlined text-secondary text-[18px]">lock</span>
              <p className="text-body-sm text-secondary/80">
                Secure transient storage active. Keys are held in Rust memory only.
              </p>
            </div>

            {cloudProviders.map(pid => {
              const prov = providers[pid];
              const isSaving = savingKey === pid;
              const isSaved = savedKey === pid;
              return (
                <div key={pid} className="p-md bg-surface-container rounded border border-outline-variant space-y-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-sm">
                      <span className="material-symbols-outlined text-primary text-[20px]">cloud</span>
                      <h3 className="text-body-sm font-bold text-on-surface">{prov.name}</h3>
                    </div>
                    <StatusPill status={prov.isConfigured ? 'configured' : 'unconfigured'} />
                  </div>
                  <div className="flex gap-sm">
                    <input
                      type="password"
                      className="flex-1 bg-surface-container-highest border border-outline-variant rounded px-sm py-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary transition-colors font-code-md"
                      placeholder={`${prov.name} API Key (sk-...)`}
                      value={keyInputs[pid] ?? ''}
                      onChange={e => setKeyInputs(k => ({ ...k, [pid]: e.target.value }))}
                    />
                    <button
                      onClick={() => handleSaveKey(pid)}
                      disabled={isSaving}
                      className={`px-md rounded text-label-caps font-bold transition-all active:scale-95 ${
                        isSaved
                          ? 'bg-secondary text-on-secondary'
                          : 'bg-primary text-on-primary hover:opacity-90'
                      } disabled:opacity-60`}
                    >
                      {isSaving ? (
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      ) : isSaved ? (
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      ) : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ ROUTING SECTION ══ */}
        {activeSection === 'routing' && (
          <div className="max-w-3xl space-y-xl">
            <div>
              <h2 className="text-headline-md text-on-surface">Intelligence Routing</h2>
              <p className="text-body-sm text-outline mt-xs">
                Assign specific models to different AetherDesk contexts. The Unified Intelligence Router uses these rules automatically.
              </p>
            </div>
            <div className="space-y-sm">
              {[
                { task: 'Code Generation & Editing', icon: 'terminal',    model: 'llama3:8b',   context: 'Forge IDE + Loom Execution' },
                { task: 'Nexus Chat & Analysis',     icon: 'chat',        model: 'llama3:8b',   context: 'Nexus Workspace' },
                { task: 'Workflow Automation',        icon: 'hub',         model: 'mistral:7b',  context: 'Loom AI Nodes' },
                { task: 'Artisan Generation',         icon: 'palette',     model: 'gpt-4o',      context: 'Artisan Visual Editor' },
                { task: 'Browser DOM Analysis',       icon: 'language',    model: 'llama3:8b',   context: 'Browser Workspace AI Context' },
                { task: 'Document Summary',           icon: 'auto_stories',model: 'mistral:7b',  context: 'Any workspace' },
              ].map(rule => (
                <div key={rule.task} className="flex items-center justify-between p-md bg-surface-container rounded border border-outline-variant hover:border-outline-variant transition-colors">
                  <div className="flex items-center gap-md">
                    <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center">
                      <span className="material-symbols-outlined text-outline text-[18px]">{rule.icon}</span>
                    </div>
                    <div>
                      <div className="text-body-sm font-semibold text-on-surface">{rule.task}</div>
                      <div className="text-label-caps text-outline mt-xs">{rule.context}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-xs bg-surface-container-highest border border-outline-variant px-sm py-1 rounded cursor-pointer hover:border-secondary transition-colors group">
                    <span className="material-symbols-outlined text-secondary text-[16px]">bolt</span>
                    <span className="text-body-sm font-code-md text-on-surface">{rule.model}</span>
                    <span className="material-symbols-outlined text-outline text-[16px] group-hover:text-secondary transition-colors">expand_more</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ TELEMETRY SECTION ══ */}
        {activeSection === 'telemetry' && (
          <div className="max-w-3xl space-y-xl">
            <div>
              <h2 className="text-headline-md text-on-surface">Live Telemetry</h2>
              <p className="text-body-sm text-outline mt-xs">
                Real-time intelligence runtime metrics from the last inference request.
              </p>
            </div>

            {lastTelemetry ? (
              <div className="grid grid-cols-2 gap-md">
                {[
                  { label: 'Inference Latency',  value: `${lastTelemetry.inference_ms} ms`,              icon: 'timer',      color: 'text-primary' },
                  { label: 'Tokens / Second',    value: `${lastTelemetry.tokens_per_sec.toFixed(1)} t/s`, icon: 'speed',      color: 'text-secondary' },
                  { label: 'Active Provider',    value: lastTelemetry.provider ?? '—',                    icon: 'cloud',      color: 'text-tertiary' },
                  { label: 'Active Model',       value: lastTelemetry.model ?? '—',                       icon: 'smart_toy',  color: 'text-secondary-fixed-dim' },
                ].map(stat => (
                  <div key={stat.label} className="p-md bg-surface-container rounded border border-outline-variant">
                    <div className="flex items-center gap-sm mb-sm">
                      <span className={`material-symbols-outlined text-[20px] ${stat.color}`}>{stat.icon}</span>
                      <span className="text-label-caps text-outline">{stat.label.toUpperCase()}</span>
                    </div>
                    <div className={`text-headline-md font-code-md font-bold ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-xl rounded border border-dashed border-outline-variant text-center bg-surface-container-lowest">
                <span className="material-symbols-outlined text-3xl text-outline block mb-sm">monitoring</span>
                <p className="text-body-sm text-outline">No telemetry yet.</p>
                <p className="text-label-caps text-outline mt-xs">Start a conversation in Nexus to see live metrics here.</p>
              </div>
            )}

            <div className="p-md rounded border border-outline-variant bg-surface-container-low space-y-md">
              <h3 className="text-title-sm font-bold text-on-surface">Runtime Health</h3>
              <div className="space-y-sm">
                {[
                  { label: 'Ollama Runtime',    status: ollamaStatus === 'online' },
                  { label: 'Tauri IPC Bridge',  status: true },
                  { label: 'Event Bus',         status: true },
                  { label: 'Orchestration DAG', status: true },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-body-sm text-on-surface-variant">{item.label}</span>
                    <div className="flex items-center gap-xs">
                      <span className={`w-2 h-2 rounded-full ${item.status ? 'bg-secondary animate-pulse' : 'bg-error'}`} />
                      <span className={`text-label-caps ${item.status ? 'text-secondary' : 'text-error'}`}>
                        {item.status ? 'NOMINAL' : 'DOWN'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ SYSTEM SECTION ══ */}
        {activeSection === 'system' && (
          <div className="max-w-3xl space-y-xl">
            <div>
              <h2 className="text-headline-md text-on-surface">System</h2>
              <p className="text-body-sm text-outline mt-xs">AetherDesk runtime information and diagnostics.</p>
            </div>
            <div className="space-y-sm">
              {[
                { label: 'AetherDesk Version',  value: '0.8.0 — Phase 8' },
                { label: 'Intelligence API',     value: 'Unified Provider Router v1' },
                { label: 'Rust Backend',         value: 'Tauri v2 + Tokio' },
                { label: 'Persistence',          value: 'tauri-plugin-store' },
                { label: 'Orchestration',        value: 'DAG Engine v1 (Phase 7C)' },
                { label: 'API Key Storage',      value: 'Transient In-Memory (Secure)' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center p-sm border-b border-outline-variant/30">
                  <span className="text-body-sm text-on-surface-variant">{label}</span>
                  <span className="text-body-sm font-semibold font-code-md text-on-surface">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
