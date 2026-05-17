import React, { useEffect, useState, useRef } from 'react';
import type { FileNode } from '../../core/store/useFilesystemStore';

interface Props {
  query: string;
  files: FileNode[]; // Flat or tree? We expect a flat list passed in, or we flatten it here.
  onSelect: (file: FileNode) => void;
  onClose: () => void;
}

export const NexusMentionPalette: React.FC<Props> = ({ query, files, onSelect, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = files.filter(f => !f.is_dir && f.name.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(s => (s + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(s => (s - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelect(filtered[selectedIndex]!);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, { capture: true });
    return () => window.removeEventListener('keydown', handleKey, { capture: true });
  }, [filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    const el = scrollRef.current?.children[selectedIndex] as HTMLElement | undefined;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 8,
        width: 320,
        background: '#1a1a1f',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#ff9500' }}>alternate_email</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#e4e3f4', letterSpacing: '0.05em' }}>MENTION FILE</span>
      </div>
      <div ref={scrollRef} style={{ maxHeight: 240, overflowY: 'auto', padding: 4 }}>
        {filtered.slice(0, 50).map((file, idx) => {
          const isActive = idx === selectedIndex;
          return (
            <div
              key={file.path}
              onClick={() => onSelect(file)}
              onMouseEnter={() => setSelectedIndex(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px',
                borderRadius: 8, cursor: 'pointer',
                background: isActive ? 'rgba(255,149,0,0.1)' : 'transparent',
                outline: isActive ? '1px solid rgba(255,149,0,0.3)' : '1px solid transparent',
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  color: '#ff9500',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>description</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#fff' : '#e4e3f4' }}>{file.name}</span>
                </div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>
                  {file.path}
                </div>
              </div>
              {isActive && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#ff9500', padding: '2px 6px', background: 'rgba(255,149,0,0.1)', borderRadius: 4 }}>
                  ENTER
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
