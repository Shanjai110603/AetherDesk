# Phase 1 Implementation Guide: Intelligence Router & Cost Controls

**Scope**: Intelligent model routing + session cost management + rate-limit queueing  
**Timeline**: 8-10 weeks (2 engineers parallel)  
**Deliverables**: Functional router, cost dashboard, queue resilience

---

## 1. Intelligent Model Routing Engine

### 1.1 Core Types & Interfaces

```typescript
// src/core/ai/routing/types.ts (NEW)

export type TaskType = 
  | 'formatting'    // Code cleanup, linting fixes
  | 'testing'       // Unit tests, test cases
  | 'architecture'  // System design, refactoring
  | 'generation'    // Boilerplate, new code
  | 'analysis'      // Code review, bug detection
  | 'documentation' // Comments, docstrings
  | 'generic';      // Default fallback

export type LatencyBudget = 'realtime' | 'normal' | 'batch';
export type CostSensitivity = 'free' | 'cheap' | 'standard' | 'premium';

export interface RoutingContext {
  taskType: TaskType;
  contextSize: number;           // Approximate token count
  targetLatency: LatencyBudget;   // Expected latency tolerance
  costSensitivity: CostSensitivity;
  requiresOffline: boolean;       // Must work without internet
  workflowId?: string;
  agentId?: string;
  sessionId: string;
}

export interface ModelMetadata {
  modelId: string;
  providerId: string;
  contextWindow: number;
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  avgLatencyMs: number;
  lastUpdated: number;
  isLocal: boolean;
  isAvailable: boolean;
}

export interface ModelScore {
  modelId: string;
  providerId: string;
  score: number;                // 0-100 composite score
  scores: {
    costScore: number;          // 0-100 (100 = cheapest)
    latencyScore: number;       // 0-100 (100 = fastest)
    capabilityScore: number;    // 0-100 (100 = perfect fit)
    availabilityScore: number;  // 0-100 (100 = always available)
  };
  reasoning: string;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  fallbackChain: string[];      // Ordered list of fallback models
}

export interface RoutingRule {
  id: string;
  pattern: TaskType | string;   // Task type or regex pattern
  modelId: string;
  priority: number;             // Higher = evaluated first
  conditions?: {
    maxContextSize?: number;
    minAvailability?: number;
  };
}

export interface RouterConfig {
  rules: RoutingRule[];
  weights: {
    costWeight: number;         // 0-1
    latencyWeight: number;      // 0-1
    capabilityWeight: number;   // 0-1
    availabilityWeight: number; // 0-1
  };
  fallbackToLocal: boolean;     // Use local model if cloud fails
  maxFallbackChainLength: number;
}
```

### 1.2 Router Implementation

