import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SketchItem, SketchTool } from '../../core/artisan/sketchTypes';
import { dispatchAnnotation } from '../../core/events/aetherDeskEvents';
import { useWorkspaceStore } from '../../core/store/useWorkspaceStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#ffffff', '#e4e3f4', '#2fd9f4', '#cf6679', '#f7df1e',
  '#4caf50', '#ff3b30', '#ff9500', '#8b5cf6', '#000000',
];

const TOOL_CONFIG: { id: SketchTool; icon: string; title: string }[] = [
  { id: 'pen',    icon: 'edit',          title: 'Pen (freehand)' },
  { id: 'rect',   icon: 'crop_square',   title: 'Rectangle' },
  { id: 'arrow',  icon: 'trending_flat', title: 'Arrow' },
  { id: 'text',   icon: 'title',         title: 'Text' },
  { id: 'eraser', icon: 'ink_eraser',    title: 'Eraser' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  items: SketchItem[];
  onItemsChange: (items: SketchItem[]) => void;
  onClose: () => void;
}

export const SketchLayer: React.FC<Props> = ({ items, onItemsChange, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { currentWorkspace } = useWorkspaceStore();
  const [tool, setTool] = useState<SketchTool>('pen');
  const [color, setColor] = useState('#2fd9f4');
  const [size, setSize] = useState(2);
  const drawingRef = useRef<SketchItem | null>(null);

  // Text modal state (Tauri-safe: no window.prompt)
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [textModalValue, setTextModalValue] = useState('');
  const textAnchorRef = useRef<{ x: number; y: number } | null>(null);

  // ── DPR-Aware Canvas Resize ───────────────────────────────────────────────

  const redraw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const w = cvs.clientWidth;
    const h = cvs.clientHeight;
    ctx.clearRect(0, 0, w, h);
    drawDotGrid(ctx, w, h);
    const all = drawingRef.current ? [...items, drawingRef.current] : items;
    for (const it of all) drawItem(ctx, it);
  }, [items]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cvs = canvasRef.current;
    if (!wrap || !cvs) return;
    const dpr = window.devicePixelRatio || 1;
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      cvs.width = Math.max(1, Math.round(rect.width * dpr));
      cvs.height = Math.max(1, Math.round(rect.height * dpr));
      cvs.style.width = `${rect.width}px`;
      cvs.style.height = `${rect.height}px`;
      const ctx = cvs.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => { redraw(); }, [redraw]);

  // ── Pointer Handling ──────────────────────────────────────────────────────

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.setPointerCapture(e.pointerId);
    const pos = pointerPos(e);

    if (tool === 'text') {
      textAnchorRef.current = pos;
      setTextModalValue('');
      setTextModalOpen(true);
      return;
    }

    const drawColor = tool === 'eraser' ? '#ffffff' : color;
    const drawSize  = tool === 'eraser' ? size * 8 : size;

    if (tool === 'pen' || tool === 'eraser') {
      drawingRef.current = { kind: 'pen', points: [pos], color: drawColor, size: drawSize };
    } else if (tool === 'rect') {
      drawingRef.current = { kind: 'rect', x: pos.x, y: pos.y, w: 0, h: 0, color, size };
    } else if (tool === 'arrow') {
      drawingRef.current = { kind: 'arrow', x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, color, size };
    }
    redraw();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const cur = drawingRef.current;
    if (!cur) return;
    const pos = pointerPos(e);
    if (cur.kind === 'pen') cur.points.push(pos);
    else if (cur.kind === 'rect') { cur.w = pos.x - cur.x; cur.h = pos.y - cur.y; }
    else if (cur.kind === 'arrow') { cur.x2 = pos.x; cur.y2 = pos.y; }
    redraw();
  }

  function handlePointerUp() {
    const cur = drawingRef.current;
    drawingRef.current = null;
    if (!cur) return;
    onItemsChange([...items, cur]);
  }

  function handleUndo() { onItemsChange(items.slice(0, -1)); }
  function handleClear() { onItemsChange([]); }

  // Text modal submit
  function submitText() {
    const text = textModalValue.trim();
    const anchor = textAnchorRef.current;
    if (!text || !anchor) { cancelText(); return; }
    onItemsChange([...items, { kind: 'text', x: anchor.x, y: anchor.y, text, color, size: 14 + size * 3 }]);
    setTextModalOpen(false);
    setTextModalValue('');
    textAnchorRef.current = null;
  }
  function cancelText() {
    setTextModalOpen(false);
    setTextModalValue('');
    textAnchorRef.current = null;
  }

  // Send to Nexus
  async function handleSendToNexus() {
    const cvs = canvasRef.current;
    if (!cvs || items.length === 0) return;
    const dataUrl = await canvasToDataUrl(cvs);
    dispatchAnnotation({
      imageDataUrl: dataUrl ?? '',
      note: '',
      sourceName: 'Artisan Sketch',
    });
  }

  async function handleExportPng() {
    const cvs = canvasRef.current;
    if (!cvs || !currentWorkspace || items.length === 0) return;
    const dataUrl = await canvasToDataUrl(cvs);
    const base64 = dataUrl?.split(',')[1];
    if (!base64) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `${currentWorkspace.path}/.aether/sketches/sketch-${timestamp}.png`;
    await invoke('fs_write_base64_file', { path, contentBase64: base64 });
  }

  return (
    <div className="flex flex-col w-full h-full" style={{ background: '#0f0f11', position: 'relative' }}>
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(255,255,255,0.02)', flexShrink: 0, flexWrap: 'wrap',
        }}
      >
        {/* Tool buttons */}
        {TOOL_CONFIG.map(t => (
          <ToolBtn key={t.id} active={tool === t.id} icon={t.icon} title={t.title} onClick={() => setTool(t.id)} />
        ))}

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Color presets */}
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            title={c}
            style={{
              width: 18, height: 18, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
              outline: color === c ? '2px solid #2fd9f4' : '2px solid transparent',
              outlineOffset: 2, transition: 'outline 0.1s', flexShrink: 0,
            }}
          />
        ))}

        {/* Native color picker */}
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          title="Custom color"
          style={{ width: 26, height: 26, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 2, background: 'rgba(255,255,255,0.06)' }}
        />

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Size slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#666', fontWeight: 700 }}>SIZE</span>
          <input
            type="range" min={1} max={8} value={size}
            onChange={e => setSize(Number(e.target.value))}
            style={{ width: 70, accentColor: '#2fd9f4' }}
          />
          <span style={{ fontSize: 10, color: '#2fd9f4', fontWeight: 700, width: 12 }}>{size}</span>
        </div>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Actions */}
        <button
          onClick={handleUndo} disabled={items.length === 0}
          title="Undo" style={actionBtnStyle(false)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>undo</span>
        </button>
        <button
          onClick={handleClear} disabled={items.length === 0}
          title="Clear all" style={actionBtnStyle(false)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete_sweep</span>
        </button>

        <div style={{ flex: 1 }} />

        {/* Send to Nexus */}
        <button
          onClick={() => void handleSendToNexus()}
          disabled={items.length === 0}
          title="Send sketch to Nexus as AI context"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
            borderRadius: 7, border: 'none', cursor: items.length > 0 ? 'pointer' : 'default',
            fontWeight: 700, fontSize: 10, letterSpacing: '0.05em',
            background: items.length > 0 ? 'rgba(47,217,244,0.15)' : 'rgba(255,255,255,0.04)',
            color: items.length > 0 ? '#2fd9f4' : '#444',
            transition: 'all 0.15s',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
          TO NEXUS
        </button>

        <button
          onClick={() => void handleExportPng()}
          disabled={items.length === 0 || !currentWorkspace}
          title="Export sketch PNG to .aether/sketches"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
            borderRadius: 7, border: 'none', cursor: items.length > 0 && currentWorkspace ? 'pointer' : 'default',
            fontWeight: 700, fontSize: 10, letterSpacing: '0.05em',
            background: items.length > 0 && currentWorkspace ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            color: items.length > 0 && currentWorkspace ? '#e4e3f4' : '#444',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
          PNG
        </button>

        {/* Close sketch mode */}
        <button onClick={onClose} title="Exit sketch mode" style={actionBtnStyle(false)}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
        </button>
      </div>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ touchAction: 'none', display: 'block', cursor: tool === 'text' ? 'text' : 'crosshair' }}
        />
      </div>

      {/* ── Text Modal ─────────────────────────────────────────────────────── */}
      {textModalOpen && (
        <div
          style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
        >
          <div
            style={{
              background: '#1a1a1f', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 16, padding: 24, width: 340, boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#e4e3f4', margin: '0 0 16px' }}>Add Text</h3>
            <input
              type="text"
              value={textModalValue}
              autoFocus
              onChange={e => setTextModalValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && textModalValue.trim()) submitText();
                else if (e.key === 'Escape') cancelText();
              }}
              placeholder="Type your text…"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, padding: '8px 12px', color: '#e4e3f4', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={cancelText} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#908fa0', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Cancel</button>
              <button onClick={submitText} disabled={!textModalValue.trim()} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#2fd9f4', color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Place Text</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ToolBtn: React.FC<{ active: boolean; icon: string; title: string; onClick: () => void }> = ({
  active, icon, title, onClick,
}) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer',
      background: active ? 'rgba(47,217,244,0.15)' : 'transparent',
      color: active ? '#2fd9f4' : '#666',
      transition: 'all 0.12s',
    }}
  >
    <span
      className="material-symbols-outlined"
      style={{ fontSize: 16, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
    >{icon}</span>
  </button>
);

function actionBtnStyle(_active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer',
    background: 'transparent', color: '#666',
  };
}

