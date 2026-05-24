import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useUiStore } from '../../core/store/useUiStore';
import { useWorkspaceStore } from '../../core/store/useWorkspaceStore';
import { useRuntimeStore } from '../../core/store/useRuntimeStore';

interface TopAppBarProps {
  onCommandPaletteOpen?: () => void;
}

const routeLabels: Record<string, string> = {
  '/nexus': 'Intelligence',
  '/forge': 'Forge',
  '/artisan': 'Artisan',
  '/loom': 'Loom',
  '/browser': 'Browser',
  '/swarm': 'Swarm Registry',
  '/settings': 'Settings',
  '/features': 'Welcome',
};

// ── Menu Definitions ─────────────────────────────────────────────────────────
const MENUS: Record<string, { label?: string; shortcut?: string; separator?: boolean }[]> = {
  File: [
    { label: 'New Text File',           shortcut: 'Ctrl+N' },
    { label: 'New File…',               shortcut: 'Ctrl+Alt+Win+N' },
    { label: 'New Window',              shortcut: 'Ctrl+Shift+N' },
    { label: 'New Window with Profile' },
    { separator: true },
    { label: 'Open File…',              shortcut: 'Ctrl+O' },
    { label: 'Open Folder…',            shortcut: 'Ctrl+K Ctrl+O' },
    { label: 'Open Workspace from File…' },
    { label: 'Open Recent' },
    { separator: true },
    { label: 'Add Folder to Workspace…' },
    { label: 'Save Workspace As…' },
    { label: 'Duplicate Workspace' },
    { separator: true },
    { label: 'Save',                    shortcut: 'Ctrl+S' },
    { label: 'Save As…',                shortcut: 'Ctrl+Shift+S' },
    { label: 'Save All' },
    { separator: true },
    { label: 'Share' },
    { separator: true },
    { label: 'Auto Save' },
    { label: 'Preferences' },
    { separator: true },
    { label: 'Revert File' },
    { label: 'Close Editor',            shortcut: 'Ctrl+F4' },
    { label: 'Close Folder',            shortcut: 'Ctrl+K F' },
    { label: 'Close Window',            shortcut: 'Alt+F4' },
    { separator: true },
    { label: 'Exit' },
  ],
  Edit: [
    { label: 'Undo',                    shortcut: 'Ctrl+Z' },
    { label: 'Redo',                    shortcut: 'Ctrl+Y' },
    { separator: true },
    { label: 'Cut',                     shortcut: 'Ctrl+X' },
    { label: 'Copy',                    shortcut: 'Ctrl+C' },
    { label: 'Paste',                   shortcut: 'Ctrl+V' },
    { separator: true },
    { label: 'Find',                    shortcut: 'Ctrl+F' },
    { label: 'Replace',                 shortcut: 'Ctrl+H' },
    { separator: true },
    { label: 'Find in Files',           shortcut: 'Ctrl+Shift+F' },
    { label: 'Replace in Files',        shortcut: 'Ctrl+Shift+H' },
    { separator: true },
    { label: 'Toggle Line Comment',     shortcut: 'Ctrl+/' },
    { label: 'Toggle Block Comment',    shortcut: 'Shift+Alt+A' },
    { label: 'Emmet: Expand Abbreviation', shortcut: 'Tab' },
  ],
  Selection: [
    { label: 'Select All',              shortcut: 'Ctrl+A' },
    { label: 'Expand Selection',        shortcut: 'Shift+Alt+→' },
    { label: 'Shrink Selection',        shortcut: 'Shift+Alt+←' },
    { separator: true },
    { label: 'Copy Line Up',            shortcut: 'Shift+Alt+↑' },
    { label: 'Copy Line Down',          shortcut: 'Shift+Alt+↓' },
    { label: 'Move Line Up',            shortcut: 'Alt+↑' },
    { label: 'Move Line Down',          shortcut: 'Alt+↓' },
    { label: 'Duplicate Selection' },
    { separator: true },
    { label: 'Add Cursor Above',        shortcut: 'Ctrl+Alt+↑' },
    { label: 'Add Cursor Below',        shortcut: 'Ctrl+Alt+↓' },
    { label: 'Add Cursors to Line Ends', shortcut: 'Shift+Alt+I' },
    { label: 'Add Next Occurrence',     shortcut: 'Ctrl+D' },
    { label: 'Add Previous Occurrence' },
    { label: 'Select All Occurrences' },
    { separator: true },
    { label: 'Switch to Ctrl+Click for Multi-Cursor' },
    { label: 'Column Selection Mode' },
  ],
  View: [
    { label: 'Command Palette…',        shortcut: 'Ctrl+Shift+P' },
    { label: 'Open View…' },
    { separator: true },
    { label: 'Appearance' },
    { label: 'Editor Layout' },
    { separator: true },
    { label: 'Explorer',                shortcut: 'Ctrl+Shift+E' },
    { label: 'Search',                  shortcut: 'Ctrl+Shift+F' },
    { label: 'Source Control',          shortcut: 'Ctrl+Shift+G' },
    { label: 'Run',                     shortcut: 'Ctrl+Shift+D' },
    { label: 'Extensions',              shortcut: 'Ctrl+Shift+X' },
    { separator: true },
    { label: 'Problems',                shortcut: 'Ctrl+Shift+M' },
    { label: 'Output',                  shortcut: 'Ctrl+Shift+U' },
    { label: 'Debug Console',            shortcut: 'Ctrl+Shift+Y' },
    { label: 'Terminal',                shortcut: 'Ctrl+`' },
    { separator: true },
    { label: 'Word Wrap',               shortcut: 'Alt+Z' },
    { separator: true },
    { label: 'Toggle Sidebar' },
    { label: 'Toggle Bottom Panel' },
  ],
  Go: [
    { label: 'Back',                    shortcut: 'Alt+←' },
    { label: 'Forward',                 shortcut: 'Alt+→' },
    { label: 'Last Edit Location',      shortcut: 'Ctrl+K Ctrl+Q' },
    { separator: true },
    { label: 'Switch Editor' },
    { label: 'Switch Group' },
    { separator: true },
    { label: 'Go to File…',             shortcut: 'Ctrl+P' },
    { label: 'Go to Symbol in Workspace…', shortcut: 'Ctrl+T' },
    { separator: true },
    { label: 'Go to Symbol in Editor…',  shortcut: 'Ctrl+Shift+O' },
    { label: 'Go to Definition',        shortcut: 'F12' },
    { label: 'Go to Declaration' },
    { label: 'Go to Type Definition' },
    { label: 'Go to Implementations',   shortcut: 'Ctrl+F12' },
    { label: 'Go to References',        shortcut: 'Shift+F12' },
    { separator: true },
    { label: 'Go to Line/Column…',      shortcut: 'Ctrl+G' },
    { label: 'Go to Bracket',           shortcut: 'Ctrl+Shift+\\' },
    { separator: true },
    { label: 'Next Problem',            shortcut: 'F8' },
    { label: 'Previous Problem',        shortcut: 'Shift+F8' },
    { separator: true },
    { label: 'Next Change',             shortcut: 'Alt+F3' },
    { label: 'Previous Change',         shortcut: 'Shift+Alt+F3' },
  ],
  Run: [
    { label: 'Start Debugging',         shortcut: 'F5' },
    { label: 'Run Without Debugging',   shortcut: 'Ctrl+F5' },
    { label: 'Stop Debugging',          shortcut: 'Shift+F5' },
    { label: 'Restart Debugging',       shortcut: 'Ctrl+Shift+F5' },
    { separator: true },
    { label: 'Open Configurations' },
    { label: 'Add Configuration…' },
    { separator: true },
    { label: 'Step Over',               shortcut: 'F10' },
    { label: 'Step Into',               shortcut: 'F11' },
    { label: 'Step Out',                shortcut: 'Shift+F11' },
    { label: 'Continue',                shortcut: 'F5' },
    { separator: true },
    { label: 'Toggle Breakpoint',       shortcut: 'F9' },
    { label: 'New Breakpoint' },
    { separator: true },
    { label: 'Enable All Breakpoints' },
    { label: 'Disable All Breakpoints' },
    { label: 'Remove All Breakpoints' },
    { separator: true },
    { label: 'Install Additional Debuggers…' },
  ],
  Terminal: [
    { label: 'New Terminal',            shortcut: 'Ctrl+Shift+`' },
    { label: 'Split Terminal',          shortcut: 'Ctrl+Shift+5' },
    { label: 'New Terminal Window',     shortcut: 'Ctrl+Shift+Alt+`' },
    { separator: true },
    { label: 'Run Task…' },
    { label: 'Run Build Task…',         shortcut: 'Ctrl+Shift+B' },
    { label: 'Run Active File' },
    { label: 'Run Selected Text' },
    { separator: true },
    { label: 'Show Running Tasks…' },
    { label: 'Restart Running Task…' },
    { label: 'Terminate Task…' },
    { separator: true },
    { label: 'Configure Tasks…' },
    { label: 'Configure Default Build Task…' },
    { separator: true },
    { label: 'Clear Terminal' },
    { label: 'Start Dev Server' },
  ],
  Help: [
    { label: 'Welcome' },
    { label: 'Show All Commands',       shortcut: 'Ctrl+Shift+P' },
    { label: 'Editor Playground' },
    { label: 'Open Walkthrough…' },
    { label: 'Provide Feedback' },
    { label: 'Download Diagnostics' },
    { separator: true },
    { label: 'View License' },
    { separator: true },
    { label: 'Toggle Developer Tools' },
    { label: 'Open Process Explorer' },
    { separator: true },
    { label: 'Check for Updates…' },
    { separator: true },
    { label: 'About' },
  ],
};

