import React, { useState } from 'react';
import {
  useArtisanStore,
  findLayerInTree,
} from '../../core/store/useArtisanStore';
import type {
  ArtisanLayer,
  ArtisanTool,
  ViewportMode,
  InspectorTab,
  LayerStyle,
} from '../../core/store/useArtisanStore';
import { ArtisanPromptBar } from './ArtisanPromptBar';
import { ArtisanSandbox } from './ArtisanSandbox';
import { ArtisanInspector } from './ArtisanInspector';
import { useAiStore } from '../../core/store/useAiStore';
import { SketchLayer } from './SketchLayer';

// ── Layer Type Icons ─────────────────────────────────────────────────────────

const LAYER_ICONS: Record<string, string> = {
  frame: 'web', section: 'grid_view', text: 'text_fields',
  button: 'smart_button', image: 'image', container: 'view_column',
  input: 'text_fields', icon: 'emoji_symbols',
};

// ── Layer Tree ───────────────────────────────────────────────────────────────

const LayerTreeNode: React.FC<{ layer: ArtisanLayer; depth: number }> = ({ layer, depth }) => {
  const { selectedLayerId, selectLayer, hoverLayer, toggleLayerExpanded, toggleLayerVisibility } = useArtisanStore();
  const isSelected = selectedLayerId === layer.id;
  const hasChildren = layer.children.length > 0;

  return (
    <>
      <div
        className={`flex items-center gap-xs py-0.5 pr-sm cursor-default group transition-all ${
          isSelected
            ? 'text-secondary-fixed-dim border border-secondary-fixed-dim/30 bg-secondary-fixed-dim/5 rounded'
            : 'hover:bg-surface-container-highest rounded text-on-surface-variant'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => selectLayer(layer.id)}
        onMouseEnter={() => hoverLayer(layer.id)}
        onMouseLeave={() => hoverLayer(null)}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); toggleLayerExpanded(layer.id); }} className="flex-shrink-0">
            <span className="material-symbols-outlined text-[14px] text-outline">{layer.expanded ? 'keyboard_arrow_down' : 'chevron_right'}</span>
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        <span className={`material-symbols-outlined text-[14px] ${isSelected ? 'text-secondary-fixed-dim' : 'text-outline'}`}>
          {LAYER_ICONS[layer.type] || 'layers'}
        </span>
        <span className="text-body-sm truncate flex-1">{layer.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[14px] text-outline">
            {layer.visible ? 'visibility' : 'visibility_off'}
          </span>
        </button>
      </div>
      {layer.expanded && layer.children.map(child => (
        <LayerTreeNode key={child.id} layer={child} depth={depth + 1} />
      ))}
    </>
  );
};

// ── Left Panel: Layers + AI Components ───────────────────────────────────────

const LayerPanel: React.FC = () => {
  const { layers } = useArtisanStore();
  return (
    <aside className="w-64 border-r border-outline-variant bg-surface-container-low flex flex-col flex-shrink-0">
      <div className="p-sm border-b border-outline-variant flex justify-between items-center">
        <span className="text-label-caps text-on-surface-variant font-bold">Layers</span>
        <button 
          onClick={() => useArtisanStore.getState().addLayer({ name: 'New Frame', type: 'frame' })}
          className="material-symbols-outlined text-outline text-[16px] hover:text-secondary transition-colors cursor-pointer"
        >add</button>
      </div>
      <div className="flex-1 overflow-y-auto p-xs space-y-0.5">
        {layers.map(layer => (
          <LayerTreeNode key={layer.id} layer={layer} depth={0} />
        ))}
      </div>
      <div className="p-sm border-t border-outline-variant">
        <span className="text-label-caps text-on-surface-variant font-bold block mb-sm">AI Components</span>
        <div className="grid grid-cols-2 gap-xs">
          {[
            { icon: 'auto_awesome', label: 'Hero Pro', prompt: 'Generate a modern hero section with gradient background, headline, subheadline, and CTA button' },
            { icon: 'bento', label: 'Bento Grid', prompt: 'Generate a bento-style grid layout with 4-6 cards featuring icons and descriptions' },
            { icon: 'dashboard', label: 'Dashboard', prompt: 'Generate a dashboard layout with stat cards, a chart area, and a recent activity list' },
            { icon: 'table_chart', label: 'Data Table', prompt: 'Generate a modern data table with sortable columns, search, and pagination' },
          ].map(c => (
            <button 
              key={c.label} 
              onClick={() => {
                const promptBar = document.querySelector<HTMLTextAreaElement>('[data-artisan-prompt]');
                if (promptBar) { promptBar.value = c.prompt; promptBar.dispatchEvent(new Event('input', { bubbles: true })); }
                sessionStorage.setItem('artisan_prompt', c.prompt);
              }}
              className="aspect-square bg-surface-container-highest border border-outline-variant rounded flex flex-col items-center justify-center gap-xs hover:border-secondary transition-all cursor-pointer p-xs group"
            >
              <span className="material-symbols-outlined text-secondary group-hover:scale-110 transition-transform" style={{ fontSize: '24px' }}>{c.icon}</span>
              <span className="text-label-caps text-[9px]">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

// ── Canvas Toolbar ───────────────────────────────────────────────────────────

const tools: { id: ArtisanTool; icon: string }[] = [
  { id: 'select', icon: 'near_me' },
  { id: 'frame', icon: 'crop_free' },
  { id: 'text', icon: 'text_fields' },
  { id: 'pen', icon: 'history_edu' },
  { id: 'sketch', icon: 'brush' },
  { id: 'ai', icon: 'auto_awesome' },
];

const CanvasToolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useArtisanStore();
  return (
    <div className="absolute top-md left-1/2 -translate-x-1/2 glass-panel rounded-full px-md py-sm flex items-center gap-md z-20">
      {tools.map((t, i) => (
        <React.Fragment key={t.id}>
          {i === tools.length - 1 && <div className="w-px h-4 bg-outline-variant" />}
          <button
            onClick={() => setActiveTool(t.id)}
            className={`transition-colors ${activeTool === t.id ? 'text-secondary-fixed-dim' : 'text-outline hover:text-on-surface'}`}
          >
            <span className="material-symbols-outlined" style={t.id === 'ai' ? { fontVariationSettings: "'FILL' 1" } : undefined}>{t.icon}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Sketch Mode Toggle Badge ──────────────────────────────────────────────────

const RenderedLayer: React.FC<{ layer: ArtisanLayer }> = ({ layer }) => {
  const { selectedLayerId, hoveredLayerId, selectLayer, hoverLayer } = useArtisanStore();
  const isSelected = selectedLayerId === layer.id;
  const isHovered = hoveredLayerId === layer.id && !isSelected;

  if (!layer.visible) return null;

  const style: React.CSSProperties = {
    ...(layer.styles.display && { display: layer.styles.display }),
    ...(layer.styles.flexDirection && { flexDirection: layer.styles.flexDirection as any }),
    ...(layer.styles.alignItems && { alignItems: layer.styles.alignItems }),
    ...(layer.styles.justifyContent && { justifyContent: layer.styles.justifyContent }),
    ...(layer.styles.gap && { gap: layer.styles.gap }),
    ...(layer.styles.width && { width: layer.styles.width }),
    ...(layer.styles.height && { height: layer.styles.height }),
    ...(layer.styles.backgroundColor && { backgroundColor: layer.styles.backgroundColor }),
    ...(layer.styles.borderRadius && { borderRadius: layer.styles.borderRadius }),
    ...(layer.styles.borderWidth && { borderWidth: layer.styles.borderWidth }),
    ...(layer.styles.borderTopWidth && { borderTopWidth: layer.styles.borderTopWidth }),
    ...(layer.styles.borderRightWidth && { borderRightWidth: layer.styles.borderRightWidth }),
    ...(layer.styles.borderBottomWidth && { borderBottomWidth: layer.styles.borderBottomWidth }),
    ...(layer.styles.borderLeftWidth && { borderLeftWidth: layer.styles.borderLeftWidth }),
    ...((layer.styles.borderWidth || layer.styles.borderTopWidth || layer.styles.borderRightWidth || layer.styles.borderBottomWidth || layer.styles.borderLeftWidth) && {
      borderStyle: layer.styles.borderStyle || 'solid',
      borderColor: layer.styles.borderColor || '#464554',
    }),
    ...(layer.styles.opacity && { opacity: parseFloat(layer.styles.opacity) }),
    ...(layer.styles.boxShadow && { boxShadow: layer.styles.boxShadow }),
    ...(layer.styles.paddingTop && { paddingTop: layer.styles.paddingTop }),
    ...(layer.styles.paddingRight && { paddingRight: layer.styles.paddingRight }),
    ...(layer.styles.paddingBottom && { paddingBottom: layer.styles.paddingBottom }),
    ...(layer.styles.paddingLeft && { paddingLeft: layer.styles.paddingLeft }),
    ...(layer.styles.marginTop && { marginTop: layer.styles.marginTop }),
    ...(layer.styles.marginRight && { marginRight: layer.styles.marginRight }),
    ...(layer.styles.marginBottom && { marginBottom: layer.styles.marginBottom }),
    ...(layer.styles.marginLeft && { marginLeft: layer.styles.marginLeft }),
    ...(layer.styles.fontFamily && { fontFamily: layer.styles.fontFamily }),
    ...(layer.styles.fontSize && { fontSize: layer.styles.fontSize }),
    ...(layer.styles.fontWeight && { fontWeight: layer.styles.fontWeight }),
    ...(layer.styles.lineHeight && { lineHeight: layer.styles.lineHeight }),
    ...(layer.styles.letterSpacing && { letterSpacing: layer.styles.letterSpacing }),
    ...(layer.styles.color && { color: layer.styles.color }),
    ...(layer.styles.textAlign && { textAlign: layer.styles.textAlign as any }),
    position: 'relative',
    cursor: 'pointer',
  };

  return (
    <div
      style={style}
      onClick={(e) => { e.stopPropagation(); selectLayer(layer.id); }}
      onMouseEnter={(e) => { e.stopPropagation(); hoverLayer(layer.id); }}
      onMouseLeave={(e) => { e.stopPropagation(); hoverLayer(null); }}
    >
      {/* Selection overlay */}
      {isSelected && (
        <>
          <div className="absolute inset-0 border-2 border-secondary-fixed-dim rounded pointer-events-none z-10" />
          <div className="absolute -top-5 -left-0.5 bg-secondary-fixed-dim text-surface-dim text-[9px] font-bold px-1.5 py-0.5 rounded uppercase z-10 pointer-events-none whitespace-nowrap">
            {layer.name}
          </div>
          {/* Resize handles */}
          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => {
            const [v, h] = pos.split('-');
            return (
              <div
                key={pos}
                className="absolute w-2 h-2 bg-white border border-secondary-fixed-dim rounded-full z-10 pointer-events-none"
                style={{
                  [v]: -4, [h]: -4,
                }}
              />
            );
          })}
        </>
      )}

      {/* Hover overlay */}
      {isHovered && (
        <div className="absolute inset-0 border border-secondary-fixed-dim/50 border-dashed rounded pointer-events-none z-10" />
      )}

      {/* Content */}
      {layer.content && <span>{layer.content}</span>}
      {layer.children.map(child => (
        <RenderedLayer key={child.id} layer={child} />
      ))}
    </div>
  );
};

// ── Visual Canvas ────────────────────────────────────────────────────────────

const VisualCanvas: React.FC = () => {
  const { layers, viewport, canvasZoom, selectLayer, zoomCanvas } = useArtisanStore();

  const viewportWidth = viewport === 'desktop' ? 800 : viewport === 'tablet' ? 768 : 375;

  return (
    <section
      className="flex-1 relative overflow-auto flex items-start justify-center p-xl"
      style={{
        backgroundImage: 'radial-gradient(#464554 0.5px, transparent 0.5px)',
        backgroundSize: '24px 24px',
        backgroundColor: '#13131b',
      }}
      onClick={() => selectLayer(null)}
      onWheel={(e) => { if (e.ctrlKey) { e.preventDefault(); zoomCanvas(e.deltaY > 0 ? -0.05 : 0.05); } }}
    >
      <CanvasToolbar />

      <div style={{
        transform: `scale(${canvasZoom})`,
        transformOrigin: 'top center',
        transition: 'transform 0.15s ease',
        marginTop: '64px',
      }}>
        <div
          className="shadow-2xl border border-outline-variant rounded-lg overflow-hidden relative"
          style={{ width: viewportWidth, backgroundColor: '#0d0d15', minHeight: '500px' }}
        >
          {layers.map(layer => (
            <RenderedLayer key={layer.id} layer={layer} />
          ))}
        </div>
      </div>

      {/* Zoom control */}
      <div className="absolute bottom-md right-md z-30 flex items-center gap-xs bg-surface-container-highest/90 backdrop-blur-sm border border-outline-variant rounded p-xs shadow-lg">
        <button onClick={() => zoomCanvas(-0.1)} className="w-7 h-7 flex items-center justify-center text-outline hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[18px]">remove</span>
        </button>
        <span className="text-label-caps text-on-surface-variant w-10 text-center">{Math.round(canvasZoom * 100)}%</span>
        <button onClick={() => zoomCanvas(0.1)} className="w-7 h-7 flex items-center justify-center text-outline hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
      </div>
    </section>
  );
};

// ── Style Inspector ──────────────────────────────────────────────────────────

const StyleInspector: React.FC = () => {
  const { layers, selectedLayerId, inspectorTab, setInspectorTab, viewport, setViewport, updateLayerStyle } = useArtisanStore();
  const selectedLayer = selectedLayerId ? findLayerInTree(layers, selectedLayerId) : null;

  const tabs: InspectorTab[] = ['styles', 'settings', 'advanced'];

  return (
    <aside className="w-72 border-l border-outline-variant bg-surface-container-low flex flex-col flex-shrink-0">
      {/* Viewport Switcher */}
      <div className="p-sm border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-sm bg-surface-container-high rounded px-sm py-1">
          {(['desktop', 'tablet', 'mobile'] as ViewportMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              className={viewport === v ? 'text-secondary-fixed-dim' : 'text-outline hover:text-on-surface'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {v === 'desktop' ? 'desktop_windows' : v === 'tablet' ? 'tablet_mac' : 'phone_iphone'}
              </span>
            </button>
          ))}
        </div>
        <span className="text-label-caps text-outline">{viewport.toUpperCase()}</span>
      </div>

      {/* Inspector Tabs */}
      <div className="p-sm border-b border-outline-variant flex gap-md">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setInspectorTab(t)}
            className={`text-label-caps capitalize ${inspectorTab === t ? 'text-secondary-fixed-dim border-b border-secondary-fixed-dim' : 'text-outline hover:text-on-surface'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-md space-y-lg">
        {!selectedLayer ? (
          <div className="flex flex-col items-center justify-center py-xl text-center">
            <span className="material-symbols-outlined text-3xl text-outline mb-sm">touch_app</span>
            <p className="text-body-sm text-outline">Select an element to inspect</p>
          </div>
        ) : (
          <>
            {/* Spacing */}
            <div className="space-y-sm">
              <span className="text-label-caps text-on-surface-variant font-bold">Spacing</span>
              <div className="p-md bg-surface-container rounded flex items-center justify-center border border-outline-variant relative">
                <div className="w-full aspect-video bg-surface-container-highest border border-outline-variant border-dashed flex items-center justify-center">
                  <span className="text-[10px] text-outline">
                    {selectedLayer.styles.paddingTop || '0'} / {selectedLayer.styles.paddingRight || '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-sm">
              <span className="text-label-caps text-on-surface-variant font-bold">Typography</span>
              <div className="grid grid-cols-2 gap-sm">
                <div className="p-xs border border-outline-variant rounded bg-surface-container-low text-[11px] text-on-surface flex items-center justify-between">
                  <span>{selectedLayer.styles.fontFamily || 'Inter'}</span>
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                </div>
                <div className="p-xs border border-outline-variant rounded bg-surface-container-low text-[11px] text-on-surface flex items-center justify-between">
                  <span>{selectedLayer.styles.fontWeight || '400'}</span>
                  <span className="material-symbols-outlined text-[12px]">expand_more</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <div className="text-[10px] text-outline mb-xs">Size</div>
                  <input
                    className="w-full p-xs bg-surface-container-highest border border-outline-variant rounded text-[11px] text-on-surface focus:outline-none focus:border-secondary transition-colors"
                    value={selectedLayer.styles.fontSize || '14px'}
                    onChange={e => updateLayerStyle(selectedLayer.id, 'fontSize', e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-[10px] text-outline mb-xs">Line Height</div>
                  <input
                    className="w-full p-xs bg-surface-container-highest border border-outline-variant rounded text-[11px] text-on-surface focus:outline-none focus:border-secondary transition-colors"
                    value={selectedLayer.styles.lineHeight || '1.5'}
                    onChange={e => updateLayerStyle(selectedLayer.id, 'lineHeight', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-sm">
              <span className="text-label-caps text-on-surface-variant font-bold">Colors</span>
              <div className="space-y-xs">
                {[
                  { label: 'Text', key: 'color' as keyof LayerStyle },
                  { label: 'Background', key: 'backgroundColor' as keyof LayerStyle },
                  { label: 'Border', key: 'borderColor' as keyof LayerStyle },
                ].map(({ label, key }) => {
                  const val = selectedLayer.styles[key] || '';
                  return (
                    <div key={label} className="flex items-center justify-between p-xs hover:bg-surface-container rounded">
                      <div className="flex items-center gap-sm">
                        <div
                          className="w-4 h-4 rounded border border-outline-variant"
                          style={{ backgroundColor: val || 'transparent' }}
                        />
                        <span className="text-body-sm text-on-surface-variant">{label}</span>
                      </div>
                      <span className="text-code-md text-[10px] text-outline">{val || '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Actions */}
            <div className="space-y-sm pt-md border-t border-outline-variant">
              <span className="text-label-caps text-on-surface-variant font-bold flex items-center gap-xs">
                <span className="material-symbols-outlined text-secondary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                AI Actions
              </span>
              <div className="space-y-xs">
                {[
                  { icon: 'devices', label: 'Make this section responsive', prompt: 'Make the selected layer fully responsive across mobile, tablet, and desktop breakpoints' },
                  { icon: 'blur_on', label: 'Change to glassmorphism', prompt: 'Apply a premium glassmorphism effect to the selected element with backdrop blur, translucent background, and subtle border' },
                  { icon: 'palette', label: 'Generate complementary theme', prompt: 'Generate a complementary color theme for the selected section using modern design principles' },
                  { icon: 'code', label: 'Generate component code', prompt: 'Generate clean, production-ready React component code for the selected layer tree' },
                  { icon: 'auto_fix_high', label: 'Optimize for accessibility', prompt: 'Audit and optimize the selected element for WCAG 2.1 AA accessibility compliance' },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={() => sessionStorage.setItem('artisan_prompt', a.prompt)}
                    className="w-full text-left p-xs rounded text-body-sm hover:bg-secondary/10 hover:text-secondary border border-transparent hover:border-secondary/20 flex items-center gap-sm transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pro-tip footer */}
      <div className="p-md bg-secondary/5 border-t border-outline-variant">
        <div className="flex items-center gap-sm mb-xs">
          <span className="material-symbols-outlined text-secondary text-[16px]">info</span>
          <span className="text-label-caps text-secondary">Pro-Tip</span>
        </div>
        <p className="text-[10px] text-outline-variant leading-relaxed">
          Use AI Pen to draw rough shapes; Artisan will convert them to production-ready Tailwind components automatically.
        </p>
      </div>
    </aside>
  );
};

// ── Main Artisan Component ───────────────────────────────────────────────────

export const Artisan: React.FC = () => {
  const [componentName, setComponentName] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const { isStreaming } = useAiStore();
  const { activeTool, setActiveTool, sketchItems, setSketchItems } = useArtisanStore();
  const sketchMode = activeTool === 'sketch';

  const handleStartGeneration = (name: string) => {
    setComponentName(name);
    setCode(null);
  };

  return (
    <div className="flex-1 flex w-full h-full bg-surface overflow-hidden relative">
      {/* Hide layer panel in sketch mode */}
      {!sketchMode && <LayerPanel />}

      {/* Center Canvas Area */}
      <div className="flex-1 relative flex flex-col min-w-0">

        {sketchMode ? (
          // Full sketch canvas — fills center area
          <SketchLayer
            items={sketchItems}
            onItemsChange={setSketchItems}
            onClose={() => setActiveTool('select')}
          />
        ) : (
          <>
            <CanvasToolbar />
            {componentName ? (
              <ArtisanSandbox componentName={componentName} code={code} />
            ) : (
              <VisualCanvas />
            )}
            <ArtisanPromptBar
              onStartGeneration={handleStartGeneration}
              onCodeUpdate={(newCode) => setCode(newCode)}
              onDone={() => console.log('Generation completed')}
            />
          </>
        )}

      </div>

      {/* Right Panel */}
      {!sketchMode && (
        componentName ? (
          <ArtisanInspector componentName={componentName} code={code} isStreaming={isStreaming} />
        ) : (
          <StyleInspector />
        )
      )}
    </div>
  );
};
