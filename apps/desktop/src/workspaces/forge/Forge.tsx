import React, { useEffect, useCallback, useRef, useState, lazy, Suspense } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useFilesystemStore } from '../../core/store/useFilesystemStore';
import type { FileNode } from '../../core/store/useFilesystemStore';
import { useRuntimeStore } from '../../core/store/useRuntimeStore';
import { useWorkspaceStore } from '../../core/store/useWorkspaceStore';
import { ForgeAiPanel } from './ForgeAiPanel';
import { useFimAutocomplete } from '../../core/ai/useFimAutocomplete';
import { useSemanticNavigation } from '../../core/ai/useSemanticNavigation';
import { PreviewAnnotationOverlay } from './PreviewAnnotationOverlay';

// ── Right panel tab type ──────────────────────────────────────────────────────
type RightPanelTab = 'preview' | 'ai' | 'logs';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// ── File icon helper ──────────────────────────────────────────────────────────
function fileIconColor(ext?: string): string {
  const map: Record<string, string> = {
    ts: 'text-[#3178c6]', tsx: 'text-[#3178c6]', js: 'text-[#f7df1e]', jsx: 'text-[#f7df1e]',
    rs: 'text-[#dea584]', py: 'text-[#3572A5]', json: 'text-[#c5a332]', toml: 'text-[#9c4121]',
    css: 'text-[#563d7c]', html: 'text-[#e34c26]', md: 'text-outline', yml: 'text-[#cb171e]',
    yaml: 'text-[#cb171e]', go: 'text-[#00ADD8]',
  };
  return map[ext || ''] || 'text-outline';
}

