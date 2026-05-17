import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilesystemStore } from '../../core/store/useFilesystemStore';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  category: 'navigate' | 'ai' | 'file' | 'system';
  action: () => void;
  keywords?: string[];
}

interface FileNode {
  path: string;
  name: string;
  is_dir: boolean;
  children?: FileNode[];
}

type PaletteItem =
  | { type: 'command'; command: Command }
  | { type: 'file'; file: FileNode };

const RECENT_COMMANDS_KEY = 'aetherdesk:command_palette_recents';

function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap(node => node.is_dir ? flattenFiles(node.children ?? []) : [node]);
}

function scoreCommand(cmd: Command, q: string): number {
  const label = cmd.label.toLowerCase();
  const base = cmd.label.split(' ').pop()?.toLowerCase() ?? '';
  if (base === q) return 1000;
  if (base.startsWith(q)) return 500;
  if (label.startsWith(q)) return 400;
  if (label.includes(q)) return 250;
  if (cmd.keywords?.some(k => k.startsWith(q))) return 300;
  if (cmd.keywords?.some(k => k.includes(q))) return 150;
  return 0;
}

export const CommandPalette: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { fileTree, openFile } = useFilesystemStore();

  const commands: Command[] = [
    { id: 'nav-nexus', label: 'Open The Nexus', description: 'AI Workspace & Intelligence', icon: 'smart_toy', category: 'navigate', action: () => { navigate('/nexus'); onClose(); }, keywords: ['ai', 'chat', 'intelligence'] },
    { id: 'nav-forge', label: 'Open The Forge', description: 'IDE & Live Runtime', icon: 'terminal', category: 'navigate', action: () => { navigate('/forge'); onClose(); }, keywords: ['editor', 'code', 'ide'] },
    { id: 'nav-loom', label: 'Open The Loom', description: 'Workflow Automation', icon: 'hub', category: 'navigate', action: () => { navigate('/loom'); onClose(); }, keywords: ['workflow', 'automation', 'nodes'] },
    { id: 'nav-settings', label: 'Open Settings', description: 'AI Providers & Configuration', icon: 'settings', category: 'navigate', action: () => { navigate('/settings'); onClose(); }, keywords: ['config', 'ollama', 'keys'] },
    { id: 'ai-new', label: 'New AI Session', description: 'Start a fresh conversation', icon: 'add_comment', category: 'ai', action: () => { navigate('/nexus'); onClose(); }, keywords: ['new', 'session', 'chat'] },
    { id: 'ai-model', label: 'Switch AI Model', description: 'Change the active model', icon: 'bolt', category: 'ai', action: () => { navigate('/settings'); onClose(); }, keywords: ['model', 'llm', 'provider'] },
    { id: 'sys-reload', label: 'Reload Window', description: 'Refresh the application', icon: 'refresh', category: 'system', action: () => { window.location.reload(); }, keywords: ['refresh', 'restart'] },
    { id: 'sys-deploy', label: 'Open Forge', description: 'IDE & Live Runtime', icon: 'rocket_launch', category: 'system', action: () => { navigate('/forge'); onClose(); }, keywords: ['deploy', 'publish', 'ship', 'build'] },
  ];

  const flatFiles = useMemo(() => flattenFiles(fileTree), [fileTree]);
  const queryLower = query.trim().toLowerCase();

  const [recentCommandIds, setRecentCommandIds] = useState<string[]>(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_COMMANDS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const recordRecentCommand = useCallback((id: string) => {
    setRecentCommandIds(current => {
      const next = [id, ...current.filter(item => item !== id)].slice(0, 20);
      try { window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const commandItems = useMemo(() => {
    const scored = commands.map(cmd => ({ cmd, score: queryLower ? scoreCommand(cmd, queryLower) : 0 }));
    const sorted = queryLower
      ? scored.filter(item => item.score > 0).sort((a, b) => b.score - a.score).map(item => item.cmd)
      : [...commands].sort((a, b) => {
        const aIndex = recentCommandIds.indexOf(a.id);
        const bIndex = recentCommandIds.indexOf(b.id);
        if (aIndex !== bIndex) return (aIndex === -1 ? 1 : -1) - (bIndex === -1 ? 1 : -1);
        return a.label.localeCompare(b.label);
      });
    return sorted.map(cmd => ({ type: 'command' as const, command: cmd }));
  }, [commands, queryLower, recentCommandIds]);

  const fileResults = useMemo(() => {
    if (!queryLower) return [];
    return flatFiles.filter(file => file.name.toLowerCase().includes(queryLower) || file.path.toLowerCase().includes(queryLower));
  }, [flatFiles, queryLower]);

  const fileItems = useMemo<PaletteItem[]>(() => fileResults.map(file => ({ type: 'file', file })), [fileResults]);
  const paletteItems = useMemo<PaletteItem[]>(() => [...fileItems, ...commandItems], [fileItems, commandItems]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, paletteItems.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, paletteItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = paletteItems[selectedIndex];
      if (selected?.type === 'command') {
        recordRecentCommand(selected.command.id);
        selected.command.action();
      } else if (selected?.type === 'file') {
        openFile(selected.file);
        navigate('/forge');
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [navigate, onClose, paletteItems, recordRecentCommand, selectedIndex, openFile]);

  const categoryLabels: Record<string, string> = {
    navigate: 'Navigate',
    ai: 'AI Actions',
    file: 'Files',
    system: 'System',
  };

  const groupedFiltered = commandItems.reduce<Record<string, Command[]>>((acc, item) => {
    (acc[item.command.category] ??= []).push(item.command);
    return acc;
  }, {});

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl mx-md glass-panel rounded-xl border border-outline-variant shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 80px rgba(47, 217, 244, 0.08), 0 32px 64px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-sm px-md h-14 border-b border-outline-variant">
          <span className="material-symbols-outlined text-secondary text-[22px]">bolt</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent border-none text-body-base text-on-surface placeholder:text-outline focus:outline-none focus:ring-0"
            placeholder="Search commands, workspaces, files..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="text-label-caps text-outline bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant">ESC</span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-sm">
          {paletteItems.length === 0 ? (
            <div className="text-center py-xl text-outline text-body-sm">No commands or files found for "{query}"</div>
          ) : (
            <>
              {fileResults.length > 0 && (
                <div className="mb-sm">
                  <div className="px-sm py-1 text-label-caps text-outline uppercase tracking-widest">Files</div>
                  {fileResults.map((file, index) => {
                    const globalIndex = index;
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <button
                        key={file.path}
                        className={`w-full flex items-center gap-sm px-sm py-sm rounded transition-all text-left ${
                          isSelected ? 'bg-surface-container-highest border-l-2 border-secondary' : 'hover:bg-surface-container-high'
                        }`}
                        onClick={() => {
                          openFile(file);
                          navigate('/forge');
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <span className={`material-symbols-outlined text-[20px] ${isSelected ? 'text-secondary' : 'text-outline'}`}>description</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-body-sm font-semibold truncate ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>{file.name}</div>
                          <div className="text-label-caps text-outline truncate">{file.path}</div>
                        </div>
                        {isSelected && (
                          <span className="text-label-caps text-outline bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant flex-shrink-0">↵</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {Object.entries(groupedFiltered).map(([category, cmds]) => (
                <div key={category} className="mb-sm">
                  <div className="px-sm py-1 text-label-caps text-outline uppercase tracking-widest">{categoryLabels[category] || category}</div>
                  {cmds.map(cmd => {
                    const globalIndex = paletteItems.findIndex(item => item.type === 'command' && item.command.id === cmd.id);
                    const isSelected = globalIndex === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        className={`w-full flex items-center gap-sm px-sm py-sm rounded transition-all text-left ${
                          isSelected ? 'bg-surface-container-highest border-l-2 border-secondary' : 'hover:bg-surface-container-high'
                        }`}
                        onClick={() => {
                          recordRecentCommand(cmd.id);
                          cmd.action();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <span className={`material-symbols-outlined text-[20px] ${isSelected ? 'text-secondary' : 'text-outline'}`}>{cmd.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-body-sm font-semibold truncate ${isSelected ? 'text-on-surface' : 'text-on-surface-variant'}`}>{cmd.label}</div>
                          {cmd.description && <div className="text-label-caps text-outline truncate">{cmd.description}</div>}
                        </div>
                        {isSelected && (
                          <span className="text-label-caps text-outline bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant flex-shrink-0">↵</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="border-t border-outline-variant px-md py-sm flex items-center gap-md text-label-caps text-outline">
          <span><kbd className="bg-surface-container-high px-1 rounded border border-outline-variant">↑↓</kbd> Navigate</span>
          <span><kbd className="bg-surface-container-high px-1 rounded border border-outline-variant">↵</kbd> Execute</span>
          <span><kbd className="bg-surface-container-high px-1 rounded border border-outline-variant">Esc</kbd> Close</span>
          <span className="ml-auto flex items-center gap-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
            AetherDesk Intelligence
          </span>
        </div>
      </div>
    </div>
  );
};
