import { create } from 'zustand';
import type { SketchItem } from '../artisan/sketchTypes';

// ── Types ────────────────────────────────────────────────────────────────────

export type LayerType = 'frame' | 'section' | 'text' | 'button' | 'image' | 'container' | 'input' | 'icon';
export type ViewportMode = 'desktop' | 'tablet' | 'mobile';
export type ArtisanTool = 'select' | 'frame' | 'text' | 'pen' | 'sketch' | 'ai';
export type InspectorTab = 'styles' | 'settings' | 'advanced';

export interface LayerStyle {
  // Spacing
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  // Typography
  fontFamily?: string;
  fontWeight?: string;
  fontSize?: string;
  lineHeight?: string;
  letterSpacing?: string;
  color?: string;
  textAlign?: string;
  // Layout
  display?: string;
  flexDirection?: string;
  alignItems?: string;
  justifyContent?: string;
  gap?: string;
  width?: string;
  height?: string;
  // Visual
  backgroundColor?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderTopWidth?: string;
  borderRightWidth?: string;
  borderBottomWidth?: string;
  borderLeftWidth?: string;
  borderColor?: string;
  borderStyle?: string;
  opacity?: string;
  boxShadow?: string;
}

export interface ArtisanLayer {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  expanded: boolean;
  children: ArtisanLayer[];
  content?: string;       // text content for text/button layers
  styles: LayerStyle;
  // Canvas position (for root-level elements)
  x?: number;
  y?: number;
}

export interface ArtisanColor {
  name: string;
  hex: string;
}

// ── Demo Content ─────────────────────────────────────────────────────────────

