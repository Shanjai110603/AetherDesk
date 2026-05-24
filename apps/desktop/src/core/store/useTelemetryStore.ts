import { create } from 'zustand';

export type TelemetryEventType = 
  | 'diff_review' 
  | 'agent_execution' 
  | 'routing_decision' 
  | 'system_error';

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  timestamp: number;
  durationMs?: number;
  metadata: Record<string, any>;
}

export interface TelemetryMetrics {
  // Diff Review Metrics
  totalDiffsReviewed: number;
  diffAcceptanceRate: number;
  averageDiffReviewLatencyMs: number;
  
  // Agent Execution Metrics
  totalAgentExecutions: number;
  agentSuccessRate: number;
  averageExecutionDurationMs: number;
}

interface TelemetryState {
  events: TelemetryEvent[];
  
  // Actions
  logEvent: (type: TelemetryEventType, metadata: Record<string, any>, durationMs?: number) => void;
  getMetrics: () => TelemetryMetrics;
  clearTelemetry: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  events: [],

  logEvent: (type, metadata, durationMs) => {
    const newEvent: TelemetryEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: Date.now(),
      durationMs,
      metadata,
    };

    set(state => ({
      events: [...state.events, newEvent].slice(-2000) // Keep last 2000 events locally
    }));
  },

  getMetrics: () => {
    const { events } = get();
    
    // Calculate Diff Review Metrics
    const diffEvents = events.filter(e => e.type === 'diff_review');
    const totalDiffsReviewed = diffEvents.length;
    const acceptedDiffs = diffEvents.filter(e => e.metadata.action === 'accepted').length;
    const diffAcceptanceRate = totalDiffsReviewed > 0 ? acceptedDiffs / totalDiffsReviewed : 0;
    
    const diffLatencies = diffEvents.map(e => e.durationMs || 0).filter(ms => ms > 0);
    const averageDiffReviewLatencyMs = diffLatencies.length > 0 
      ? diffLatencies.reduce((a, b) => a + b, 0) / diffLatencies.length 
      : 0;

    // Calculate Agent Execution Metrics
    const execEvents = events.filter(e => e.type === 'agent_execution');
    const totalAgentExecutions = execEvents.length;
    const successfulExecs = execEvents.filter(e => e.metadata.status === 'success').length;
    const agentSuccessRate = totalAgentExecutions > 0 ? successfulExecs / totalAgentExecutions : 0;
    
    const execLatencies = execEvents.map(e => e.durationMs || 0).filter(ms => ms > 0);
    const averageExecutionDurationMs = execLatencies.length > 0
      ? execLatencies.reduce((a, b) => a + b, 0) / execLatencies.length
      : 0;

    return {
      totalDiffsReviewed,
      diffAcceptanceRate,
      averageDiffReviewLatencyMs,
      totalAgentExecutions,
      agentSuccessRate,
      averageExecutionDurationMs,
    };
  },

  clearTelemetry: () => set({ events: [] })
}));
