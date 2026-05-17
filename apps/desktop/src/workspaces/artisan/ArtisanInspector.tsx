import React, { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../../core/store/useWorkspaceStore';
import { injectComponentToAst } from '../../core/artisan/astInjector';
import {
  useArtisanStore,
  findLayerInTree,
  type ArtisanLayer,
  type LayerStyle,
} from '../../core/store/useArtisanStore';

const FONT_OPTIONS = ['Inter', 'System UI', 'Arial', 'Georgia', 'JetBrains Mono'];
const WEIGHT_OPTIONS = ['300', '400', '500', '600', '700', '800'];
const ALIGN_OPTIONS = ['left', 'center', 'right', 'justify'];
const FLEX_DIRECTION_OPTIONS = ['row', 'column', 'row-reverse', 'column-reverse'];
const JUSTIFY_OPTIONS = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
const ALIGN_ITEMS_OPTIONS = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'];
const BORDER_STYLE_OPTIONS = ['solid', 'dashed', 'dotted', 'none'];
const COLOR_PRESETS = ['#0d0d15', '#1b1b23', '#292932', '#464554', '#e4e1ed', '#908fa0', '#2fd9f4', '#8083ff', '#cf6679', '#4ade80'];

type ValidationResult = { ok: true; value: string } | { ok: false; error: string };

const UNIT_KEYS = new Set<keyof LayerStyle>([
  'fontSize', 'letterSpacing', 'width', 'height', 'gap',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'borderRadius', 'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
]);

const COLOR_KEYS = new Set<keyof LayerStyle>(['color', 'backgroundColor', 'borderColor']);

const OPTION_KEYS: Partial<Record<keyof LayerStyle, string[]>> = {
  fontFamily: FONT_OPTIONS,
  fontWeight: WEIGHT_OPTIONS,
  textAlign: ALIGN_OPTIONS,
  flexDirection: FLEX_DIRECTION_OPTIONS,
  justifyContent: JUSTIFY_OPTIONS,
  alignItems: ALIGN_ITEMS_OPTIONS,
  borderStyle: BORDER_STYLE_OPTIONS,
};

function normalizeLayerStyle(key: keyof LayerStyle, rawValue: string): ValidationResult {
  const value = rawValue.trim();
  if (!value) return { ok: true, value: '' };

  if (UNIT_KEYS.has(key)) {
    if (/^-?\d+(\.\d+)?$/.test(value)) return { ok: true, value: `${value}px` };
    if (/^-?\d+(\.\d+)?(px|rem|em|%|vw|vh)$/.test(value) || value === 'auto' || value === 'fit-content') {
      return { ok: true, value };
    }
    return { ok: false, error: 'Use a number, px/rem/em/%, or auto.' };
  }

  if (COLOR_KEYS.has(key)) {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return { ok: true, value };
    return { ok: false, error: 'Use a 6-digit hex color.' };
  }

  if (key === 'opacity') {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return { ok: true, value };
    return { ok: false, error: 'Opacity must be 0-1.' };
  }

  if (key === 'lineHeight') {
    if (/^\d+(\.\d+)?$/.test(value) || /^\d+(\.\d+)?(px|rem|em|%)$/.test(value)) return { ok: true, value };
    return { ok: false, error: 'Use a number or length.' };
  }

  const options = OPTION_KEYS[key];
  if (options && !options.includes(value)) {
    return { ok: false, error: `Allowed: ${options.join(', ')}` };
  }

  return { ok: true, value };
}

export const ArtisanInspector: React.FC<{
  componentName: string | null;
  code: string | null;
  isStreaming: boolean;
}> = ({ componentName, isStreaming }) => {
  const { currentWorkspace } = useWorkspaceStore();
  const [refineInput, setRefineInput] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof LayerStyle, string>>>({});
  const { selectedLayerId, layers, updateLayerStyle } = useArtisanStore();

  const layer = selectedLayerId ? findLayerInTree(layers, selectedLayerId) : null;
  const pageLayer = useMemo(() => findLayerInTree(layers, 'canvas-root') ?? layers[0] ?? null, [layers]);
  const inspectedLayer = layer ?? pageLayer;
  const isPageInspector = !layer;

  const handleSendToForge = async () => {
    if (!currentWorkspace || !componentName) return;
    try {
      const scratchPath = `${currentWorkspace.path}/.aether/artisan-runtime/generated/${componentName}.tsx`;
      const targetPath = await invoke<string>('copy_to_workspace', {
        scratchPath,
        workspacePath: currentWorkspace.path,
        componentName,
      });
      console.log('Successfully moved to:', targetPath);

      const appTsxPath = `${currentWorkspace.path}/src/App.tsx`;
      try {
        const appCode = await invoke<string>('fs_read_file', { path: appTsxPath });
        const importPath = `./components/generated/${componentName}`;
        const newAppCode = injectComponentToAst(appCode, componentName, importPath);
        await invoke('fs_write_file', { path: appTsxPath, content: newAppCode });
      } catch (injectErr) {
        console.error('Failed to inject into App.tsx:', injectErr);
      }
    } catch (e) {
      console.error('Failed to send to forge:', e);
    }
  };

  const handleRefine = () => {
    if (!refineInput.trim() || isStreaming) return;
    sessionStorage.setItem('artisan_prompt', refineInput.trim());
    setRefineInput('');
  };

  const commitStyle = (key: keyof LayerStyle, value: string) => {
    if (!inspectedLayer) return;
    const result = normalizeLayerStyle(key, value);
    if (!result.ok) {
      setErrors(prev => ({ ...prev, [key]: result.error }));
      return;
    }
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    updateLayerStyle(inspectedLayer.id, key, result.value);
  };

  return (
    <div className="w-80 bg-surface-container border-l border-outline-variant flex flex-col flex-shrink-0 relative">
      <div className="p-md border-b border-outline-variant flex justify-between items-center">
        <span className="text-label-caps text-on-surface-variant uppercase tracking-widest font-bold">
          {isPageInspector ? 'Page' : inspectedLayer?.name ?? componentName ?? 'AI Component'}
        </span>
        {isStreaming ? (
          <span className="text-[10px] text-secondary font-bold tracking-widest flex items-center gap-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />GENERATING
          </span>
        ) : (
          <span className="material-symbols-outlined text-[16px] text-secondary-fixed-dim">tune</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-md space-y-lg">
        <ActionsSection
          isStreaming={isStreaming}
          refineInput={refineInput}
          setRefineInput={setRefineInput}
          onRefine={handleRefine}
          onSendToForge={handleSendToForge}
        />

        {!inspectedLayer ? (
          <div className="flex flex-col items-center justify-center p-xl opacity-50 text-center">
            <span className="material-symbols-outlined text-4xl mb-sm">design_services</span>
            <p className="text-body-sm text-outline">Select a layer to inspect properties.</p>
          </div>
        ) : isPageInspector ? (
          <InspectorSection title="Page">
            <ColorRow label="Background" value={inspectedLayer.styles.backgroundColor ?? '#0d0d15'} onChange={value => commitStyle('backgroundColor', value)} error={errors.backgroundColor} />
            <DropdownRow label="Font" value={inspectedLayer.styles.fontFamily ?? 'Inter'} options={FONT_OPTIONS} onChange={value => commitStyle('fontFamily', value)} error={errors.fontFamily} />
            <UnitRow label="Base Size" value={inspectedLayer.styles.fontSize ?? '14px'} onChange={value => commitStyle('fontSize', value)} error={errors.fontSize} />
          </InspectorSection>
        ) : (
          <>
            <InspectorSection title="Typography">
              <DropdownRow label="Font" value={inspectedLayer.styles.fontFamily ?? 'Inter'} options={FONT_OPTIONS} onChange={value => commitStyle('fontFamily', value)} error={errors.fontFamily} />
              <UnitRow label="Size" value={inspectedLayer.styles.fontSize ?? '14px'} onChange={value => commitStyle('fontSize', value)} error={errors.fontSize} />
              <DropdownRow label="Weight" value={inspectedLayer.styles.fontWeight ?? '400'} options={WEIGHT_OPTIONS} onChange={value => commitStyle('fontWeight', value)} error={errors.fontWeight} />
              <DropdownRow label="Align" value={inspectedLayer.styles.textAlign ?? 'left'} options={ALIGN_OPTIONS} onChange={value => commitStyle('textAlign', value)} error={errors.textAlign} />
              <UnitRow label="Line Height" value={inspectedLayer.styles.lineHeight ?? '1.4'} step={0.1} onChange={value => commitStyle('lineHeight', value)} error={errors.lineHeight} />
              <UnitRow label="Letter Spacing" value={inspectedLayer.styles.letterSpacing ?? '0px'} onChange={value => commitStyle('letterSpacing', value)} error={errors.letterSpacing} />
              <ColorRow label="Text" value={inspectedLayer.styles.color ?? '#e4e1ed'} onChange={value => commitStyle('color', value)} error={errors.color} />
            </InspectorSection>

            <InspectorSection title="Dimensions">
              <UnitRow label="Width" value={inspectedLayer.styles.width ?? ''} onChange={value => commitStyle('width', value)} error={errors.width} />
              <UnitRow label="Height" value={inspectedLayer.styles.height ?? ''} onChange={value => commitStyle('height', value)} error={errors.height} />
            </InspectorSection>

            <InspectorSection title="Layout">
              <DropdownRow label="Direction" value={inspectedLayer.styles.flexDirection ?? 'row'} options={FLEX_DIRECTION_OPTIONS} disabled={!isContainer(inspectedLayer)} onChange={value => commitStyle('flexDirection', value)} error={errors.flexDirection} />
              <DropdownRow label="Justify" value={inspectedLayer.styles.justifyContent ?? 'flex-start'} options={JUSTIFY_OPTIONS} disabled={!isContainer(inspectedLayer)} onChange={value => commitStyle('justifyContent', value)} error={errors.justifyContent} />
              <DropdownRow label="Align" value={inspectedLayer.styles.alignItems ?? 'stretch'} options={ALIGN_ITEMS_OPTIONS} disabled={!isContainer(inspectedLayer)} onChange={value => commitStyle('alignItems', value)} error={errors.alignItems} />
              <UnitRow label="Gap" value={inspectedLayer.styles.gap ?? '0px'} disabled={!isContainer(inspectedLayer)} onChange={value => commitStyle('gap', value)} error={errors.gap} />
            </InspectorSection>

            <InspectorSection title="Box">
              <ColorRow label="Fill" value={inspectedLayer.styles.backgroundColor ?? '#1b1b23'} onChange={value => commitStyle('backgroundColor', value)} error={errors.backgroundColor} />
              <UnitRow label="Opacity" value={inspectedLayer.styles.opacity ?? '1'} step={0.1} min={0} max={1} onChange={value => commitStyle('opacity', value)} error={errors.opacity} />
              <QuadRow title="Padding" keys={['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']} styles={inspectedLayer.styles} errors={errors} onChange={commitStyle} />
              <QuadRow title="Margin" keys={['marginTop', 'marginRight', 'marginBottom', 'marginLeft']} styles={inspectedLayer.styles} errors={errors} onChange={commitStyle} />
              <QuadRow title="Border" keys={['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']} styles={inspectedLayer.styles} errors={errors} onChange={commitStyle} />
              <DropdownRow label="Border Style" value={inspectedLayer.styles.borderStyle ?? 'solid'} options={BORDER_STYLE_OPTIONS} onChange={value => commitStyle('borderStyle', value)} error={errors.borderStyle} />
              <ColorRow label="Border" value={inspectedLayer.styles.borderColor ?? '#464554'} onChange={value => commitStyle('borderColor', value)} error={errors.borderColor} />
              <UnitRow label="Radius" value={inspectedLayer.styles.borderRadius ?? '0px'} onChange={value => commitStyle('borderRadius', value)} error={errors.borderRadius} />
            </InspectorSection>
          </>
        )}
      </div>
    </div>
  );
};

function ActionsSection({
  isStreaming,
  refineInput,
  setRefineInput,
  onRefine,
  onSendToForge,
}: {
  isStreaming: boolean;
  refineInput: string;
  setRefineInput: (value: string) => void;
  onRefine: () => void;
  onSendToForge: () => void;
}) {
  return (
    <>
      <div className="space-y-sm">
        <label className="text-[10px] font-label-caps text-outline uppercase">Actions</label>
        <button
          onClick={onSendToForge}
          disabled={isStreaming}
          className="w-full flex items-center justify-center gap-sm bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/30 rounded py-sm transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">terminal</span>
          <span className="text-body-sm font-bold">Send to Forge</span>
        </button>
      </div>

      <div className="space-y-sm">
        <label className="text-[10px] font-label-caps text-outline uppercase">Refine Component</label>
        <div className="flex gap-xs">
          <input
            type="text"
            placeholder="e.g. Make it dark mode..."
            disabled={isStreaming}
            value={refineInput}
            onChange={e => setRefineInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onRefine(); }}
            className="flex-1 bg-surface-container-highest border border-outline-variant rounded px-sm py-xs text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary transition-colors"
          />
          <button
            disabled={isStreaming || !refineInput.trim()}
            onClick={onRefine}
            className="p-xs bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">auto_awesome</span>
          </button>
        </div>
      </div>
    </>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-sm">
      <div className="flex items-center justify-between">
        <span className="text-label-caps text-on-surface-variant font-bold">{title}</span>
      </div>
      <div className="space-y-xs">{children}</div>
    </section>
  );
}

function UnitRow({
  label,
  value,
  onChange,
  error,
  step = 1,
  min,
  max,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const numeric = parseFloat(value) || 0;
  const unit = value.match(/[a-z%]+$/i)?.[0] ?? (label === 'Opacity' || label === 'Line Height' ? '' : 'px');
  const commitNumber = (next: number) => {
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, Number(next.toFixed(2))));
    onChange(`${clamped}${unit}`);
  };

  return (
    <RowFrame label={label} error={error} disabled={disabled}>
      <button className="inspector-stepper" disabled={disabled} onClick={() => commitNumber(numeric - step)}>-</button>
      <input
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[11px] text-on-surface outline-none text-center disabled:text-outline"
      />
      <button className="inspector-stepper" disabled={disabled} onClick={() => commitNumber(numeric + step)}>+</button>
    </RowFrame>
  );
}

function DropdownRow({
  label,
  value,
  options,
  onChange,
  error,
  disabled = false,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <RowFrame label={label} error={error} disabled={disabled}>
      <select
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent text-[11px] text-on-surface outline-none disabled:text-outline"
      >
        {options.map(option => <option key={option} value={option}>{normalizeFontLabel(option)}</option>)}
      </select>
    </RowFrame>
  );
}

function ColorRow({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
  return (
    <div className="space-y-1">
      <RowFrame label={label} error={error}>
        <input type="color" value={safeValue} onChange={e => onChange(e.target.value)} className="w-5 h-5 rounded border-none bg-transparent p-0" />
        <input value={value} onChange={e => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] text-on-surface outline-none font-mono" />
      </RowFrame>
      <div className="flex flex-wrap gap-1 pl-[82px]">
        {COLOR_PRESETS.map(color => (
          <button
            key={color}
            title={color}
            onClick={() => onChange(color)}
            className="w-4 h-4 rounded border border-outline-variant"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

function QuadRow({
  title,
  keys,
  styles,
  errors,
  onChange,
}: {
  title: string;
  keys: [keyof LayerStyle, keyof LayerStyle, keyof LayerStyle, keyof LayerStyle];
  styles: LayerStyle;
  errors: Partial<Record<keyof LayerStyle, string>>;
  onChange: (key: keyof LayerStyle, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const labels = ['Top', 'Right', 'Bottom', 'Left'];
  return (
    <div className="rounded border border-outline-variant bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-sm py-xs text-left"
      >
        <span className="text-[11px] font-bold text-on-surface-variant">{title}</span>
        <span className="material-symbols-outlined text-[14px] text-outline">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-xs p-xs border-t border-outline-variant">
          {keys.map((key, index) => (
            <UnitRow
              key={key}
              label={labels[index] ?? ''}
              value={styles[key] ?? '0px'}
              onChange={value => onChange(key, value)}
              error={errors[key]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RowFrame({
  label,
  children,
  error,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className={`flex items-center gap-xs rounded border px-xs py-1 ${error ? 'border-error text-error' : 'border-outline-variant'} ${disabled ? 'opacity-45' : ''} bg-surface-container-highest`}>
        <span className="w-[70px] text-[10px] text-outline uppercase tracking-wide truncate">{label}</span>
        {children}
      </div>
      {error && <div className="text-[10px] text-error mt-1 pl-[78px]">{error}</div>}
    </div>
  );
}

function normalizeFontLabel(value: string): string {
  return value === 'System UI' ? 'System' : value;
}

function isContainer(layer: ArtisanLayer): boolean {
  return layer.type === 'container' || layer.type === 'section' || layer.type === 'frame';
}
