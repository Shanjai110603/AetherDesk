import React, { useEffect, useRef } from 'react';

// ── Slash Command Registry ─────────────────────────────────────────────────────

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  /** The text that replaces the slash trigger in the composer */
  insert: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'agent',
    label: '/agent',
    description: 'Invoke an AI sub-agent to run an autonomous task',
    icon: 'smart_toy',
    color: '#8b5cf6',
    insert: '/agent ',
  },
  {
    id: 'read',
    label: '/read',
    description: 'Read and attach a file from the workspace',
    icon: 'folder_open',
    color: '#2fd9f4',
    insert: '/read ',
  },
  {
    id: 'sketch',
    label: '/sketch',
    description: 'Attach the current Artisan sketch as context',
    icon: 'draw',
    color: '#f59e0b',
    insert: '/sketch',
  },
  {
    id: 'analyze',
    label: '/analyze',
    description: 'Analyze the active file or project context',
    icon: 'analytics',
    color: '#4ade80',
    insert: '/analyze ',
  },
  {
    id: 'search',
    label: '/search',
    description: 'Search codebase or web for information',
    icon: 'manage_search',
    color: '#f87171',
    insert: '/search ',
  },
  {
    id: 'summarize',
    label: '/summarize',
    description: 'Summarize the current session or document',
    icon: 'auto_stories',
    color: '#a78bfa',
    insert: '/summarize',
  },
  {
    id: 'forge',
    label: '/forge',
    description: 'Send instructions directly to the Forge workspace',
    icon: 'code_blocks',
    color: '#fb923c',
    insert: '/forge ',
  },
  {
    id: 'refactor',
    label: '/refactor',
    description: 'Ask Aether to refactor the selected code',
    icon: 'auto_fix_high',
    color: '#34d399',
    insert: '/refactor ',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  query: string;           // text after the '/' trigger
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export const NexusSlashPalette: React.FC<Props> = ({ query, onSelect, onClose }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const filtered = SLASH_COMMANDS.filter(
    c => c.label.includes(query.toLowerCase()) || c.description.toLowerCase().includes(query.toLowerCase())
  );

  // Reset active when filter changes
  React.useEffect(() => { setActiveIndex(0); }, [query]);

  // Keyboard nav — arrow keys + enter + escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[activeIndex];
        if (cmd) onSelect(cmd);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, activeIndex, onSelect, onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        right: 0,
        marginBottom: 6,
        background: 'rgba(15,15,17,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 14,
        boxShadow: '0 -16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '7px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 13, color: '#2fd9f4' }}
        >
          terminal
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#2fd9f4', letterSpacing: '0.12em' }}>
          SLASH COMMANDS
        </span>
        {query && (
          <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>
            — filtering: "{query}"
          </span>
        )}
      </div>

      {/* Command list */}
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: 6 }}>
        {filtered.map((cmd, idx) => {
          const isActive = idx === activeIndex;
          return (
            <button
              key={cmd.id}
              onClick={() => onSelect(cmd)}
              onMouseEnter={() => setActiveIndex(idx)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                background: isActive
                  ? `rgba(${hexToRgb(cmd.color)},0.12)`
                  : 'transparent',
                outline: isActive ? `1px solid ${cmd.color}33` : '1px solid transparent',
                transition: 'all 0.1s',
              }}
            >
              {/* Icon bubble */}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: `${cmd.color}18`,
                  border: `1px solid ${cmd.color}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 15, color: cmd.color, fontVariationSettings: "'FILL' 1" }}
                >
                  {cmd.icon}
                </span>
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? cmd.color : '#e4e3f4', fontFamily: 'monospace' }}>
                    {cmd.label}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#666', display: 'block', marginTop: 1 }}>
                  {cmd.description}
                </span>
              </div>

              {/* Keyboard hint */}
              {isActive && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#444',
                    letterSpacing: '0.05em',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 4,
                    padding: '2px 5px',
                    flexShrink: 0,
                  }}
                >
                  ↵ INSERT
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '5px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          gap: 12,
        }}
      >
        {[['↑↓', 'Navigate'], ['↵', 'Select'], ['Esc', 'Dismiss']].map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd style={{ fontSize: 9, background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', color: '#aaa', fontFamily: 'monospace' }}>{key}</kbd>
            <span style={{ fontSize: 9, color: '#555' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Utility ───────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
