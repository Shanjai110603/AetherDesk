import { create } from 'zustand';
import { useTelemetryStore } from './useTelemetryStore';
import { RouterEngine, createRouterEngine } from '../ai/routing/RouterEngine';
import type { RoutingContext, ModelScore, RoutingRule, ModelMetadata, RouterConfig } from '../ai/routing/types';

interface RouterState {
  engine: RouterEngine | null;
  isInitialized: boolean;
  lastSelectedModel: string | null;
  selectionHistory: Array<{ context: RoutingContext; modelId: string; timestamp: number }>;

  // Actions
  initialize: (config?: Partial<RouterConfig>) => void;
  registerModels: (models: ModelMetadata[]) => void;
  scoreModels: (context: RoutingContext) => Promise<ModelScore[]>;
  selectBestModel: (context: RoutingContext) => Promise<string>;
  handleFailure: (modelId: string, context: RoutingContext) => Promise<string>;
  registerRule: (rule: RoutingRule) => void;
  updateModelMetadata: (modelId: string, metadata: Partial<ModelMetadata>) => void;
}

export const useRouterStore = create<RouterState>((set, get) => ({
  engine: null,
  isInitialized: false,
  lastSelectedModel: null,
  selectionHistory: [],

  initialize: (config?: Partial<RouterConfig>) => {
    if (!get().isInitialized) {
      const engine = createRouterEngine(config);
      set({ engine, isInitialized: true });
    }
  },

  registerModels: (models: ModelMetadata[]) => {
    const { engine } = get();
    if (engine) {
      engine.registerModels(models);
    }
  },

  scoreModels: async (context: RoutingContext) => {
    const { engine } = get();
    if (!engine) throw new Error('Router not initialized');
    return await engine.scoreModels(context);
  },

  selectBestModel: async (context: RoutingContext) => {
    const { engine, selectionHistory } = get();
    if (!engine) throw new Error('Router not initialized');
    
    const startTime = Date.now();
    const modelId = await engine.selectBestModel(context);
    const durationMs = Date.now() - startTime;
    
    // Log telemetry
    useTelemetryStore.getState().logEvent('routing_decision', {
      context,
      selectedModel: modelId,
    }, durationMs);

    // Track selection
    set({
      lastSelectedModel: modelId,
      selectionHistory: [
        ...selectionHistory,
        { context, modelId, timestamp: Date.now() },
      ].slice(-100), // Keep last 100
    });

    return modelId;
  },

  handleFailure: async (modelId: string, context: RoutingContext) => {
    const { engine } = get();
    if (!engine) throw new Error('Router not initialized');
    return await engine.handleModelFailure(modelId, context);
  },

  registerRule: (rule: RoutingRule) => {
    const { engine } = get();
    if (engine) engine.registerRoutingRule(rule);
  },

  updateModelMetadata: (modelId: string, metadata: Partial<ModelMetadata>) => {
    const { engine } = get();
    if (engine) engine.updateModelMetadata(modelId, metadata);
  },
}));