// ── Canvas Drawing Utilities ──────────────────────────────────────────────────

function drawDotGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(15,15,17,0.16)';
  for (let y = 12; y < h; y += 16) {
    for (let x = 12; x < w; x += 16) {
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }
  ctx.restore();
}

function canvasToDataUrl(cvs: HTMLCanvasElement): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    cvs.toBlob((blob) => {
      if (!blob) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }, 'image/png');
  });
}

function drawItem(ctx: CanvasRenderingContext2D, it: SketchItem) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = it.color;
  ctx.fillStyle = it.color;
  ctx.lineWidth = it.size;
  if (it.kind === 'pen') {
    if (it.points.length < 2) return ctx.restore();
    ctx.beginPath();
    ctx.moveTo(it.points[0]!.x, it.points[0]!.y);
    for (let i = 1; i < it.points.length; i++) ctx.lineTo(it.points[i]!.x, it.points[i]!.y);
    ctx.stroke();
  } else if (it.kind === 'rect') {
    ctx.strokeRect(it.x, it.y, it.w, it.h);
  } else if (it.kind === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(it.x1, it.y1);
    ctx.lineTo(it.x2, it.y2);
    ctx.stroke();
    const ang = Math.atan2(it.y2 - it.y1, it.x2 - it.x1);
    const len = 10 + it.size * 2;
    ctx.beginPath();
    ctx.moveTo(it.x2, it.y2);
    ctx.lineTo(it.x2 - len * Math.cos(ang - Math.PI / 6), it.y2 - len * Math.sin(ang - Math.PI / 6));
    ctx.moveTo(it.x2, it.y2);
    ctx.lineTo(it.x2 - len * Math.cos(ang + Math.PI / 6), it.y2 - len * Math.sin(ang + Math.PI / 6));
    ctx.stroke();
  } else if (it.kind === 'text') {
    ctx.font = `600 ${it.size}px "Inter", system-ui, sans-serif`;
    ctx.fillText(it.text, it.x, it.y);
  }
  ctx.restore();
}
