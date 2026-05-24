// ── Intelligent Model Routing System Types ────────────────────────────────────

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
