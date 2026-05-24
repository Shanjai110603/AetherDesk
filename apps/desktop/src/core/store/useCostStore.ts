import { create } from 'zustand';

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
  currentSnapshot: SpendSnapshot | null;

  // Actions
  setConfig: (config: Partial<CostConfig>) => void;
  recordTokens: (telemetry: TokenTelemetry) => void;
  getSessionCost: () => number;
  getDailyCost: () => number;
  getMonthCost: () => number;
  getSessionHistory: (limit?: number) => TokenTelemetry[];
  computeSnapshot: (sessionId: string) => SpendSnapshot;
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

  recordTokens: (telemetry) => {
    set(state => {
      const updated = [...state.telemetry, telemetry];
      // Keep last 1000 entries
      return {
        telemetry: updated.slice(-1000),
      };
    });
  },

  getSessionCost: () => {
    const { telemetry } = get();
    return telemetry.reduce((sum, t) => sum + t.costUsd, 0);
  },

  getDailyCost: () => {
    const { telemetry } = get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    
    return telemetry
      .filter(t => t.timestamp >= todayTs)
      .reduce((sum, t) => sum + t.costUsd, 0);
  },

  getMonthCost: () => {
    const { telemetry } = get();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartTs = monthStart.getTime();
    
    return telemetry
      .filter(t => t.timestamp >= monthStartTs)
      .reduce((sum, t) => sum + t.costUsd, 0);
  },

  getSessionHistory: (limit = 100) => {
    const { telemetry } = get();
    return telemetry.slice(-limit);
  },

  computeSnapshot: (sessionId: string) => {
    const { config, telemetry } = get();
    const sessionTelemetry = telemetry.filter(t => t.sessionId === sessionId);
    
    const sessionSpend = sessionTelemetry.reduce((sum, t) => sum + t.costUsd, 0);
    const sessionTokens = sessionTelemetry.reduce((sum, t) => sum + t.inputTokens + t.outputTokens, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();
    const dailySpend = telemetry
      .filter(t => t.timestamp >= todayTs)
      .reduce((sum, t) => sum + t.costUsd, 0);
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartTs = monthStart.getTime();
    const monthlySpend = telemetry
      .filter(t => t.timestamp >= monthStartTs)
      .reduce((sum, t) => sum + t.costUsd, 0);

    const sessionCompletion = sessionSpend / config.sessionSpendCap;
    const isWarningThreshold = sessionCompletion >= config.warningThreshold;
    const isHardStop = sessionCompletion >= config.hardStopAt;

    return {
      sessionSpend,
      dailySpend,
      monthlySpend,
      sessionTokens,
      estimatedCompletion: Math.min(1, sessionCompletion),
      isWarningThreshold,
      isHardStop,
    };
  },
}));
