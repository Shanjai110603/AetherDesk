import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { hydrateStore } from './core/store/persistence';

const Nexus = lazy(() => import('./workspaces/nexus/Nexus').then(module => ({ default: module.Nexus })));
const Forge = lazy(() => import('./workspaces/forge/Forge').then(module => ({ default: module.Forge })));
const Loom = lazy(() => import('./workspaces/loom/Loom').then(module => ({ default: module.Loom })));
const Artisan = lazy(() => import('./workspaces/artisan/Artisan').then(module => ({ default: module.Artisan })));
const Browser = lazy(() => import('./workspaces/browser/Browser').then(module => ({ default: module.Browser })));
const Settings = lazy(() => import('./workspaces/settings/Settings').then(module => ({ default: module.Settings })));
const SwarmRegistry = lazy(() => import('./workspaces/swarm/SwarmRegistry').then(module => ({ default: module.SwarmRegistry })));
const Features = lazy(() => import('./workspaces/features/Features').then(module => ({ default: module.Features })));
import { useWorkflowStore } from './core/store/useWorkflowStore';
import { useFilesystemStore } from './core/store/useFilesystemStore';
import { useAiStore } from './core/store/useAiStore';
import { useArtisanStore } from './core/store/useArtisanStore';
import { useSwarmStore } from './core/store/useSwarmStore';
import { useRouterStore } from './core/store/useRouterStore';
import { useWorkspaceStore } from './core/store/useWorkspaceStore';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';

function App() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    async function initStores() {
      // Run hydrations in parallel
      await Promise.all([
        hydrateStore('workflow-state', useWorkflowStore, ['nodes', 'edges', 'canvasOffset', 'canvasZoom']),
        hydrateStore('fs-state', useFilesystemStore, ['openTabs', 'activeTabId', 'activeFolderPath']),
        hydrateStore('artisan-state', useArtisanStore, ['layers', 'canvasZoom', 'viewport', 'activeTool', 'inspectorTab']),
        hydrateStore('ai-state', useAiStore, ['activeModelId', 'sessions']),
        hydrateStore('swarm-state', useSwarmStore, ['personas']),
      ]);

      // ── Seed the Intelligence Router with available models ──────────────
      const { initialize, registerModels } = useRouterStore.getState();
      initialize();
      const availableModels = useAiStore.getState().models;
      if (availableModels.length > 0) {
        registerModels(availableModels.map(m => ({
          modelId: m.id,
          providerId: m.providerId,
          isLocal: m.providerId === 'ollama' || m.providerId === 'local',
          isAvailable: true,
          costPer1kInputTokens: m.providerId === 'ollama' || m.providerId === 'local' ? 0 : 0.003,
          costPer1kOutputTokens: m.providerId === 'ollama' || m.providerId === 'local' ? 0 : 0.006,
          avgLatencyMs: m.providerId === 'ollama' || m.providerId === 'local' ? 800 : 1500,
          contextWindow: 128000,
          lastUpdated: Date.now(),
        })));
      }
      
      // Load OS-Native API Keys
      await useAiStore.getState().loadApiKeys();

      // Auto-load workspace directory if one was persisted
      const { activeFolderPath, loadDirectory } = useFilesystemStore.getState();
      if (activeFolderPath) {
        await loadDirectory(activeFolderPath);
      }

      setIsHydrated(true);
    }
    initStores();
  }, []);

  const hasCompletedOnboarding = useWorkspaceStore(state => state.hasCompletedOnboarding);

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
      {!hasCompletedOnboarding && <OnboardingFlow />}
      <Suspense fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-background text-secondary-fixed-dim">
          <span className="material-symbols-outlined animate-spin text-3xl mr-md">sync</span>
          Loading Workspace...
        </div>
      }>
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
            <Route path="features" element={<Features />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
