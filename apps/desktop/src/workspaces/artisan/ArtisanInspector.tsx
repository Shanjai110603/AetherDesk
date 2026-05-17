import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../../core/store/useWorkspaceStore';
import { injectComponentToAst } from '../../core/artisan/astInjector';
import { useArtisanStore, findLayerInTree, type LayerStyle } from '../../core/store/useArtisanStore';

export const ArtisanInspector: React.FC<{
  componentName: string | null;
  code: string | null;
  isStreaming: boolean;
}> = ({ componentName, isStreaming }) => {
  const { currentWorkspace } = useWorkspaceStore();
  const [refineInput, setRefineInput] = useState('');

  const {
    selectedLayerId,
    layers,
    updateLayerStyle,
    // other store actions could be added here if needed
  } = useArtisanStore();

  const layer = selectedLayerId ? findLayerInTree(layers, selectedLayerId) : null;

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

      // AST Injection
      const appTsxPath = `${currentWorkspace.path}/src/App.tsx`;
      try {
        const appCode = await invoke<string>('fs_read_file', { path: appTsxPath });
        const importPath = `./components/generated/${componentName}`;
        const newAppCode = injectComponentToAst(appCode, componentName, importPath);
        await invoke('fs_write_file', { path: appTsxPath, content: newAppCode });
        console.log('Successfully injected into App.tsx');
      } catch (injectErr) {
        console.error('Failed to inject into App.tsx, file might not exist or parsing failed:', injectErr);
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

  const handleChange = (key: keyof LayerStyle, value: string) => {
    if (layer) updateLayerStyle(layer.id, key, value);
  };

  // Fallback UI when no layer is selected – retains original placeholder behavior
  if (!layer) {
    return (
      <div className="w-80 bg-surface-container border-l border-outline-variant flex flex-col flex-shrink-0">
        <div className="p-md border-b border-outline-variant flex justify-between items-center">
          <span className="text-label-caps text-on-surface-variant uppercase tracking-widest font-bold">Properties</span>
        </div>
        <div className="flex flex-col items-center justify-center p-xl opacity-50 flex-1 text-center">
          <span className="material-symbols-outlined text-4xl mb-sm" style={{ fontVariationSettings: "'FILL' 0" }}>design_services</span>
          <p className="text-body-sm text-outline">Select an AI component or generate a new one to see properties.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-surface-container border-l border-outline-variant flex flex-col flex-shrink-0 relative">
      {/* Header with component name and streaming status */}
      <div className="p-md border-b border-outline-variant flex justify-between items-center">
        <span className="text-label-caps text-on-surface-variant uppercase tracking-widest font-bold">{componentName ?? 'AI Component'}</span>
        {isStreaming ? (
          <span className="text-[10px] text-secondary font-bold tracking-widest flex items-center gap-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />GENERATING
          </span>
        ) : (
          <span className="material-symbols-outlined text-[16px] text-secondary-fixed-dim">check_circle</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-md space-y-lg">
        {/* Quick Actions */}
        <div className="space-y-sm">
          <label className="text-[10px] font-label-caps text-outline uppercase">Actions</label>
          <button
            onClick={handleSendToForge}
            disabled={isStreaming}
            className="w-full flex items-center justify-center gap-sm bg-secondary/10 hover:bg-secondary/20 text-secondary border border-secondary/30 rounded py-sm transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">terminal</span>
            <span className="text-body-sm font-bold">Send to Forge</span>
          </button>
        </div>

        {/* Refine Component */}
        <div className="space-y-sm">
          <label className="text-[10px] font-label-caps text-outline uppercase">Refine Component</label>
          <div className="flex gap-xs">
            <input
              type="text"
              placeholder="e.g. Make it dark mode..."
              disabled={isStreaming}
              value={refineInput}
              onChange={e => setRefineInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRefine(); }}
              className="flex-1 bg-surface-container-highest border border-outline-variant rounded px-sm py-xs text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary transition-colors"
            />
            <button
              disabled={isStreaming || !refineInput.trim()}
              onClick={handleRefine}
              className="p-xs bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant rounded transition-colors disabled:opacity-50 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">auto_awesome</span>
            </button>
          </div>
        </div>

        {/* Inspector Sections */}
        {/* Spacing */}
        <div className="space-y-sm">
          <span className="text-label-caps text-on-surface-variant font-bold">Spacing</span>
          <div className="grid grid-cols-2 gap-sm">
            {['paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft'].map(key => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-body-sm w-24 capitalize">{key}</span>
                <input
                  type="text"
                  value={(layer.styles as Record<string, string | undefined>)[key] || ''}
                  onChange={e => handleChange(key as any, e.target.value)}
                  className="flex-1 bg-surface-container-highest border border-outline-variant rounded px-1 text-xs text-on-surface"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="space-y-sm">
          <span className="text-label-caps text-on-surface-variant font-bold">Typography</span>
          <div className="grid grid-cols-2 gap-sm">
            {['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','color','textAlign'].map(key => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-body-sm w-24 capitalize">{key}</span>
                <input
                  type="text"
                  value={(layer.styles as Record<string, string | undefined>)[key] || ''}
                  onChange={e => handleChange(key as any, e.target.value)}
                  className="flex-1 bg-surface-container-highest border border-outline-variant rounded px-1 text-xs text-on-surface"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Layout */}
        <div className="space-y-sm">
          <span className="text-label-caps text-on-surface-variant font-bold">Layout</span>
          <div className="grid grid-cols-2 gap-sm">
            {['display','flexDirection','alignItems','justifyContent','gap','width','height'].map(key => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-body-sm w-24 capitalize">{key}</span>
                <input
                  type="text"
                  value={(layer.styles as Record<string, string | undefined>)[key] || ''}
                  onChange={e => handleChange(key as any, e.target.value)}
                  className="flex-1 bg-surface-container-highest border border-outline-variant rounded px-1 text-xs text-on-surface"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Box */}
        <div className="space-y-sm">
          <span className="text-label-caps text-on-surface-variant font-bold">Box</span>
          <div className="grid grid-cols-2 gap-sm">
            {['backgroundColor','opacity','borderRadius','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderStyle','borderColor','boxShadow'].map(key => (
              <div key={key} className="flex items-center gap-1">
                <span className="text-body-sm w-24 capitalize">{key}</span>
                <input
                  type="text"
                  value={(layer.styles as Record<string, string | undefined>)[key] || ''}
                  onChange={e => handleChange(key as any, e.target.value)}
                  className="flex-1 bg-surface-container-highest border border-outline-variant rounded px-1 text-xs text-on-surface"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