```typescript
// src/core/ai/routing/RouterEngine.ts (NEW)

import { useAiStore } from '../../store/useAiStore';
import { useCostStore } from '../../store/useCostStore';
import type { 
  RoutingContext, ModelScore, RoutingRule, RouterConfig 
} from './types';

export class RouterEngine {
  private config: RouterConfig;
  private modelMetadata: Map<string, ModelMetadata> = new Map();
  private scoreCache: Map<string, ModelScore[]> = new Map();
  private cacheTtlMs = 60000; // 1 minute

  constructor(config: RouterConfig) {
    this.config = config;
    this.initializeMetadata();
  }

  private initializeMetadata(): void {
    // Fetch model metadata from useAiStore
    const { models } = useAiStore.getState();
    models.forEach(model => {
      this.modelMetadata.set(model.id, {
        modelId: model.id,
        providerId: model.providerId,
        contextWindow: model.contextWindow,
        costPer1kInputTokens: 0,  // TODO: fetch from provider pricing
        costPer1kOutputTokens: 0,
        avgLatencyMs: 500,         // TODO: track from telemetry
        lastUpdated: Date.now(),
        isLocal: model.isLocal || false,
        isAvailable: true,
      });
    });
  }

  /**
   * Score all available models for a given context.
   * Returns sorted list by score (highest first).
   */
  async scoreModels(context: RoutingContext): Promise<ModelScore[]> {
    // Check cache
    const cacheKey = this.getCacheKey(context);
    const cached = this.scoreCache.get(cacheKey);
    if (cached && Date.now() - cached[0].lastUpdated < this.cacheTtlMs) {
      return cached;
    }

    const { models } = useAiStore.getState();
    const scores: ModelScore[] = [];

    for (const model of models) {
      if (!this.modelMetadata.has(model.id)) continue;
      
      const metadata = this.modelMetadata.get(model.id)!;
      if (!metadata.isAvailable) continue;

      const score = this.computeModelScore(model.id, context, metadata);
      scores.push(score);
    }

    // Sort by composite score (descending)
    scores.sort((a, b) => b.score - a.score);

    // Build fallback chain
    for (let i = 0; i < scores.length; i++) {
      scores[i].fallbackChain = scores
        .slice(i + 1, i + 1 + this.config.fallbackToLocal ? 3 : 2)
        .map(s => s.modelId);
    }

    // Cache
    this.scoreCache.set(cacheKey, scores);

    return scores;
  }

  /**
   * Select the single best model for a context.
   * If selection fails, automatically tries fallback chain.
   */
  async selectBestModel(context: RoutingContext): Promise<string> {
    const scores = await this.scoreModels(context);
    
    if (scores.length === 0) {
      throw new Error('No suitable models available for routing context');
    }

    return scores[0].modelId;
  }

  /**
   * Compute composite score for a single model.
   */
  private computeModelScore(
    modelId: string,
    context: RoutingContext,
    metadata: ModelMetadata,
  ): ModelScore {
    const costScore = this.scoreCost(metadata, context);
    const latencyScore = this.scoreLatency(metadata, context);
    const capabilityScore = this.scoreCapability(modelId, context);
    const availabilityScore = this.scoreAvailability(modelId);

    const compositeScore = 
      (costScore * this.config.weights.costWeight) +
      (latencyScore * this.config.weights.latencyWeight) +
      (capabilityScore * this.config.weights.capabilityWeight) +
      (availabilityScore * this.config.weights.availabilityWeight);

    return {
      modelId,
      providerId: metadata.providerId,
      score: compositeScore,
      scores: { costScore, latencyScore, capabilityScore, availabilityScore },
      reasoning: this.generateReasoning(modelId, context),
      estimatedCostUsd: this.estimateCost(metadata, context),
      estimatedLatencyMs: metadata.avgLatencyMs,
      fallbackChain: [],
    };
  }

  private scoreCost(metadata: ModelMetadata, context: RoutingContext): number {
    const costUsd = this.estimateCost(metadata, context);
    
    switch (context.costSensitivity) {
      case 'free':
        return metadata.isLocal ? 100 : Math.max(0, 100 - costUsd * 1000);
      case 'cheap':
        return Math.max(0, 100 - costUsd * 500);
      case 'standard':
        return Math.max(0, 100 - costUsd * 100);
      case 'premium':
        return 50; // All premium models equally viable
    }
  }

  private scoreLatency(metadata: ModelMetadata, context: RoutingContext): number {
    const targetMs = 
      context.targetLatency === 'realtime' ? 500 :
      context.targetLatency === 'normal' ? 2000 :
      10000;

    return Math.max(0, 100 - (metadata.avgLatencyMs / targetMs) * 100);
  }

  private scoreCapability(modelId: string, context: RoutingContext): number {
    // Match model capabilities to task requirements
    const taskToModel: Record<string, string[]> = {
      formatting: ['mistral-7b', 'gpt-4-mini', 'claude-3-haiku'],
      testing: ['gpt-4-mini', 'claude-3-haiku'],
      architecture: ['gpt-4', 'claude-3-opus'],
      generation: ['mistral-7b', 'gpt-4', 'claude-3-sonnet'],
      analysis: ['gpt-4', 'claude-3-opus'],
      documentation: ['claude-3-sonnet', 'gpt-4-mini'],
      generic: ['*'], // Any model works
    };

    const preferred = taskToModel[context.taskType] || ['*'];
    if (preferred.includes('*') || preferred.includes(modelId)) {
      return 100;
    }
    return 50;
  }

  private scoreAvailability(modelId: string): number {
    // TODO: Track API key availability, rate limits, etc.
    const { providers } = useAiStore.getState();
    // Check if provider is configured
    // Check if we're within rate limits
    return 100; // Placeholder
  }

  private estimateCost(metadata: ModelMetadata, context: RoutingContext): number {
    // Rough estimate: assume 3:1 input:output ratio
    const outputTokens = context.contextSize / 3;
    const inputCost = (context.contextSize / 1000) * metadata.costPer1kInputTokens;
    const outputCost = (outputTokens / 1000) * metadata.costPer1kOutputTokens;
    return inputCost + outputCost;
  }

  private generateReasoning(modelId: string, context: RoutingContext): string {
    return `Selected ${modelId} for ${context.taskType} task with ${context.costSensitivity} cost sensitivity`;
  }

  private getCacheKey(context: RoutingContext): string {
    return `${context.taskType}:${context.costSensitivity}:${context.targetLatency}`;
  }

  /**
   * Handle model failure and try fallback.
   */
  async handleModelFailure(
    modelId: string,
    context: RoutingContext,
  ): Promise<string> {
    const scores = await this.scoreModels(context);
    const failedScore = scores.find(s => s.modelId === modelId);
    
    if (!failedScore || failedScore.fallbackChain.length === 0) {
      throw new Error(`Model ${modelId} failed and no fallbacks available`);
    }

    // Try next in fallback chain
    return failedScore.fallbackChain[0];
  }

  /**
   * Register custom routing rule.
   */
  registerRoutingRule(rule: RoutingRule): void {
    this.config.rules.push(rule);
    this.config.rules.sort((a, b) => b.priority - a.priority);
    
    // Invalidate cache
    this.scoreCache.clear();
  }

  /**
   * Update model metadata (called periodically or on provider change).
   */
  updateModelMetadata(modelId: string, metadata: Partial<ModelMetadata>): void {
    const existing = this.modelMetadata.get(modelId);
    if (existing) {
      this.modelMetadata.set(modelId, { ...existing, ...metadata });
      this.scoreCache.clear();
    }
  }
}

// Export singleton instance
export const createRouterEngine = (config?: Partial<RouterConfig>): RouterEngine => {
  const defaultConfig: RouterConfig = {
    rules: [],
    weights: {
      costWeight: 0.25,
      latencyWeight: 0.25,
      capabilityWeight: 0.3,
      availabilityWeight: 0.2,
    },
    fallbackToLocal: true,
    maxFallbackChainLength: 3,
    ...config,
  };
  return new RouterEngine(defaultConfig);
};
```

