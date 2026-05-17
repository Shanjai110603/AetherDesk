import React, { useState } from 'react';
import { useWorkspaceStore } from '../../core/store/useWorkspaceStore';

export const ArtisanSandbox: React.FC<{
  componentName: string | null;
  code: string | null;
}> = ({ componentName, code }) => {
  const { currentWorkspace } = useWorkspaceStore();
  const [iframeError, setIframeError] = useState(false);
  const [viewport, setViewport] = useState<'desktop'|'tablet'|'mobile'>('desktop');

  // If we have no component generated yet, show the grid canvas
  if (!componentName || !code) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none">
        <span className="material-symbols-outlined text-outline/30 text-8xl block mb-md">view_quilt</span>
        <h2 className="text-title-lg text-outline/50 font-bold tracking-widest">AETHER ARTISAN</h2>
        <p className="text-body-sm text-outline/40 mt-xs">Use the prompt bar below to generate components.</p>
      </div>
    );
  }

  // Assuming the isolated Vite runtime server runs on port 5174
  // The route /render?component=ComponentName loads the specific generated TSX file
  const sandboxUrl = `http://localhost:5174/render?component=${componentName}&workspace=${encodeURIComponent(currentWorkspace?.path ?? '')}`;

  const viewportClasses = {
    desktop: 'w-full h-full',
    tablet: 'w-[768px] h-full mx-auto border-x border-outline-variant/30 shadow-2xl',
    mobile: 'w-[375px] h-full mx-auto border-x border-outline-variant/30 shadow-2xl',
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#0a0a0c]">
      {/* Sandbox Header Overlay */}
      <div className="absolute top-md left-md right-md flex justify-between items-center pointer-events-none z-10">
        <div className="flex gap-xs pointer-events-auto">
           <button 
             onClick={() => setViewport('desktop')}
             className={`w-8 h-8 rounded backdrop-blur-md border flex items-center justify-center transition-all shadow-sm ${viewport === 'desktop' ? 'bg-secondary/20 text-secondary border-secondary/50' : 'bg-surface-container/80 text-outline border-outline-variant/50 hover:text-on-surface hover:bg-surface-container'}`}>
             <span className="material-symbols-outlined text-[16px]">desktop_windows</span>
           </button>
           <button 
             onClick={() => setViewport('tablet')}
             className={`w-8 h-8 rounded backdrop-blur-md border flex items-center justify-center transition-all shadow-sm ${viewport === 'tablet' ? 'bg-secondary/20 text-secondary border-secondary/50' : 'bg-surface-container/50 text-outline border-outline-variant/30 hover:text-on-surface hover:bg-surface-container'}`}>
             <span className="material-symbols-outlined text-[16px]">tablet_mac</span>
           </button>
           <button 
             onClick={() => setViewport('mobile')}
             className={`w-8 h-8 rounded backdrop-blur-md border flex items-center justify-center transition-all shadow-sm ${viewport === 'mobile' ? 'bg-secondary/20 text-secondary border-secondary/50' : 'bg-surface-container/50 text-outline border-outline-variant/30 hover:text-on-surface hover:bg-surface-container'}`}>
             <span className="material-symbols-outlined text-[16px]">smartphone</span>
           </button>
        </div>
        <div className="px-sm py-1 rounded bg-secondary-fixed-dim/20 text-secondary-fixed-dim text-[10px] font-bold tracking-widest uppercase border border-secondary-fixed-dim/30 backdrop-blur-md">
          ISOLATED VITE RUNTIME
        </div>
      </div>

      {/* Actual Iframe Sandbox */}
      <div className={`transition-all duration-300 ease-in-out ${viewportClasses[viewport]} bg-white`}>
        {!iframeError ? (
          <iframe
            src={sandboxUrl}
            className="w-full h-full border-none"
            title="Artisan Render Sandbox"
            sandbox="allow-scripts allow-same-origin"
            onError={() => setIframeError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-xl bg-surface">
            <span className="material-symbols-outlined text-error text-5xl mb-sm">portable_wifi_off</span>
            <h3 className="text-title-md text-on-surface font-bold">Runtime Disconnected</h3>
            <p className="text-body-sm text-outline mt-xs max-w-sm mx-auto">
              The isolated Artisan Vite runtime (localhost:5174) is not reachable.
              Ensure the secondary runtime server is started.
            </p>
            <div className="mt-lg p-sm bg-surface-container rounded border border-outline-variant text-left overflow-hidden">
               <span className="text-[10px] font-code-md text-outline uppercase">Generated Code Snippet Preview:</span>
               <pre className="text-[10px] font-code-md text-secondary-fixed-dim mt-xs overflow-hidden text-ellipsis max-h-32">
                 {code}
               </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