const demoLayers: ArtisanLayer[] = [
  {
    id: 'canvas-root',
    type: 'frame',
    name: 'Main Canvas',
    visible: true,
    locked: false,
    expanded: true,
    styles: { width: '800px', height: '600px', backgroundColor: '#0d0d15' },
    children: [
      {
        id: 'nav-bar',
        type: 'container',
        name: 'Navigation',
        visible: true, locked: false, expanded: false,
        styles: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', paddingLeft: '32px', paddingRight: '32px', paddingBottom: '16px' },
        children: [
          { id: 'nav-logo', type: 'text', name: 'Logo', visible: true, locked: false, expanded: false, content: 'AetherFlow', styles: { fontFamily: 'Inter', fontSize: '24px', fontWeight: '600', color: '#c0c1ff' }, children: [] },
          {
            id: 'nav-links', type: 'container', name: 'Links', visible: true, locked: false, expanded: false,
            styles: { display: 'flex', gap: '24px' },
            children: [
              { id: 'nav-l1', type: 'text', name: 'Link 1', visible: true, locked: false, expanded: false, content: 'Solutions', styles: { fontSize: '13px', color: '#c7c4d7' }, children: [] },
              { id: 'nav-l2', type: 'text', name: 'Link 2', visible: true, locked: false, expanded: false, content: 'Platform', styles: { fontSize: '13px', color: '#c7c4d7' }, children: [] },
              { id: 'nav-l3', type: 'text', name: 'Link 3', visible: true, locked: false, expanded: false, content: 'Pricing', styles: { fontSize: '13px', color: '#c7c4d7' }, children: [] },
            ],
          },
        ],
      },
      {
        id: 'hero-section',
        type: 'section',
        name: 'Hero Section',
        visible: true, locked: false, expanded: true,
        styles: { paddingTop: '32px', paddingLeft: '32px', paddingRight: '32px', paddingBottom: '32px', borderRadius: '12px', backgroundColor: '#1b1b23' },
        children: [
          {
            id: 'hero-title', type: 'text', name: 'Title Text', visible: true, locked: false, expanded: false,
            content: 'Engineering the Infinite with Local AI.',
            styles: { fontFamily: 'Inter', fontSize: '32px', fontWeight: '700', lineHeight: '1.2', color: '#e4e1ed', width: '500px' },
            children: [],
          },
          {
            id: 'hero-subtitle', type: 'text', name: 'Subtitle', visible: true, locked: false, expanded: false,
            content: 'Build, deploy, and scale high-performance applications directly from your local environment with zero-latency inference.',
            styles: { fontFamily: 'Inter', fontSize: '14px', color: '#908fa0', width: '460px', marginTop: '16px' },
            children: [],
          },
          {
            id: 'hero-buttons', type: 'container', name: 'CTA Buttons', visible: true, locked: false, expanded: false,
            styles: { display: 'flex', gap: '16px', marginTop: '24px' },
            children: [
              {
                id: 'btn-primary', type: 'button', name: 'CTA Button', visible: true, locked: false, expanded: false,
                content: 'Get Started',
                styles: { backgroundColor: '#8083ff', color: '#07006c', fontWeight: '700', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px', borderRadius: '8px', boxShadow: '0 0 20px rgba(128,131,255,0.3)' },
                children: [],
              },
              {
                id: 'btn-secondary', type: 'button', name: 'Demo Button', visible: true, locked: false, expanded: false,
                content: 'Watch Demo',
                styles: { borderWidth: '1px', borderColor: '#464554', fontWeight: '700', paddingTop: '12px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px', borderRadius: '8px', color: '#e4e1ed' },
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: 'features-grid',
        type: 'container',
        name: 'Feature Cards',
        visible: true, locked: false, expanded: false,
        styles: { display: 'flex', gap: '16px', paddingTop: '24px', paddingLeft: '32px', paddingRight: '32px', opacity: '0.4' },
        children: [
          { id: 'card-1', type: 'frame', name: 'Card 1', visible: true, locked: false, expanded: false, styles: { width: '33%', height: '128px', backgroundColor: '#292932', borderRadius: '12px' }, children: [] },
          { id: 'card-2', type: 'frame', name: 'Card 2', visible: true, locked: false, expanded: false, styles: { width: '33%', height: '128px', backgroundColor: '#292932', borderRadius: '12px' }, children: [] },
          { id: 'card-3', type: 'frame', name: 'Card 3', visible: true, locked: false, expanded: false, styles: { width: '33%', height: '128px', backgroundColor: '#292932', borderRadius: '12px' }, children: [] },
        ],
      },
    ],
  },
];

// ── Store ─────────────────────────────────────────────────────────────────────

interface ArtisanStoreState {
  layers: ArtisanLayer[];
  selectedLayerId: string | null;
  hoveredLayerId: string | null;
  viewport: ViewportMode;
  activeTool: ArtisanTool;
  inspectorTab: InspectorTab;
  canvasZoom: number;
  sketchItems: SketchItem[];

  // Actions
  selectLayer: (id: string | null) => void;
  hoverLayer: (id: string | null) => void;
  toggleLayerExpanded: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  setViewport: (mode: ViewportMode) => void;
  setActiveTool: (tool: ArtisanTool) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setSketchItems: (items: SketchItem[]) => void;
  clearSketch: () => void;
  updateLayerStyle: (layerId: string, key: keyof LayerStyle, value: string) => void;
  updateLayerName: (layerId: string, name: string) => void;
  updateLayerContent: (layerId: string, content: string) => void;
  addLayer: (opts: { name: string; type: LayerType }) => void;
  zoomCanvas: (delta: number) => void;
}

// Deep helper to update a layer anywhere in the tree
function updateLayerInTree(layers: ArtisanLayer[], id: string, updater: (l: ArtisanLayer) => ArtisanLayer): ArtisanLayer[] {
  return layers.map(layer => {
    if (layer.id === id) return updater(layer);
    if (layer.children.length > 0) {
      return { ...layer, children: updateLayerInTree(layer.children, id, updater) };
    }
    return layer;
  });
}

function findLayerInTree(layers: ArtisanLayer[], id: string): ArtisanLayer | null {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    const found = findLayerInTree(layer.children, id);
    if (found) return found;
  }
  return null;
}

export const useArtisanStore = create<ArtisanStoreState>((set) => ({
  layers: demoLayers,
  selectedLayerId: 'hero-section',
  hoveredLayerId: null,
  viewport: 'desktop',
  activeTool: 'select',
  inspectorTab: 'styles',
  canvasZoom: 1,
  sketchItems: [],

  selectLayer: (id) => set({ selectedLayerId: id }),
  hoverLayer: (id) => set({ hoveredLayerId: id }),

  toggleLayerExpanded: (id) => set(state => ({
    layers: updateLayerInTree(state.layers, id, l => ({ ...l, expanded: !l.expanded })),
  })),

  toggleLayerVisibility: (id) => set(state => ({
    layers: updateLayerInTree(state.layers, id, l => ({ ...l, visible: !l.visible })),
  })),

  setViewport: (mode) => set({ viewport: mode }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setSketchItems: (items) => set({ sketchItems: items }),
  clearSketch: () => set({ sketchItems: [] }),

  updateLayerStyle: (layerId, key, value) => set(state => ({
    layers: updateLayerInTree(state.layers, layerId, l => ({
      ...l, styles: { ...l.styles, [key]: value },
    })),
  })),

  updateLayerName: (layerId, name) => set(state => ({
    layers: updateLayerInTree(state.layers, layerId, l => ({ ...l, name })),
  })),

  updateLayerContent: (layerId, content) => set(state => ({
    layers: updateLayerInTree(state.layers, layerId, l => ({ ...l, content })),
  })),

  addLayer: ({ name, type }) => set(state => {
    const id = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newLayer: ArtisanLayer = {
      id, type, name, visible: true, locked: false, expanded: false,
      children: [],
      styles: {
        width: type === 'frame' ? '100%' : undefined,
        height: type === 'frame' ? '120px' : undefined,
        backgroundColor: type === 'frame' ? '#292932' : undefined,
        borderRadius: '8px',
        display: type === 'container' ? 'flex' : undefined,
      },
    };
    return { layers: [...state.layers, newLayer], selectedLayerId: id };
  }),

  zoomCanvas: (delta) => set(state => ({
    canvasZoom: Math.max(0.25, Math.min(3, state.canvasZoom + delta)),
  })),
}));

// Re-export the find helper for use in components
export { findLayerInTree };