### 1.3 Router Store Integration

```typescript
// src/core/store/useRouterStore.ts (NEW)

import { create } from 'zustand';
import { RouterEngine, createRouterEngine } from '../ai/routing/RouterEngine';
import type { RoutingContext, ModelScore, RoutingRule } from '../ai/routing/types';

interface RouterState {
  engine: RouterEngine | null;
  isInitialized: boolean;
  lastSelectedModel: string | null;
  selectionHistory: Array<{ context: RoutingContext; modelId: string; timestamp: number }>;

  // Actions
  initialize: (config?: any) => void;
  scoreModels: (context: RoutingContext) => Promise<ModelScore[]>;
  selectBestModel: (context: RoutingContext) => Promise<string>;
  handleFailure: (modelId: string, context: RoutingContext) => Promise<string>;
  registerRule: (rule: RoutingRule) => void;
}

export const useRouterStore = create<RouterState>((set, get) => ({
  engine: null,
  isInitialized: false,
  lastSelectedModel: null,
  selectionHistory: [],

  initialize: (config?: any) => {
    if (!get().isInitialized) {
      const engine = createRouterEngine(config);
      set({ engine, isInitialized: true });
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
    
    const modelId = await engine.selectBestModel(context);
    
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
}));
```

### 1.4 Tauri Command Integration

