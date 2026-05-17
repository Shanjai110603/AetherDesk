import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Window } from '@tauri-apps/api/window';

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
};

// ── Menu Definitions ─────────────────────────────────────────────────────────
const MENUS: Record<string, { label: string; shortcut?: string; action?: () => void; separator?: boolean }[]> = {
  File: [
    { label: 'Open Folder…',       shortcut: 'Ctrl+O' },
    { label: 'New File',           shortcut: 'Ctrl+N' },
    { separator: true, label: '' },
    { label: 'Save',               shortcut: 'Ctrl+S' },
    { label: 'Save All',           shortcut: 'Ctrl+Shift+S' },
    { separator: true, label: '' },
    { label: 'Close Tab',          shortcut: 'Ctrl+W' },
  ],
  Edit: [
    { label: 'Undo',               shortcut: 'Ctrl+Z' },
    { label: 'Redo',               shortcut: 'Ctrl+Y' },
    { separator: true, label: '' },
    { label: 'Find',               shortcut: 'Ctrl+F' },
    { label: 'Replace',            shortcut: 'Ctrl+H' },
    { separator: true, label: '' },
    { label: 'Select All',         shortcut: 'Ctrl+A' },
  ],
  Selection: [
    { label: 'Select Line',        shortcut: 'Ctrl+L' },
    { label: 'Select Word',        shortcut: 'Ctrl+D' },
    { label: 'Expand Selection',   shortcut: 'Shift+Alt+→' },
  ],
  Terminal: [
    { label: 'New Terminal',       shortcut: 'Ctrl+`' },
    { label: 'Clear Terminal' },
    { separator: true, label: '' },
    { label: 'Run Build Task',     shortcut: 'Ctrl+Shift+B' },
    { label: 'Start Dev Server' },
  ],
  View: [
    { label: 'Explorer',           shortcut: 'Ctrl+Shift+E' },
    { label: 'Intelligence',       shortcut: 'Ctrl+Shift+N' },
    { separator: true, label: '' },
    { label: 'Toggle Sidebar' },
    { label: 'Toggle Bottom Panel' },
    { separator: true, label: '' },
    { label: 'Command Palette…',   shortcut: 'Ctrl+K' },
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

  const handleMinimize = () => Window.getCurrent().minimize().catch(() => {});
  const handleMaximize = () => Window.getCurrent().toggleMaximize().catch(() => {});
  const handleClose = () => Window.getCurrent().close().catch(() => {});

  const handleMenuAction = (menuName: string, item: { label: string; shortcut?: string }) => {
    setOpenMenu(null);
    if (menuName === 'View') {
      if (item.label === 'Command Palette…') onCommandPaletteOpen?.();
      if (item.label === 'Intelligence') navigate('/nexus');
      if (item.label === 'Explorer') navigate('/forge');
    }
    if (menuName === 'File') {
      if (item.label === 'Save') document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 's', bubbles: true }));
      if (item.label === 'Open Folder…') navigate('/forge');
      if (item.label === 'New File') navigate('/forge');
      if (item.label === 'Close Tab') document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'w', bubbles: true }));
    }
    if (menuName === 'Edit') {
      if (item.label === 'Find') document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'f', bubbles: true }));
      if (item.label === 'Undo') document.execCommand('undo');
      if (item.label === 'Redo') document.execCommand('redo');
    }
    if (menuName === 'Terminal') {
      if (item.label === 'New Terminal' || item.label === 'Start Dev Server') navigate('/forge');
    }
  };

  return (
    <header
      className="bg-surface-container-low h-9 border-b border-outline-variant flex items-center w-full flex-shrink-0 select-none z-50 relative"
      data-tauri-drag-region
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
              <div className="absolute top-full left-0 mt-0 w-52 bg-surface-container-high border border-outline-variant rounded-lg shadow-2xl z-[100] py-1 overflow-hidden">
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
