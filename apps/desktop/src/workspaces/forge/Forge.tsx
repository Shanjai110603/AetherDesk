import React, { useEffect, useCallback, useRef, useState, lazy, Suspense } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useFilesystemStore } from '../../core/store/useFilesystemStore';
import type { FileNode } from '../../core/store/useFilesystemStore';
import { useRuntimeStore } from '../../core/store/useRuntimeStore';
import { useWorkspaceStore } from '../../core/store/useWorkspaceStore';
import { useUiStore } from '../../core/store/useUiStore';
import { ForgeAiPanel } from './ForgeAiPanel';
import { useFimAutocomplete } from '../../core/ai/useFimAutocomplete';
import { useSemanticNavigation } from '../../core/ai/useSemanticNavigation';
import { PreviewAnnotationOverlay } from './PreviewAnnotationOverlay';
import { BuildDeployOverlay } from './BuildDeployOverlay';
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
  const {
    openFile, activeTabId, activeFolderPath, setActiveFolder,
    deletePath, renamePath
  } = useFilesystemStore();
  const isActive = !node.is_dir && activeTabId === node.path;
  const isFolderActive = node.is_dir && activeFolderPath === node.path;

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const type = node.is_dir ? 'folder' : 'file';
    if (confirm(`Are you sure you want to delete this ${type} and all its contents?\n${node.name}`)) {
      await deletePath(node.path);
    }
  }, [node, deletePath]);

  const handleRename = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = prompt(`Enter new name for ${node.name}:`, node.name);
    if (newName && newName.trim() && newName.trim() !== node.name) {
      await renamePath(node.path, newName.trim());
    }
  }, [node, renamePath]);

  const handleNewFileInFolder = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const filename = prompt(`Create new file inside folder "${node.name}":`);
    if (filename && filename.trim()) {
      setActiveFolder(node.path);
      await useFilesystemStore.getState().createFile(filename.trim());
    }
  }, [node, setActiveFolder]);

  const handleNewFolderInFolder = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const foldername = prompt(`Create new folder inside folder "${node.name}":`);
    if (foldername && foldername.trim()) {
      setActiveFolder(node.path);
      await useFilesystemStore.getState().createDirectory(foldername.trim());
    }
  }, [node, setActiveFolder]);

  if (node.is_dir) {
    return (
      <>
        <div
          onClick={() => {
            setExpanded(e => !e);
            setActiveFolder(node.path);
          }}
          className={`group flex items-center justify-between w-full py-0.5 hover:bg-surface-container hover:text-on-surface cursor-pointer transition-colors ${
            isFolderActive
              ? 'bg-secondary/15 text-secondary-fixed-dim border-l-2 border-secondary shadow-[inset_0_0_8px_rgba(47,217,244,0.05)] font-bold'
              : 'text-on-surface-variant'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          <div className="flex items-center gap-xs min-w-0">
            <span className="material-symbols-outlined text-[16px] select-none">{expanded ? 'expand_more' : 'chevron_right'}</span>
            <span className="material-symbols-outlined text-[16px] text-primary select-none">folder</span>
            <span className="text-body-sm truncate">{node.name}</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-[4px] pr-2 transition-opacity flex-shrink-0">
            <button
              onClick={handleNewFileInFolder}
              className="material-symbols-outlined text-[14px] text-outline hover:text-secondary cursor-pointer border-none bg-transparent p-0"
              title="New File Inside"
            >note_add</button>
            <button
              onClick={handleNewFolderInFolder}
              className="material-symbols-outlined text-[14px] text-outline hover:text-secondary cursor-pointer border-none bg-transparent p-0"
              title="New Folder Inside"
            >create_new_folder</button>
            <button
              onClick={handleRename}
              className="material-symbols-outlined text-[14px] text-outline hover:text-secondary cursor-pointer border-none bg-transparent p-0"
              title="Rename Folder"
            >edit</button>
            <button
              onClick={handleDelete}
              className="material-symbols-outlined text-[14px] text-outline hover:text-error cursor-pointer border-none bg-transparent p-0"
              title="Delete Folder"
            >delete</button>
          </div>
        </div>
        {expanded && node.children?.map(child => (
          <TreeNode key={child.path} node={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <div
      onClick={() => openFile(node)}
      className={`group flex items-center justify-between w-full py-0.5 cursor-pointer transition-colors ${
        isActive ? 'bg-surface-container-high text-secondary-fixed-dim' : 'hover:bg-surface-container text-on-surface-variant hover:text-on-surface'
      }`}
      style={{ paddingLeft: `${depth * 14 + 22}px` }}
    >
      <div className="flex items-center gap-xs min-w-0">
        <span className={`material-symbols-outlined text-[16px] ${fileIconColor(node.extension)} select-none`}>description</span>
        <span className="text-body-sm truncate">{node.name}</span>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-[4px] pr-2 transition-opacity flex-shrink-0">
        <button
          onClick={handleRename}
          className="material-symbols-outlined text-[14px] text-outline hover:text-secondary cursor-pointer border-none bg-transparent p-0"
          title="Rename File"
        >edit</button>
        <button
          onClick={handleDelete}
          className="material-symbols-outlined text-[14px] text-outline hover:text-error cursor-pointer border-none bg-transparent p-0"
          title="Delete File"
        >delete</button>
      </div>
    </div>
  );
};

// ── Main Forge Component ──────────────────────────────────────────────────────
export const Forge: React.FC = () => {
  const {
    fileTree, openTabs, activeTabId, isLoading,
    loadDirectory, setActiveTab, closeTab, updateTabContent, saveActiveFile, openFile
  } = useFilesystemStore();
  const {
    status, logs, previewUrl, startRuntime, stopRuntime, addLog, sessionId,
    terminalLogs, spawnTerminal, sendTerminalInput, addTerminalLog
  } = useRuntimeStore();
  const { currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const { isBottomPanelOpen } = useUiStore();
  const editorRef = useRef<any>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const [rightTab, setRightTab] = useState<RightPanelTab>('preview');
  const [bottomTab, setBottomTab] = useState<'terminal' | 'output'>('terminal');
  const [aiActionActive, setAiActionActive] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [terminalInput, setTerminalInput] = useState('');
  const { registerFimProvider } = useFimAutocomplete();
  const { registerSemanticProvider } = useSemanticNavigation();

  const activeTab = openTabs.find(t => t.id === activeTabId);

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

  // ── Open file ─────────────────────────────────────────────────────────────
  const handleOpenFileClick = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: false, multiple: false, title: 'Open File' });
      if (selected && typeof selected === 'string') {
        const name = selected.split(/[\\\/]/).pop() || selected;
        const extension = name.split('.').pop() || '';
        await openFile({ path: selected, name, is_dir: false, extension });
      }
    } catch (err) {
      console.error('Open file failed:', err);
    }
  }, [openFile]);

  // ── New file ──────────────────────────────────────────────────────────────
  const handleNewFile = useCallback(async () => {
    if (!currentWorkspace) {
      alert("Please open a workspace folder first.");
      return;
    }
    const filename = prompt("Enter new file name (e.g. index.js):");
    if (filename && filename.trim()) {
      await useFilesystemStore.getState().createFile(filename.trim());
    }
  }, [currentWorkspace]);

  // ── New folder ────────────────────────────────────────────────────────────
  const handleNewFolder = useCallback(async () => {
    if (!currentWorkspace) {
      alert("Please open a workspace folder first.");
      return;
    }
    const foldername = prompt("Enter new folder name:");
    if (foldername && foldername.trim()) {
      await useFilesystemStore.getState().createDirectory(foldername.trim());
    }
  }, [currentWorkspace]);

  // ── Auto Spawn Interactive Terminal ───────────────────────────────────────
  useEffect(() => {
    if (currentWorkspace?.path) {
      spawnTerminal(currentWorkspace.path);
    }
  }, [currentWorkspace?.path, spawnTerminal]);

  // ── Runtime log listener ──────────────────────────────────────────────────
  useEffect(() => {
    const unlisten = listen<{ type: string; message: string }>(`runtime_log_${sessionId}`, (e) => {
      addLog({ type: e.payload.type as any, message: e.payload.message });
    });
    return () => { unlisten.then(fn => fn()); };
  }, [sessionId, addLog]);

  // ── Interactive Terminal Log Listener ──────────────────────────────────────
  useEffect(() => {
    const unlisten = listen<{ type: string; message: string }>('runtime_log_interactive-terminal', (e) => {
      addTerminalLog({ type: e.payload.type as any, message: e.payload.message });
    });
    return () => { unlisten.then(fn => fn()); };
  }, [addTerminalLog]);

  // ── Auto Scroll Terminal Logs ──────────────────────────────────────────────
  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveActiveFile(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); setRightTab('ai'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); setRightTab('ai'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveActiveFile]);

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && terminalInput.trim()) {
      const cmd = terminalInput.trim();
      setTerminalInput('');
      
      // Log cmd prompt in terminal logs
      addTerminalLog({ type: 'system', message: `PS ${currentWorkspace?.path || 'Workspace'}> ${cmd}` });
      
      if (currentWorkspace) {
        sendTerminalInput(cmd);
      } else {
        addTerminalLog({ type: 'stderr', message: '✗ Error: No active workspace opened. Please open a folder first.' });
      }
    }
  };

  // ── Global Menu Action Listeners (TopAppBar) ──────────────────────────────
  useEffect(() => {
    const handleEditorAction = (e: any) => {
      const action = e.detail;
      const editor = editorRef.current;
      
      if (action === 'save') { saveActiveFile(); return; }
      if (action === 'closeTab' && activeTabId) { closeTab(activeTabId); return; }
      
      if (!editor) return;

      switch (action) {
        case 'undo': editor.trigger(null, 'undo', null); editor.focus(); break;
        case 'redo': editor.trigger(null, 'redo', null); editor.focus(); break;
        case 'cut': editor.trigger(null, 'editor.action.clipboardCutAction', null); editor.focus(); break;
        case 'copy': editor.trigger(null, 'editor.action.clipboardCopyAction', null); editor.focus(); break;
        case 'paste': editor.trigger(null, 'editor.action.clipboardPasteAction', null); editor.focus(); break;
        case 'find': editor.trigger(null, 'actions.find', null); editor.focus(); break;
        case 'replace': editor.trigger(null, 'editor.action.startFindReplaceAction', null); editor.focus(); break;
        case 'commentLine': editor.trigger(null, 'editor.action.commentLine', null); editor.focus(); break;
        case 'blockComment': editor.trigger(null, 'editor.action.blockComment', null); editor.focus(); break;
        
        case 'selectAll': editor.trigger(null, 'editor.action.selectAll', null); editor.focus(); break;
        case 'selectWord': editor.trigger(null, 'editor.action.addSelectionToNextFindMatch', null); editor.focus(); break;
        case 'expandSelection': editor.trigger(null, 'editor.action.smartSelect.expand', null); editor.focus(); break;
        case 'shrinkSelection': editor.trigger(null, 'editor.action.smartSelect.shrink', null); editor.focus(); break;
        case 'copyLineUp': editor.trigger(null, 'editor.action.copyLinesUpAction', null); editor.focus(); break;
        case 'copyLineDown': editor.trigger(null, 'editor.action.copyLinesDownAction', null); editor.focus(); break;
        case 'moveLineUp': editor.trigger(null, 'editor.action.moveLinesUpAction', null); editor.focus(); break;
        case 'moveLineDown': editor.trigger(null, 'editor.action.moveLinesDownAction', null); editor.focus(); break;
        
        case 'wordWrap': editor.trigger(null, 'editor.action.toggleWordWrap', null); editor.focus(); break;
        
        case 'gotoLine': editor.trigger(null, 'editor.action.gotoLine', null); editor.focus(); break;
        case 'gotoSymbol': editor.trigger(null, 'editor.action.quickOutline', null); editor.focus(); break;
        case 'gotoDefinition': editor.trigger(null, 'editor.action.revealDefinition', null); editor.focus(); break;
        case 'gotoReferences': editor.trigger(null, 'editor.action.referenceSearch.trigger', null); editor.focus(); break;
      }
    };
    
    const handleOpenTerminal = () => {
      // Focus terminal input if available
      setTimeout(() => {
        const inputEl = document.querySelector('input[placeholder*="Type command"]') as HTMLInputElement;
        if (inputEl) inputEl.focus();
      }, 50);
    };

    document.addEventListener('aetherdesk:editor-action', handleEditorAction);
    document.addEventListener('aetherdesk:open-terminal', handleOpenTerminal);
    document.addEventListener('aetherdesk:open-folder', handleOpenFolder);
    document.addEventListener('aetherdesk:open-file-dialog', handleOpenFileClick);
    document.addEventListener('aetherdesk:new-file', handleNewFile);
    
    return () => {
      document.removeEventListener('aetherdesk:editor-action', handleEditorAction);
      document.removeEventListener('aetherdesk:open-terminal', handleOpenTerminal);
      document.removeEventListener('aetherdesk:open-folder', handleOpenFolder);
      document.removeEventListener('aetherdesk:open-file-dialog', handleOpenFileClick);
      document.removeEventListener('aetherdesk:new-file', handleNewFile);
    };
  }, [saveActiveFile, activeTabId, closeTab, handleOpenFolder, handleOpenFileClick, handleNewFile]);

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
        <button 
          onClick={() => setDeployOpen(true)}
          className="flex items-center gap-2 bg-secondary text-on-secondary font-bold text-label-caps px-4 py-1 rounded hover:bg-[#1fb5cd] transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
          Deploy
        </button>
        <span className="text-label-caps text-outline/50 hidden lg:block ml-2">Ctrl+I → AI</span>
      </div>

      {deployOpen && <BuildDeployOverlay onClose={() => setDeployOpen(false)} />}

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
            <div className="h-8 flex items-center px-md justify-between bg-surface-container-low flex-shrink-0 gap-xs">
              <span className="text-label-caps font-bold text-on-surface-variant uppercase tracking-widest truncate flex-1">
                {currentWorkspace ? currentWorkspace.name : 'Explorer'}
              </span>
              <div className="flex items-center gap-[6px]">
                {currentWorkspace && (
                  <>
                    <button
                      onClick={handleNewFile}
                      className="material-symbols-outlined text-on-surface-variant hover:text-secondary text-[16px] transition-colors cursor-pointer border-none bg-transparent p-0"
                      title="New File"
                    >note_add</button>
                    <button
                      onClick={handleNewFolder}
                      className="material-symbols-outlined text-on-surface-variant hover:text-secondary text-[16px] transition-colors cursor-pointer border-none bg-transparent p-0"
                      title="New Folder"
                    >create_new_folder</button>
                    <button
                      onClick={() => loadDirectory(currentWorkspace.path)}
                      className="material-symbols-outlined text-on-surface-variant hover:text-secondary text-[16px] transition-colors cursor-pointer border-none bg-transparent p-0"
                      title="Refresh Explorer"
                    >sync</button>
                  </>
                )}
                <button
                  onClick={handleOpenFolder}
                  className="material-symbols-outlined text-on-surface-variant hover:text-secondary text-[18px] transition-colors cursor-pointer border-none bg-transparent p-0"
                  title="Open Folder"
                >folder_open</button>
              </div>
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
                <div className="flex flex-col items-center justify-center h-full gap-lg text-center technical-grid select-none relative bg-gradient-to-b from-[#13131b]/30 to-[#0c0c11]/80">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(47,217,244,0.03)_0%,transparent_70%)] pointer-events-none" />
                  <div className="z-10 text-center flex flex-col items-center max-w-lg px-lg">
                    {/* Minimalist caret A logo SVG */}
                    <div className="w-24 h-24 mb-md filter drop-shadow-[0_0_20px_rgba(192,193,255,0.15)] transition-transform duration-500 hover:scale-105 active:scale-95 cursor-pointer">
                      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                        <path d="M50 15 L82 78 L68 78 L50 42 L32 78 L18 78 Z" fill="#e1e0ff" />
                        <path d="M50 28 L72 72 L62 72 L50 48 L38 72 L28 72 Z" fill="#2fd9f4" className="opacity-80" />
                        <circle cx="50" cy="54" r="3" fill="#e1e0ff" className="animate-pulse" />
                      </svg>
                    </div>

                    <h1 className="text-display-lg font-bold text-on-surface font-headline-md leading-none select-none tracking-tight">
                      Aether <span className="text-secondary">Desk</span>
                    </h1>
                    <p className="text-body-sm text-outline mt-sm select-none max-w-sm mb-lg">
                      State-of-the-art secure agentic desktop workspace for professional developers.
                    </p>

                    {/* Premium glassmorphic keyboard shortcuts list */}
                    <div className="w-full space-y-sm bg-surface-container/30 border border-outline-variant/30 backdrop-blur-xl p-md rounded-xl shadow-2xl">
                      {[
                        { label: 'Code with Agent', keys: ['Ctrl', 'L'] },
                        { label: 'AI Workspace Actions', keys: ['Ctrl', 'I'] },
                        { label: 'Command Palette', keys: ['Ctrl', 'Shift', 'P'] },
                        { label: 'Open Workspace Folder', keys: ['Ctrl', 'O'] },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between py-1 border-b border-outline-variant/10 last:border-none">
                          <span className="text-[12px] text-on-surface-variant font-medium select-none">{item.label}</span>
                          <div className="flex gap-xs">
                            {item.keys.map(k => (
                              <kbd key={k} className="bg-surface-container-highest border border-outline-variant/40 rounded px-1.5 py-0.5 text-[10px] font-semibold text-on-surface font-code-md shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
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
        {isBottomPanelOpen && (
          <div style={{
            height: 200, flexShrink: 0,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            background: '#0d0d10',
          }}>
            {/* Terminal tab bar */}
            <div style={{ height: 32, display: 'flex', alignItems: 'center', background: '#111115', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              {(['terminal', 'output'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setBottomTab(tab)}
                  style={{
                    height: 32, padding: '0 12px',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                    cursor: 'pointer', border: 'none',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: bottomTab === tab ? '2px solid #2fd9f4' : '2px solid transparent',
                    background: bottomTab === tab ? '#0e0e10' : 'transparent',
                    color: bottomTab === tab ? '#e4e3f4' : '#555',
                    transition: 'color 0.15s',
                  }}
                >{tab === 'terminal' ? 'Terminal' : 'Output'}</button>
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
                  onClick={() => {
                    if (bottomTab === 'terminal') useRuntimeStore.getState().clearTerminalLogs();
                    else useRuntimeStore.getState().clearLogs();
                  }}
                  title="Clear"
                  style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: '#555', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>clear_all</span>
                </button>
              </div>
            </div>
            {/* Terminal / Output content */}
            {bottomTab === 'terminal' ? (
              <>
                <div 
                  ref={terminalContainerRef}
                  style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.6, color: '#c4c3d4' }}
                >
                  {terminalLogs.length > 0 ? terminalLogs.map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: log.type === 'stderr' ? '#cf6679' : log.type === 'system' ? '#2fd9f4' : '#444', userSelect: 'none', flexShrink: 0 }}>
                        {log.type === 'system' ? '[SYS]' : log.type === 'stderr' ? '[ERR]' : '   '}
                      </span>
                      <span style={{ color: log.type === 'stderr' ? '#cf6679' : '#c4c3d4' }}>{log.message}</span>
                    </div>
                  )) : (
                    <span style={{ color: '#444', fontStyle: 'italic' }}>
                      No active shell running. Open a workspace folder to initialize PowerShell.
                    </span>
                  )}
                </div>
                {/* Interactive Console Prompt */}
                <div className="flex items-center gap-xs px-3 py-1.5 bg-[#0a0a0c] border-t border-outline-variant/20 flex-shrink-0 z-10">
                  <span className="text-[12px] font-code-md text-secondary select-none font-bold">
                    {currentWorkspace ? `${currentWorkspace.path.split(/[\\\/]/).pop() || 'Workspace'} ➜` : 'AetherDesk ➜'}
                  </span>
                  <input
                    type="text"
                    placeholder="Type command and press Enter (e.g. npm install, git status)..."
                    value={terminalInput}
                    onChange={e => setTerminalInput(e.target.value)}
                    onKeyDown={handleTerminalKeyDown}
                    className="flex-1 bg-transparent border-none text-[12px] font-code-md text-[#e4e3f4] focus:outline-none placeholder:text-outline/30 font-semibold"
                  />
                </div>
              </>
            ) : (
              /* Output tab: runtime build logs */
              <div
                style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.6 }}
              >
                {logs.length > 0 ? logs.map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: log.type === 'stderr' ? '#cf6679' : log.type === 'system' ? '#2fd9f4' : '#666', userSelect: 'none', flexShrink: 0 }}>
                      {log.type === 'system' ? '[SYS]' : log.type === 'stderr' ? '[ERR]' : '   ➜'}
                    </span>
                    <span style={{ color: log.type === 'stderr' ? '#cf6679' : '#c4c3d4' }}>{log.message}</span>
                  </div>
                )) : (
                  <span style={{ color: '#444', fontStyle: 'italic' }}>
                    No runtime output yet. Click Run to start a dev server.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