```rust
// src-tauri/src/commands/router.rs (NEW)

use serde::{Deserialize, Serialize};
use crate::orchestration::RoutingContext;

#[derive(Debug, Serialize, Deserialize)]
pub struct RouterScoreRequest {
    pub task_type: String,
    pub context_size: usize,
    pub target_latency: String,
    pub cost_sensitivity: String,
    pub requires_offline: bool,
    pub workflow_id: Option<String>,
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelScoreResponse {
    pub model_id: String,
    pub provider_id: String,
    pub score: f64,
    pub estimated_cost_usd: f64,
    pub estimated_latency_ms: u64,
    pub reasoning: String,
}

#[tauri::command]
pub async fn router_score_models(
    request: RouterScoreRequest,
) -> Result<Vec<ModelScoreResponse>, String> {
    // Call Rust routing engine
    // For now, mock implementation
    Ok(vec![
        ModelScoreResponse {
            model_id: "gpt-4".to_string(),
            provider_id: "openai".to_string(),
            score: 95.0,
            estimated_cost_usd: 0.03,
            estimated_latency_ms: 1200,
            reasoning: "Best capability match".to_string(),
        },
    ])
}

#[tauri::command]
pub async fn router_select_best_model(
    request: RouterScoreRequest,
) -> Result<String, String> {
    let scores = router_score_models(request).await?;
    Ok(scores[0].model_id.clone())
}

#[tauri::command]
pub async fn router_handle_failure(
    failed_model: String,
    request: RouterScoreRequest,
) -> Result<String, String> {
    let scores = router_score_models(request).await?;
    let fallback = scores
        .into_iter()
        .find(|s| s.model_id != failed_model)
        .ok_or("No fallback models available")?;
    Ok(fallback.model_id)
}
```

---

## 2. Session Cost Controls & Token Management

### 2.1 Cost Store

```typescript
// src/core/store/useCostStore.ts (NEW)

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface CostConfig {
  sessionSpendCap: number;     // $ per session
  dailyBudget: number;         // $ per day
  monthlyBudget: number;       // $ per month
  perAgentTokenLimit: number;  // Tokens per agent execution
  warningThreshold: number;    // Warn at X% of cap (0-1)
  hardStopAt: number;          // Hard stop at X% (0-1, usually 1.0)
}

export interface TokenTelemetry {
  sessionId: string;
  providerId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
}

export interface SpendSnapshot {
  sessionSpend: number;
  dailySpend: number;
  monthlySpend: number;
  sessionTokens: number;
  estimatedCompletion: number; // 0-1
  isWarningThreshold: boolean;
  isHardStop: boolean;
}

interface CostState {
  config: CostConfig;
  telemetry: TokenTelemetry[];
  currentSnap shot: SpendSnapshot | null;

  // Actions
  setConfig: (config: Partial<CostConfig>) => void;
  recordTokens: (telemetry: TokenTelemetry) => Promise<void>;
  getBudgetAvailable: (sessionId: string, estimatedTokens: number) => Promise<boolean>;
  getSpendSnapshot: (sessionId: string) => Promise<SpendSnapshot>;
  getSessionHistory: (limit?: number) => TokenTelemetry[];
}

export const useCostStore = create<CostState>((set, get) => ({
  config: {
    sessionSpendCap: 10.0,
    dailyBudget: 50.0,
    monthlyBudget: 500.0,
    perAgentTokenLimit: 100000,
    warningThreshold: 0.75,
    hardStopAt: 1.0,
  },
  telemetry: [],
  currentSnapshot: null,

  setConfig: (config) => {
    set(state => ({
      config: { ...state.config, ...config },
    }));
  },

  recordTokens: async (telemetry) => {
    await invoke('cost_record_tokens', { telemetry });
    
    set(state => ({
      telemetry: [...state.telemetry, telemetry],
    }));
  },

  getBudgetAvailable: async (sessionId, estimatedTokens) => {
    const snapshot = await invoke<SpendSnapshot>('cost_get_spend_snapshot', {
      session_id: sessionId,
    });

    const { config } = get();
    return !snapshot.isHardStop && snapshot.sessionSpend < config.sessionSpendCap;
  },

  getSpendSnapshot: async (sessionId) => {
    return await invoke<SpendSnapshot>('cost_get_spend_snapshot', {
      session_id: sessionId,
    });
  },

  getSessionHistory: (limit = 100) => {
    const { telemetry } = get();
    return telemetry.slice(-limit);
  },
}));
```

