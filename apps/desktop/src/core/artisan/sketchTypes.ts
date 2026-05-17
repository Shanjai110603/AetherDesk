// ── Artisan Sketch Item Types ─────────────────────────────────────────────────

export type SketchItem =
  | { kind: 'pen';   points: { x: number; y: number }[]; color: string; size: number }
  | { kind: 'rect';  x: number; y: number; w: number; h: number; color: string; size: number }
  | { kind: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; size: number }
  | { kind: 'text';  x: number; y: number; text: string; color: string; size: number };

export type SketchTool = 'pen' | 'rect' | 'arrow' | 'text' | 'eraser';