// ── Recursive Tree Node ───────────────────────────────────────────────────────
const TreeNode: React.FC<{ node: FileNode; depth: number }> = ({ node, depth }) => {
  const [expanded, setExpanded] = React.useState(depth < 2);
  const { openFile, activeTabId } = useFilesystemStore();
  const isActive = !node.is_dir && activeTabId === node.path;

  if (node.is_dir) {
    return (
      <>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-xs w-full py-0.5 hover:bg-surface-container hover:text-on-surface cursor-pointer text-on-surface-variant transition-colors"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <span className="material-symbols-outlined text-[16px]">{expanded ? 'expand_more' : 'chevron_right'}</span>
          <span className="material-symbols-outlined text-[16px] text-primary">folder</span>
          <span className="text-body-sm truncate">{node.name}</span>
        </button>
        {expanded && node.children?.map(child => (
          <TreeNode key={child.path} node={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <button
      onClick={() => openFile(node)}
      className={`flex items-center gap-xs w-full py-0.5 cursor-pointer transition-colors ${
        isActive ? 'bg-surface-container-high text-secondary-fixed-dim' : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
      }`}
      style={{ paddingLeft: `${depth * 14 + 22}px` }}
    >
      <span className={`material-symbols-outlined text-[16px] ${fileIconColor(node.extension)}`}>description</span>
      <span className="text-body-sm truncate">{node.name}</span>
    </button>
  );
};

// ── Main Forge Component ──────────────────────────────────────────────────────
export const Forge: React.FC = () => {
  const {
    fileTree, openTabs, activeTabId, isLoading,
    loadDirectory, setActiveTab, closeTab, updateTabContent, saveActiveFile, openFile
  } = useFilesystemStore();
  const { status, logs, previewUrl, startRuntime, stopRuntime, addLog, sessionId } = useRuntimeStore();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const editorRef = useRef<any>(null);
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const [rightTab, setRightTab] = useState<RightPanelTab>('preview');
  const [aiActionActive, setAiActionActive] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const { registerFimProvider } = useFimAutocomplete();
  const { registerSemanticProvider } = useSemanticNavigation();

  const activeTab = openTabs.find(t => t.id === activeTabId);

  // ── Runtime log listener ──────────────────────────────────────────────────
  useEffect(() => {
    const unlisten = listen<{ type: string; message: string }>(`runtime_log_${sessionId}`, (e) => {
      addLog({ type: e.payload.type as any, message: e.payload.message });
    });
    return () => { unlisten.then(fn => fn()); };
  }, [sessionId, addLog]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveActiveFile(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); setRightTab('ai'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveActiveFile]);

  // ── Semantic Navigation Event Listener ────────────────────────────────────
  useEffect(() => {
    const handleOpenFile = (e: any) => {
      const { path, line } = e.detail;
      if (path) {
        const name = path.split(/[\\\/]/).pop() || 'Unknown';
        const extension = name.split('.').pop() || '';
        openFile({ path, name, is_dir: false, extension, children: [] });
        
        // After opening, wait for Monaco to mount and jump to the line
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.revealLineInCenter(line);
            editorRef.current.setPosition({ lineNumber: line, column: 1 });
            editorRef.current.focus();
          }
        }, 100); // Give the store and Suspense time to mount
      }
    };
    window.addEventListener('aether:open_file', handleOpenFile);
    return () => window.removeEventListener('aether:open_file', handleOpenFile);
  }, [openFile]);

  // ── Monaco helpers ────────────────────────────────────────────────────────
  const getEditorSelection = useCallback((): string => {
    if (!editorRef.current) return '';
    const model = editorRef.current.getModel();
    const selection = editorRef.current.getSelection();
    if (!model || !selection) return '';
    return model.getValueInRange(selection);
  }, []);

  const getEditorContent = useCallback((): string => {
    if (!editorRef.current) return '';
    return editorRef.current.getValue() ?? '';
  }, []);

  const insertAtCursor = useCallback((text: string) => {
    if (!editorRef.current) return;
    const selection = editorRef.current.getSelection();
    editorRef.current.executeEdits('forge-ai-insert', [{ range: selection, text, forceMoveMarkers: true }]);
    editorRef.current.focus();
  }, []);

  // ── AI action bar ─────────────────────────────────────────────────────────
  const triggerAiAction = useCallback((label: string) => {
    const selection = getEditorSelection();
    const content = getEditorContent();
    const ctx = selection.trim()
      ? `Selected code:\n\`\`\`\n${selection}\n\`\`\``
      : `Full file (${activeTab?.name || 'untitled'}):\n\`\`\`\n${content.slice(0, 2000)}\n\`\`\``;
    const prompts: Record<string, string> = {
      Explain:  `Explain this code step by step:\n${ctx}`,
      Refactor: `Refactor this code for clarity and performance:\n${ctx}`,
      Generate: `Generate a complementary function or component for:\n${ctx}`,
      Fix:      `Identify and fix any bugs or issues in:\n${ctx}`,
    };
    sessionStorage.setItem('forge_ai_prompt', prompts[label] || '');
    setRightTab('ai');
    setAiActionActive(label);
    setTimeout(() => setAiActionActive(null), 2000);
  }, [getEditorSelection, getEditorContent, activeTab]);

  // ── Open folder ───────────────────────────────────────────────────────────
  const handleOpenFolder = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: 'Open Workspace Folder' });
      if (selected && typeof selected === 'string') {
        const name = selected.split(/[\\\/]/).pop() || selected;
        setCurrentWorkspace({ path: selected, name, lastOpenedAt: Date.now() });
        await loadDirectory(selected);
      }
    } catch (err) {
      console.error('Open folder failed:', err);
    }
  }, [loadDirectory, setCurrentWorkspace]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!overflowOpen) return;
      if (tabBarRef.current && !tabBarRef.current.contains(event.target as Node)) {
        setOverflowOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [overflowOpen]);

  const handleStartRuntime = useCallback(async () => {
    if (!currentWorkspace) return;
    await startRuntime(currentWorkspace.path, 'npm run dev');
  }, [currentWorkspace, startRuntime]);

  // ── Right panel tab config ────────────────────────────────────────────────
  const rightTabs: { id: RightPanelTab; label: string; icon: string }[] = [
    { id: 'preview', label: 'Preview',      icon: 'language' },
    { id: 'ai',      label: 'AI Assistant', icon: 'smart_toy' },
    { id: 'logs',    label: 'Logs',         icon: 'terminal' },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, minHeight: 0 }}>

      {/* AI Action Bar */}
      <div className="flex items-center h-8 px-md border-b border-outline-variant bg-surface-container-lowest flex-shrink-0 gap-md">
        <span className="text-label-caps text-outline">AI ACTIONS</span>
        <div className="flex items-center gap-sm">
          {[
            { label: 'Explain',  icon: 'auto_awesome' },
            { label: 'Refactor', icon: 'tune' },
            { label: 'Generate', icon: 'add_circle' },
            { label: 'Fix',      icon: 'bug_report' },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => triggerAiAction(action.label)}
              className={`flex items-center gap-xs text-label-caps transition-all px-sm py-[2px] rounded border ${
                aiActionActive === action.label
                  ? 'border-secondary text-secondary bg-secondary/10'
                  : 'border-outline-variant/50 text-outline hover:text-secondary hover:border-secondary/50 hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span className="text-label-caps text-outline/50 hidden lg:block">Ctrl+I → AI Panel</span>
      </div>

      {/* Main area: columns + bottom terminal */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top row: LEFT + CENTER + RIGHT */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

          {/* ── LEFT: File Explorer ────────────────────────────────── */}
          <div style={{
            width: 240, minWidth: 200, flexShrink: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            background: '#111115',
          }}>
            <div className="h-8 flex items-center px-md justify-between bg-surface-container-low flex-shrink-0">
              <span className="text-label-caps font-bold text-on-surface-variant uppercase tracking-widest truncate">
                {currentWorkspace ? currentWorkspace.name : 'Explorer'}
              </span>
              <button
                onClick={handleOpenFolder}
                className="material-symbols-outlined text-on-surface-variant hover:text-secondary text-[18px] transition-colors"
                title="Open Folder"
              >folder_open</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }} className="py-xs text-on-surface-variant">
              {isLoading ? (
                <div className="flex items-center justify-center py-xl">
                  <span className="material-symbols-outlined animate-spin text-outline">progress_activity</span>
                </div>
              ) : fileTree.length > 0 ? (
                fileTree.map(node => <TreeNode key={node.path} node={node} depth={0} />)
              ) : (
                <div className="flex flex-col items-center justify-center py-xl gap-sm text-center px-md">
                  <span className="material-symbols-outlined text-3xl text-outline">folder_open</span>
                  <p className="text-body-sm text-outline">No folder open</p>
                  <button
                    onClick={handleOpenFolder}
                    className="text-label-caps text-secondary border border-secondary/30 px-md py-1 rounded hover:opacity-80 transition-opacity"
                  >Open Folder</button>
                </div>
              )}
            </div>
          </div>

          {/* ── CENTER: Monaco Editor ──────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0e0e10' }}>
            {/* Tab bar */}
            <div ref={tabBarRef} className="flex bg-surface-container-low h-9 border-b border-outline-variant flex-shrink-0 overflow-x-auto">
              {openTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-3 h-9 gap-1.5 border-r border-outline-variant cursor-pointer transition-colors flex-shrink-0 ${
                    tab.id === activeTabId
                      ? 'bg-surface text-secondary-fixed-dim border-b-2 border-b-secondary-fixed-dim'
                      : 'text-outline hover:text-on-surface bg-surface-container-low'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[16px] ${fileIconColor(tab.name.split('.').pop())}`}>description</span>
                  <span className="font-code-md text-[13px]">{tab.isDirty ? `${tab.name} •` : tab.name}</span>
                  <span
                    className="material-symbols-outlined text-[14px] ml-1 hover:bg-surface-container-high rounded-full p-px"
                    onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                  >close</span>
                </button>
              ))}
              {openTabs.length === 0 && (
                <div className="flex items-center px-md text-outline text-label-caps">No files open</div>
              )}
              <div style={{ flex: 1 }} />
              <div className="flex items-center px-md gap-sm flex-shrink-0">
                {status === 'running' ? (
                  <button onClick={stopRuntime} className="flex items-center gap-xs bg-error text-on-error text-label-caps px-sm py-0.5 rounded hover:opacity-90 active:scale-95 transition-all">
                    <span className="material-symbols-outlined text-[16px]">stop</span> Stop
                  </button>
                ) : (
                  <button onClick={handleStartRuntime} disabled={!currentWorkspace} className="flex items-center gap-xs bg-secondary text-on-secondary text-label-caps px-sm py-0.5 rounded hover:opacity-90 active:scale-95 transition-all disabled:opacity-40">
                    <span className="material-symbols-outlined text-[16px]">play_arrow</span> Run
                  </button>
                )}
                <button
                  onClick={() => setRightTab(t => t === 'ai' ? 'preview' : 'ai')}
                  className={`material-symbols-outlined text-[20px] transition-colors cursor-pointer ${rightTab === 'ai' ? 'text-secondary' : 'text-outline hover:text-secondary'}`}
                  title="Toggle AI Assistant (Ctrl+I)"
                  style={{ fontVariationSettings: rightTab === 'ai' ? "'FILL' 1" : "'FILL' 0" }}
                >auto_awesome</button>
              </div>
            </div>
            {/* Editor */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
              {activeTab ? (
                <Suspense fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-outline">
                    <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
                  </div>
                }>
                  <MonacoEditor
                    key={activeTab.id}
                    height="100%"
                    language={activeTab.language}
                    theme="vs-dark"
                    value={activeTab.content}
                    onChange={(value: string | undefined) => { if (value !== undefined) updateTabContent(activeTab.id, value); }}
                    onMount={(editor: any, monaco: any) => { 
                      editorRef.current = editor; 
                      registerFimProvider(editor, monaco); 
                      registerSemanticProvider(monaco, editor);
                    }}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    formatOnPaste: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'gutter',
                    bracketPairColorization: { enabled: true },
                    inlineSuggest: { enabled: true },
                  }}
                  />
                </Suspense>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-md text-center technical-grid">
                  <div className="z-10 text-center">
                    <span className="material-symbols-outlined text-5xl text-outline block mb-sm">code</span>
                    <p className="text-body-sm text-outline">Open a file from the Explorer to start editing</p>
                    <p className="text-label-caps text-outline/50 mt-xs">Press Ctrl+I to open AI Assistant</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Preview / AI / Logs ────────────────────────── */}
          <div style={{
            width: 340, minWidth: 280, flexShrink: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
            background: '#0f0f11',
          }}>
            {/* Tab bar */}
            <div className="flex h-9 border-b border-outline-variant bg-surface-container-low flex-shrink-0">
              {rightTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className={`flex items-center gap-xs px-3 h-9 text-[11px] font-bold tracking-widest border-r border-outline-variant transition-all ${
                    rightTab === tab.id
                      ? 'text-secondary border-b-2 border-b-secondary bg-surface'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[15px]"
                    style={{ fontVariationSettings: rightTab === tab.id ? "'FILL' 1" : "'FILL' 0" }}
                  >{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
              {rightTab === 'preview' && status === 'running' && (
                <div className="flex items-center px-2 ml-auto gap-2">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span className="text-[10px] text-secondary font-bold">LIVE</span>
                  <button
                    onClick={() => setAnnotating(a => !a)}
                    title={annotating ? 'Exit annotation mode (Esc)' : 'Annotate preview — draw & send to Nexus'}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: 10, letterSpacing: '0.05em',
                      background: annotating ? 'rgba(255,59,48,0.18)' : 'rgba(255,255,255,0.06)',
                      color: annotating ? '#ff3b30' : '#666',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, fontVariationSettings: annotating ? "'FILL' 1" : "'FILL' 0" }}
                    >draw</span>
                    {annotating ? 'ANNOTATING' : 'ANNOTATE'}
                  </button>
                </div>
              )}
            </div>

            {/* Preview */}
            {rightTab === 'preview' && (
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {status === 'running' && previewUrl ? (
                  <PreviewAnnotationOverlay
                    active={annotating}
                    onActiveChange={setAnnotating}
                    sourceName="Forge Preview"
                  >
                    <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Runtime Preview" />
                  </PreviewAnnotationOverlay>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full technical-grid p-md">
                    <div className="text-center z-10">
                      <span className="material-symbols-outlined text-outline text-4xl block mb-sm">view_in_ar</span>
                      <h2 className="text-title-sm text-secondary-fixed-dim">
                        {status === 'starting' ? 'Starting…' : 'Runtime Suspended'}
                      </h2>
                      <p className="text-body-sm text-outline mt-xs mb-md">
                        {currentWorkspace ? 'Click Run to start' : 'Open a folder first'}
                      </p>
                      {currentWorkspace && status === 'idle' && (
                        <button onClick={handleStartRuntime} className="flex items-center gap-xs bg-secondary text-on-secondary text-label-caps px-md py-1 rounded hover:opacity-90 active:scale-95 transition-all mx-auto">
                          <span className="material-symbols-outlined text-[16px]">play_arrow</span> Start Runtime
                        </button>
                      )}
                      {status === 'starting' && (
                        <span className="material-symbols-outlined animate-spin text-secondary text-2xl mt-sm">progress_activity</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Assistant */}
            {rightTab === 'ai' && (
              <ForgeAiPanel
                activeFileName={activeTab?.name}
                activeLanguage={activeTab?.language}
                getEditorSelection={getEditorSelection}
                getEditorContent={getEditorContent}
                insertAtCursor={insertAtCursor}
              />
            )}

            {/* Logs */}
            {rightTab === 'logs' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 8, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}>
                {logs.length > 0 ? logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: log.type === 'stderr' ? '#cf6679' : log.type === 'system' ? '#2fd9f4' : '#666', userSelect: 'none', flexShrink: 0 }}>
                      {log.type === 'system' ? '[SYS]' : log.type === 'stderr' ? '[ERR]' : '   ➜'}
                    </span>
                    <span style={{ color: log.type === 'stderr' ? '#cf6679' : '#c4c3d4' }}>{log.message}</span>
                  </div>
                )) : (
                  <div style={{ color: '#555', fontStyle: 'italic' }}>No runtime logs yet.</div>
                )}
              </div>
            )}
          </div>

        </div>{/* end top row */}

        {/* ── BOTTOM: Terminal ────────────────────────────────────── */}
        <div style={{
          height: 200, flexShrink: 0,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: '#0d0d10',
        }}>
          {/* Terminal tab bar */}
          <div style={{ height: 32, display: 'flex', alignItems: 'center', background: '#111115', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
            {[{ label: 'Terminal', active: true }, { label: 'Output', active: false }].map(tab => (
              <button
                key={tab.label}
                style={{
                  height: 32, padding: '0 12px',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                  cursor: 'pointer', border: 'none',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
                  borderBottom: tab.active ? '2px solid #2fd9f4' : '2px solid transparent',
                  background: tab.active ? '#0e0e10' : 'transparent',
                  color: tab.active ? '#e4e3f4' : '#555',
                  transition: 'color 0.15s',
                }}
              >{tab.label}</button>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: status === 'running' ? '#2fd9f4' : '#555' }}>
                {status.toUpperCase()}
              </span>
              {status === 'running' && (
                <button
                  onClick={stopRuntime}
                  title="Stop runtime"
                  style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: '#cf6679', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}>stop_circle</span>
                </button>
              )}
              <button
                onClick={() => useRuntimeStore.getState().clearLogs?.()}
                title="Clear logs"
                style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: '#555', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>clear_all</span>
              </button>
            </div>
          </div>
          {/* Terminal output */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.6, color: '#c4c3d4' }}>
            {logs.length > 0 ? logs.map(log => (
              <div key={log.id} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: log.type === 'stderr' ? '#cf6679' : log.type === 'system' ? '#2fd9f4' : '#444', userSelect: 'none', flexShrink: 0 }}>
                  {log.type === 'system' ? '[SYS]' : log.type === 'stderr' ? '[ERR]' : '   '}
                </span>
                <span style={{ color: log.type === 'stderr' ? '#cf6679' : '#c4c3d4' }}>{log.message}</span>
              </div>
            )) : (
              <span style={{ color: '#444', fontStyle: 'italic' }}>
                No runtime logs. Open a workspace folder and click Run to start.
              </span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