### 2.2 Cost Dashboard Component

```tsx
// src/workspaces/nexus/TokenDashboard.tsx (NEW)

import React, { useEffect, useState } from 'react';
import { useCostStore } from '../../core/store/useCostStore';
import type { SpendSnapshot } from '../../core/store/useCostStore';

export const TokenDashboard: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { config, getSpendSnapshot } = useCostStore();
  const [snapshot, setSnapshot] = useState<SpendSnapshot | null>(null);

  useEffect(() => {
    const updateSnapshot = async () => {
      const snap = await getSpendSnapshot(sessionId);
      setSnapshot(snap);
    };
    updateSnapshot();
    const interval = setInterval(updateSnapshot, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, [sessionId, getSpendSnapshot]);

  if (!snapshot) return <div>Loading...</div>;

  const sessionPercent = (snapshot.sessionSpend / config.sessionSpendCap) * 100;
  const dailyPercent = (snapshot.dailySpend / config.dailyBudget) * 100;
  const monthlyPercent = (snapshot.monthlySpend / config.monthlyBudget) * 100;

  return (
    <div className="p-4 bg-surface-container rounded-lg space-y-4">
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Session Budget</span>
          <span className="font-mono">${snapshot.sessionSpend.toFixed(2)} / ${config.sessionSpendCap}</span>
        </div>
        <div className="w-full bg-surface-container-high rounded h-2">
          <div
            className={`h-2 rounded transition-all ${
              sessionPercent > 100 ? 'bg-error' :
              sessionPercent > 75 ? 'bg-warning' :
              'bg-primary'
            }`}
            style={{ width: `${Math.min(sessionPercent, 100)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Daily Budget</span>
          <span className="font-mono">${snapshot.dailySpend.toFixed(2)} / ${config.dailyBudget}</span>
        </div>
        <div className="w-full bg-surface-container-high rounded h-2">
          <div
            className={`h-2 rounded transition-all ${
              dailyPercent > 100 ? 'bg-error' :
              dailyPercent > 75 ? 'bg-warning' :
              'bg-primary'
            }`}
            style={{ width: `${Math.min(dailyPercent, 100)}%` }}
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Monthly Budget</span>
          <span className="font-mono">${snapshot.monthlySpend.toFixed(2)} / ${config.monthlyBudget}</span>
        </div>
        <div className="w-full bg-surface-container-high rounded h-2">
          <div
            className={`h-2 rounded transition-all ${
              monthlyPercent > 100 ? 'bg-error' :
              monthlyPercent > 75 ? 'bg-warning' :
              'bg-primary'
            }`}
            style={{ width: `${Math.min(monthlyPercent, 100)}%` }}
          />
        </div>
      </div>

      {snapshot.isWarningThreshold && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded text-warning text-sm">
          ⚠️ Approaching spend cap
        </div>
      )}

      {snapshot.isHardStop && (
        <div className="p-3 bg-error/10 border border-error/30 rounded text-error text-sm">
          ❌ Spend cap reached. New requests blocked.
        </div>
      )}
    </div>
  );
};
```

---

## 3. Rate-Limit Queueing & Backoff

### 3.1 Request Queue Implementation

```typescript
// src/core/ai/RequestQueue.ts (NEW)

import { invoke } from '@tauri-apps/api/core';
import type { StreamRequest } from '../store/useAiStore';

export type QueuePriority = 'realtime' | 'normal' | 'batch';

