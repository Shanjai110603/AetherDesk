import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { dispatchAnnotation } from '../../core/events/aetherDeskEvents';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Point { x: number; y: number }
interface Stroke { points: Point[] }

export type AnnotationMode = 'draw' | 'click';

interface Props {
  children: React.ReactNode;
  active?: boolean;
  onActiveChange?: (active: boolean) => void;
  sourceName?: string; // e.g. 'Forge Preview'
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STROKE_COLOR = '#ff3b30';
const STROKE_WIDTH = 3;
const TARGET_COLOR = '#2fd9f4';

// ── Component ─────────────────────────────────────────────────────────────────

export const PreviewAnnotationOverlay: React.FC<Props> = ({
  children,
  active = false,
  onActiveChange,
  sourceName = 'Forge Preview',
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<AnnotationMode>('draw');
  const [note, setNote] = useState('');
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [sending, setSending] = useState(false);

  // Reset to draw mode when panel activates
  useEffect(() => {
    if (active) setMode('draw');
  }, [active]);

  // ── Canvas Rendering ────────────────────────────────────────────────────────

  const redraw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    const dpr = window.devicePixelRatio || 1;
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const all = drawingRef.current
      ? [...strokesRef.current, drawingRef.current]
      : strokesRef.current;
    for (const s of all) {
      const first = s.points[0];
      if (!first) continue;
      ctx.beginPath();
      ctx.moveTo(first.x * dpr, first.y * dpr);
      for (let i = 1; i < s.points.length; i++) {
        const p = s.points[i]!;
        ctx.lineTo(p.x * dpr, p.y * dpr);
      }
      ctx.stroke();
    }
  }, []);

  // ── DPR-Aware Resize ────────────────────────────────────────────────────────

  useEffect(() => {
    const wrap = wrapRef.current;
    const cvs = canvasRef.current;
    if (!wrap || !cvs) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cvs.width = Math.max(1, Math.floor(rect.width * dpr));
      cvs.height = Math.max(1, Math.floor(rect.height * dpr));
      cvs.style.width = `${rect.width}px`;
      cvs.style.height = `${rect.height}px`;
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  // Escape key deactivates overlay
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onActiveChange?.(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onActiveChange]);

  // Clear ink when deactivated
  useEffect(() => {
    if (active) return;
    strokesRef.current = [];
    drawingRef.current = null;
    setHasInk(false);
    redraw();
  }, [active, redraw]);

  // ── Pointer Handling ────────────────────────────────────────────────────────

  function pointFromEvent(e: PointerEvent): Point {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: PointerEvent) {
    if (mode !== 'draw' || sending) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawingRef.current = { points: [pointFromEvent(e)] };
    redraw();
  }

  function onPointerMove(e: PointerEvent) {
    if (mode !== 'draw' || sending || !drawingRef.current) return;
    drawingRef.current.points.push(pointFromEvent(e));
    redraw();
  }

  function onPointerUp() {
    if (mode !== 'draw' || sending || !drawingRef.current) return;
    if (drawingRef.current.points.length > 1) {
      strokesRef.current.push(drawingRef.current);
      setHasInk(true);
    }
    drawingRef.current = null;
    redraw();
  }

  // Forward scroll events into the iframe when in draw mode
  function onCanvasWheel(e: WheelEvent<HTMLCanvasElement>) {
    if (mode !== 'draw' || sending) return;
    const iframe = wrapRef.current?.querySelector('iframe');
    const win = iframe?.contentWindow;
    if (!win || typeof win.scrollBy !== 'function') return;
    e.preventDefault();
    win.scrollBy({ left: e.deltaX, top: e.deltaY, behavior: 'auto' });
  }

  function clearInk() {
    strokesRef.current = [];
    drawingRef.current = null;
    setHasInk(false);
    redraw();
  }

  // ── Composite Screenshot ────────────────────────────────────────────────────

  async function captureComposite(): Promise<string | null> {
    const cvs = canvasRef.current;
    if (!cvs || strokesRef.current.length === 0) return null;
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

  async function handleSend() {
    const canSubmit = hasInk || note.trim();
    if (!canSubmit || sending) return;
    setSending(true);
    try {
      const imageDataUrl = await captureComposite();
      dispatchAnnotation({
        imageDataUrl: imageDataUrl ?? '',
        note: note.trim(),
        sourceName,
      });
      clearInk();
      setNote('');
      onActiveChange?.(false);
    } finally {
      setSending(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const showCanvas = active || hasInk;
  const canSubmit = hasInk || note.trim();

  return (
    <div
      ref={wrapRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      {children}

      {/* Canvas overlay */}
      {showCanvas && (
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onCanvasWheel}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: active && mode === 'draw' ? 'auto' : 'none',
            cursor: active && mode === 'draw' ? 'crosshair' : 'default',
            zIndex: 10,
          }}
        />
      )}

      {/* HUD Toolbar */}
      {active && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 20,
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'rgba(15,15,17,0.94)',
            borderRadius: 999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
            zIndex: 20,
            pointerEvents: 'auto',
            fontSize: 12,
          }}
        >
          {/* Mode buttons */}
          <HudButton
            active={mode === 'draw'}
            onClick={() => setMode('draw')}
            icon="draw"
            title="Draw mode"
            accentColor={STROKE_COLOR}
          />
          <HudButton
            active={mode === 'click'}
            onClick={() => setMode('click')}
            icon="ads_click"
            title="Click-to-highlight mode"
            accentColor={TARGET_COLOR}
          />

          {/* Divider */}
          <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />

          {/* Clear button */}
          {hasInk && (
            <button
              onClick={clearInk}
              disabled={sending}
              title="Clear ink"
              style={ghostBtnStyle}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>ink_eraser</span>
            </button>
          )}

          {/* Note input */}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSend(); }}
            disabled={sending}
            placeholder="Add a note…"
            style={{
              background: 'rgba(47,217,244,0.08)',
              border: '1px solid rgba(47,217,244,0.25)',
              borderRadius: 8,
              outline: 'none',
              color: '#e4e3f4',
              width: 200,
              padding: '4px 10px',
              fontSize: 12,
            }}
          />

          {/* Send button */}
          <button
            onClick={() => void handleSend()}
            disabled={sending || !canSubmit}
            title="Send to Nexus"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 12px',
              borderRadius: 8,
              border: 'none',
              cursor: canSubmit && !sending ? 'pointer' : 'default',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.05em',
              background: canSubmit && !sending ? '#2fd9f4' : 'rgba(255,255,255,0.06)',
              color: canSubmit && !sending ? '#000' : '#555',
              transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {sending ? 'hourglass_top' : 'send'}
            </span>
            {sending ? 'SENDING…' : 'TO NEXUS'}
          </button>

          {/* Dismiss */}
          <button
            onClick={() => onActiveChange?.(false)}
            title="Close annotation mode (Esc)"
            style={ghostBtnStyle}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ── Sub-Components ────────────────────────────────────────────────────────────

interface HudButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  accentColor: string;
}

const HudButton: React.FC<HudButtonProps> = ({ active, onClick, icon, title, accentColor }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 30,
      height: 30,
      borderRadius: 8,
      border: 'none',
      cursor: 'pointer',
      background: active ? `${accentColor}22` : 'transparent',
      color: active ? accentColor : '#666',
      transition: 'all 0.12s',
    }}
  >
    <span
      className="material-symbols-outlined"
      style={{ fontSize: 16, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
    >
      {icon}
    </span>
  </button>
);

const ghostBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  background: 'transparent',
  color: '#666',
};
