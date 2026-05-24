import type { 
  RoutingContext, ModelScore, RoutingRule, RouterConfig, ModelMetadata, TaskType
} from './types';

// ── Intelligent Model Router ──────────────────────────────────────────────────

export class RouterEngine {
  private config: RouterConfig;
  private modelMetadata: Map<string, ModelMetadata> = new Map();
  private scoreCache: Map<string, { scores: ModelScore[]; timestamp: number }> = new Map();
  private cacheTtlMs = 60000; // 1 minute

  constructor(config: RouterConfig) {
    this.config = config;
  }

  /**
   * Score all available models for a given context.
   * Returns sorted list by score (highest first).
   */
  async scoreModels(context: RoutingContext): Promise<ModelScore[]> {
    // Check cache
    const cacheKey = this.getCacheKey(context);
    const cached = this.scoreCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.scores;
    }

    const models = Array.from(this.modelMetadata.values());
    const scores: ModelScore[] = [];

    for (const metadata of models) {
      if (!metadata.isAvailable) continue;

      const score = this.computeModelScore(metadata.modelId, context, metadata);
      scores.push(score);
    }

    // Sort by composite score (descending)
    scores.sort((a, b) => b.score - a.score);

    // Build fallback chain
    for (let i = 0; i < scores.length; i++) {
      const chainLength = this.config.fallbackToLocal ? 3 : 2;
      scores[i].fallbackChain = scores
        .slice(i + 1, i + 1 + chainLength)
        .map(s => s.modelId);
    }

    // Cache with timestamp
    this.scoreCache.set(cacheKey, { scores, timestamp: Date.now() });

    return scores;
  }

  /**
   * Select the single best model for a context.
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
    const availabilityScore = this.scoreAvailability();

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
      default:
        return 50;
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
    const taskToModel: Record<TaskType | 'generic', string[]> = {
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

  private scoreAvailability(): number {
    // TODO: Track API key availability, rate limits, etc.
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
    } else if (metadata.modelId && metadata.providerId) {
      this.modelMetadata.set(modelId, metadata as ModelMetadata);
      this.scoreCache.clear();
    }
  }

  /**
   * Initialize metadata from provided list.
   */
  registerModels(models: ModelMetadata[]): void {
    models.forEach(m => this.modelMetadata.set(m.modelId, m));
    this.scoreCache.clear();
  }
}

// Helper to create router instance
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

// Type to export for use in stores
export type { 
  RoutingContext, 
  ModelScore, 
  RoutingRule, 
  RouterConfig,
  ModelMetadata,
  TaskType,
  LatencyBudget,
  CostSensitivity,
} from './types';
