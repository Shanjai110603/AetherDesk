import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Nexus } from './workspaces/nexus/Nexus';
import { Forge } from './workspaces/forge/Forge';
import { Loom } from './workspaces/loom/Loom';
import { Artisan } from './workspaces/artisan/Artisan';
import { Browser } from './workspaces/browser/Browser';
import { Settings } from './workspaces/settings/Settings';
import { SwarmRegistry } from './workspaces/swarm/SwarmRegistry';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { useEffect, useState } from 'react';
import { hydrateStore } from './core/store/persistence';
import { useWorkflowStore } from './core/store/useWorkflowStore';
import { useFilesystemStore } from './core/store/useFilesystemStore';
import { useAiStore } from './core/store/useAiStore';
import { useArtisanStore } from './core/store/useArtisanStore';
import { useSwarmStore } from './core/store/useSwarmStore';

function App() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    async function initStores() {
      // Run hydrations in parallel
      await Promise.all([
        hydrateStore('workflow-state', useWorkflowStore, ['nodes', 'edges', 'canvasOffset', 'canvasZoom']),
        hydrateStore('fs-state', useFilesystemStore, ['openTabs', 'activeTabId']),
        hydrateStore('artisan-state', useArtisanStore, ['layers', 'canvasZoom', 'viewport', 'activeTool', 'inspectorTab']),
        hydrateStore('ai-state', useAiStore, ['activeModelId', 'sessions']),
        hydrateStore('swarm-state', useSwarmStore, ['personas']),
      ]);
      setIsHydrated(true);
    }
    initStores();
  }, []);

  if (!isHydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-secondary-fixed-dim font-code-md">
        <span className="material-symbols-outlined animate-spin text-3xl mr-md">sync</span>
        Initializing Workspace...
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Default route redirects to Nexus */}
          <Route index element={<Navigate to="/nexus" replace />} />
          
          {/* Core Workspaces */}
          <Route path="nexus" element={<Nexus />} />
          <Route path="forge" element={<Forge />} />
          <Route path="artisan" element={<Artisan />} />
          <Route path="loom" element={<Loom />} />
          <Route path="browser" element={<Browser />} />
          <Route path="swarm" element={<SwarmRegistry />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