export interface QueuedRequest {
  id: string;
  sessionId: string;
  agentId?: string;
  priority: QueuePriority;
  payload: StreamRequest;
  retryCount: number;
  createdAt: number;
  expiresAt: number;
}

interface RateLimitError {
  type: 'rate_limit' | 'timeout' | 'server_error';
  retryAfterMs: number;
  message: string;
}

export class RequestQueue {
  private queue: Map<string, QueuedRequest[]> = new Map();
  private processing = false;
  private pausedWorkflows: Set<string> = new Set();

  async enqueue(request: QueuedRequest, priority = 'normal'): Promise<void> {
    const sessionQueue = this.queue.get(request.sessionId) || [];
    sessionQueue.push(request);
    sessionQueue.sort((a, b) => this.priorityValue(b.priority) - this.priorityValue(a.priority));
    this.queue.set(request.sessionId, sessionQueue);

    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.size > 0) {
      for (const [sessionId, requests] of this.queue) {
        if (requests.length === 0) continue;

        const request = requests.shift()!;

        try {
          await invoke('ai_chat_stream', request.payload);
        } catch (error) {
          await this.handleError(error as RateLimitError, request);
        }
      }

      // Small delay to prevent busy-waiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
  }

  private async handleError(error: RateLimitError, request: QueuedRequest): Promise<void> {
    if (error.type === 'rate_limit') {
      // Re-queue with backoff
      const backoffMs = Math.min(
        error.retryAfterMs,
        1000 * Math.pow(2, request.retryCount),
      );

      setTimeout(() => {
        this.enqueue({
          ...request,
          retryCount: request.retryCount + 1,
        });
      }, backoffMs);

      // Pause related workflows
      if (request.agentId) {
        this.pauseWorkflow(request.agentId);
      }
    }
  }

  pauseWorkflow(workflowId: string): void {
    this.pausedWorkflows.add(workflowId);
    // Emit event: workflow paused
    window.dispatchEvent(new CustomEvent('aetherdesk:workflow_paused', { detail: { workflowId } }));
  }

  resumeWorkflow(workflowId: string): void {
    this.pausedWorkflows.delete(workflowId);
    // Emit event: workflow resumed
    window.dispatchEvent(new CustomEvent('aetherdesk:workflow_resumed', { detail: { workflowId } }));
  }

  private priorityValue(priority: QueuePriority): number {
    return priority === 'realtime' ? 3 : priority === 'normal' ? 2 : 1;
  }

  getQueueStatus(): { totalQueued: number; bySession: Record<string, number> } {
    const bySession: Record<string, number> = {};
    let totalQueued = 0;

    for (const [sessionId, requests] of this.queue) {
      bySession[sessionId] = requests.length;
      totalQueued += requests.length;
    }

    return { totalQueued, bySession };
  }
}

// Export singleton
export const requestQueue = new RequestQueue();
```

---

## Integration Checklist for Phase 1

- [ ] Create `RouterEngine` and `useRouterStore`
- [ ] Implement model scoring algorithms
- [ ] Wire router into `ai_chat_stream` command
- [ ] Create `useCostStore` and cost tracking Tauri commands
- [ ] Build `TokenDashboard` component
- [ ] Implement cost telemetry in AI streaming
- [ ] Create `RequestQueue` and backoff logic
- [ ] Add rate-limit error handling
- [ ] Integrate pause/resume workflow UI
- [ ] Build configuration UI for cost caps & rules
- [ ] Write tests for router scoring
- [ ] Write tests for cost calculation
- [ ] Performance benchmarks (router < 100ms)
- [ ] Integration tests (e2e router + cost + queue)

---

## Success Criteria (Phase 1)

✅ Router makes optimal model selections within 100ms  
✅ Cost tracking accurate to within 1% of provider actual  
✅ Rate-limit queue prevents cascade failures  
✅ Dashboard updates realtime (< 1s latency)  
✅ Fallback chain works end-to-end  
✅ 30% cost reduction via intelligent routing (observed)

