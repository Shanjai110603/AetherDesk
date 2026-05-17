import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NEXUS_SLASH_COMMANDS, type SlashCommand } from './nexusCommands';

interface Props {
  query: string;
  commands?: SlashCommand[];
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export const NexusSlashPalette: React.FC<Props> = ({
  query,
  commands = NEXUS_SLASH_COMMANDS,
  onSelect,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.id.includes(q)
    );
  }, [commands, query]);

  useEffect(() => setActiveIndex(0), [query]);

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
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
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
      <div style={{ padding: '7px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#2fd9f4' }}>terminal</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#2fd9f4', letterSpacing: '0.12em' }}>SLASH COMMANDS</span>
        {query && <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>filtering: "{query}"</span>}
      </div>

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
                background: isActive ? `${cmd.color}1f` : 'transparent',
                outline: isActive ? `1px solid ${cmd.color}33` : '1px solid transparent',
                transition: 'all 0.1s',
              }}
            >
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
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: cmd.color, fontVariationSettings: "'FILL' 1" }}>
                  {cmd.icon}
                </span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? cmd.color : '#e4e3f4', fontFamily: 'monospace' }}>
                  {cmd.label}
                </span>
                <span style={{ fontSize: 11, color: '#666', display: 'block', marginTop: 1 }}>
                  {cmd.description}
                </span>
              </div>

              {isActive && (
                <span style={{ fontSize: 9, fontWeight: 700, color: '#777', letterSpacing: '0.05em', background: 'rgba(255,255,255,0.05)', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>
                  ENTER
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