export const TopAppBar: React.FC<TopAppBarProps> = ({ onCommandPaletteOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentLabel = routeLabels[location.pathname] || 'AetherDesk';

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMinimize = () => {
    try {
      getCurrentWindow().minimize().catch(console.error);
    } catch (e) {
      console.warn("Minimize window is only supported in desktop environment", e);
    }
  };

  const handleMaximize = () => {
    try {
      getCurrentWindow().toggleMaximize().catch(console.error);
    } catch (e) {
      console.warn("Maximize window is only supported in desktop environment", e);
    }
  };

  const handleClose = () => {
    try {
      getCurrentWindow().close().catch(console.error);
    } catch (e) {
      console.warn("Close window is only supported in desktop environment", e);
    }
  };

  const handleMenuAction = (menuName: string, item: { label?: string; shortcut?: string }) => {
    setOpenMenu(null);
    
    // ── File Actions ──────────────────────────────────────────────────────────
    if (menuName === 'File') {
      if (item.label === 'New Text File' || item.label === 'New File…') {
        navigate('/forge');
        setTimeout(() => document.dispatchEvent(new CustomEvent('aetherdesk:new-file')), 150);
      }
      if (item.label === 'Open File…') {
        navigate('/forge');
        setTimeout(() => document.dispatchEvent(new CustomEvent('aetherdesk:open-file-dialog')), 150);
      }
      if (item.label === 'Open Folder…') {
        navigate('/forge');
        setTimeout(() => document.dispatchEvent(new CustomEvent('aetherdesk:open-folder')), 150);
      }
      if (item.label === 'Save' || item.label === 'Save All') {
        document.dispatchEvent(new CustomEvent('aetherdesk:editor-action', { detail: 'save' }));
      }
      if (item.label === 'Close Editor') {
        document.dispatchEvent(new CustomEvent('aetherdesk:editor-action', { detail: 'closeTab' }));
      }
      if (item.label === 'Close Folder') {
        useWorkspaceStore.getState().setCurrentWorkspace(null);
        navigate('/features');
      }
      if (item.label === 'Preferences') {
        navigate('/settings');
      }
      if (item.label === 'Exit') {
        handleClose();
      }
    }

    // ── Edit Actions ──────────────────────────────────────────────────────────
    if (menuName === 'Edit') {
      const map: Record<string, string> = {
        'Undo': 'undo', 'Redo': 'redo', 'Cut': 'cut', 'Copy': 'copy', 'Paste': 'paste',
        'Find': 'find', 'Replace': 'replace',
        'Toggle Line Comment': 'commentLine', 'Toggle Block Comment': 'blockComment'
      };
      const detail = map[item.label || ''];
      if (detail) {
        navigate('/forge');
        setTimeout(() => document.dispatchEvent(new CustomEvent('aetherdesk:editor-action', { detail })), 100);
      }
    }

    // ── Selection Actions ─────────────────────────────────────────────────────
    if (menuName === 'Selection') {
      const map: Record<string, string> = {
        'Select All': 'selectAll',
        'Expand Selection': 'expandSelection',
        'Shrink Selection': 'shrinkSelection',
        'Copy Line Up': 'copyLineUp',
        'Copy Line Down': 'copyLineDown',
        'Move Line Up': 'moveLineUp',
        'Move Line Down': 'moveLineDown'
      };
      const detail = map[item.label || ''];
      if (detail) {
        navigate('/forge');
        setTimeout(() => document.dispatchEvent(new CustomEvent('aetherdesk:editor-action', { detail })), 100);
      }
    }

    // ── View Actions ──────────────────────────────────────────────────────────
    if (menuName === 'View') {
      if (item.label === 'Command Palette…' || item.label === 'Search') onCommandPaletteOpen?.();
      if (item.label === 'Explorer' || item.label === 'Run') navigate('/forge');
      if (item.label === 'Toggle Sidebar') useUiStore.getState().toggleSidebar();
      if (item.label === 'Toggle Bottom Panel') useUiStore.getState().toggleBottomPanel();
      if (item.label === 'Terminal' || item.label === 'Output') {
        navigate('/forge');
        useUiStore.getState().setBottomPanelOpen(true);
        setTimeout(() => document.dispatchEvent(new CustomEvent('aetherdesk:open-terminal')), 150);
      }
      if (item.label === 'Word Wrap') {
        document.dispatchEvent(new CustomEvent('aetherdesk:editor-action', { detail: 'wordWrap' }));
      }
    }

    // ── Go Actions ────────────────────────────────────────────────────────────
    if (menuName === 'Go') {
      const map: Record<string, string> = {
        'Go to File…': 'goToFile',
        'Go to Line/Column…': 'gotoLine',
        'Go to Symbol in Editor…': 'gotoSymbol',
        'Go to Definition': 'gotoDefinition',
        'Go to References': 'gotoReferences'
      };
      const detail = map[item.label || ''];
      if (detail === 'goToFile') {
        onCommandPaletteOpen?.();
      } else if (detail) {
        navigate('/forge');
        setTimeout(() => document.dispatchEvent(new CustomEvent('aetherdesk:editor-action', { detail })), 100);
      }
    }

    // ── Run Actions ───────────────────────────────────────────────────────────
    if (menuName === 'Run') {
      if (item.label === 'Start Debugging' || item.label === 'Run Without Debugging' || item.label === 'Continue') {
        navigate('/forge');
        const wsPath = useWorkspaceStore.getState().currentWorkspace?.path;
        if (wsPath) {
          setTimeout(() => useRuntimeStore.getState().startRuntime(wsPath, 'npm run dev'), 150);
        } else {
          alert("Please open a workspace folder first to run build/dev scripts.");
        }
      }
    }

    // ── Terminal Actions ──────────────────────────────────────────────────────
    if (menuName === 'Terminal') {
      const wsPath = useWorkspaceStore.getState().currentWorkspace?.path;
      if (item.label === 'New Terminal') {
        navigate('/forge');
        useUiStore.getState().setBottomPanelOpen(true);
        setTimeout(() => document.dispatchEvent(new CustomEvent('aetherdesk:open-terminal')), 150);
      }
      if (item.label === 'Start Dev Server') {
        navigate('/forge');
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('aetherdesk:open-terminal'));
          if (wsPath) {
            useRuntimeStore.getState().startRuntime(wsPath, 'npm run dev');
          } else {
            alert("Please open a folder first to run dev server.");
          }
        }, 150);
      }
      if (item.label === 'Run Build Task…') {
        navigate('/forge');
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('aetherdesk:open-terminal'));
          if (wsPath) {
            useRuntimeStore.getState().startRuntime(wsPath, 'npm run build');
          } else {
            alert("Please open a folder first to run build.");
          }
        }, 150);
      }
      if (item.label === 'Clear Terminal') {
        useRuntimeStore.getState().clearTerminalLogs();
      }
    }

    // ── Help Actions ──────────────────────────────────────────────────────────
    if (menuName === 'Help') {
      if (item.label === 'Welcome' || item.label === 'Open Walkthrough…') {
        navigate('/features');
      }
      if (item.label === 'About') {
        alert("AetherDesk v2.0\nSecure Agentic Coding Suite\nLocal-first intelligence routing workspace.");
      }
      if (item.label === 'View License') {
        alert("AetherDesk Enterprise License v2.0\nAll rights reserved.");
      }
      if (item.label === 'Toggle Developer Tools') {
        console.log("Web Inspector is active and ready.");
      }
      if (item.label === 'Show All Commands') {
        onCommandPaletteOpen?.();
      }
    }
  };

  return (
    <header
      className="bg-surface-container-low h-9 border-b border-outline-variant flex items-center w-full flex-shrink-0 select-none z-50 relative"
    >
      {/* Left: Logo + route */}
      <div className="flex items-center pl-3 pointer-events-none" data-tauri-drag-region>
        <span className="text-[13px] font-bold text-on-surface-variant pr-2">AetherDesk</span>
        <span className="w-px h-3.5 bg-outline-variant mx-2" />
        <span className="text-[12px] text-outline">{currentLabel}</span>
      </div>

      {/* Center: Dropdown Menus */}
      <nav className="flex items-center ml-2 pointer-events-auto relative z-50" ref={menuRef}>
        {Object.keys(MENUS).map(menuName => (
          <div key={menuName} className="relative">
            <button
              className={`px-2.5 h-9 text-[12px] transition-colors ${
                openMenu === menuName
                  ? 'text-on-surface bg-surface-container-high'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
              onClick={() => setOpenMenu(openMenu === menuName ? null : menuName)}
              onMouseEnter={() => openMenu ? setOpenMenu(menuName) : undefined}
            >
              {menuName}
            </button>

            {openMenu === menuName && (
              <div className="absolute top-full left-0 mt-0 min-w-[260px] w-max max-w-[320px] bg-surface-container-high border border-outline-variant rounded-lg shadow-2xl z-[100] py-1 overflow-hidden">
                {MENUS[menuName].map((item, i) =>
                  item.separator ? (
                    <div key={i} className="h-px bg-outline-variant/40 my-1" />
                  ) : (
                    <button
                      key={item.label}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[12px] text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors text-left"
                      onClick={() => handleMenuAction(menuName, item)}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <span className="text-[10px] text-outline ml-4 flex-shrink-0">{item.shortcut}</span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="flex-1" data-tauri-drag-region />

      {/* Right: Search + Deploy + Window controls */}
      <div className="flex items-center gap-2 pr-2 pointer-events-auto">
        <button
          onClick={onCommandPaletteOpen}
          className="flex items-center gap-1.5 bg-surface-container-high rounded px-2.5 h-6 border border-transparent hover:border-outline-variant transition-all w-48 text-left"
        >
          <span className="material-symbols-outlined text-[14px] text-outline">search</span>
          <span className="flex-1 text-[12px] text-outline">Search…</span>
          <span className="text-[10px] text-outline bg-surface-dim px-1 rounded">⌘K</span>
        </button>

        <button
          onClick={() => navigate('/forge')}
          className="bg-primary text-on-primary px-3 h-6 rounded text-[11px] font-bold hover:opacity-90 active:scale-95 transition-all"
        >
          Open Forge
        </button>

        {/* Window controls — Tauri only, gracefully fails in browser */}
        <div className="flex items-center gap-0.5 ml-1">
          <button onClick={handleMinimize} className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors">
            <span className="material-symbols-outlined text-[16px]">minimize</span>
          </button>
          <button onClick={handleMaximize} className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded transition-colors">
            <span className="material-symbols-outlined text-[16px]">close_fullscreen</span>
          </button>
          <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-on-error hover:bg-error rounded transition-colors">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>
    </header>
  );
};
