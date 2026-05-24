/**
 * E2E Test: Telemetry & Observability Pipeline
 *
 * Validates that operational events are correctly logged,
 * metrics are accurately computed, and the rolling buffer works.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useTelemetryStore } from '@/core/store/useTelemetryStore';

beforeEach(() => {
  useTelemetryStore.setState({ events: [] });
});

// ── Event Logging ─────────────────────────────────────────────────────────────

describe('Telemetry — Event Logging', () => {
  it('should log a diff_review event with correct fields', () => {
    const { logEvent, events } = useTelemetryStore.getState();
    logEvent('diff_review', { action: 'accepted', path: 'index.ts' }, 1200);

    const updated = useTelemetryStore.getState().events;
    expect(updated).toHaveLength(1);
    expect(updated[0].type).toBe('diff_review');
    expect(updated[0].metadata.action).toBe('accepted');
    expect(updated[0].durationMs).toBe(1200);
    expect(updated[0].id).toBeTruthy();
    expect(updated[0].timestamp).toBeGreaterThan(0);
  });

  it('should log an agent_execution event', () => {
    const { logEvent } = useTelemetryStore.getState();
    logEvent('agent_execution', { toolName: 'fs_write', status: 'success' }, 340);

    const { events } = useTelemetryStore.getState();
    expect(events[0].type).toBe('agent_execution');
    expect(events[0].metadata.toolName).toBe('fs_write');
    expect(events[0].durationMs).toBe(340);
  });

  it('should log a routing_decision event', () => {
    const { logEvent } = useTelemetryStore.getState();
    logEvent('routing_decision', { selectedModel: 'gpt-4o', context: { taskType: 'analysis' } }, 25);

    const { events } = useTelemetryStore.getState();
    expect(events[0].type).toBe('routing_decision');
    expect(events[0].metadata.selectedModel).toBe('gpt-4o');
  });

  it('should cap the rolling buffer at 2000 events', () => {
    const { logEvent } = useTelemetryStore.getState();
    for (let i = 0; i < 2100; i++) {
      logEvent('agent_execution', { toolName: 'test', status: 'success' }, 10);
    }
    const { events } = useTelemetryStore.getState();
    expect(events.length).toBe(2000);
  });
});

// ── Metrics Computation ───────────────────────────────────────────────────────

describe('Telemetry — Metrics', () => {
  it('should return zero metrics with no events', () => {
    const metrics = useTelemetryStore.getState().getMetrics();
    expect(metrics.totalDiffsReviewed).toBe(0);
    expect(metrics.diffAcceptanceRate).toBe(0);
    expect(metrics.totalAgentExecutions).toBe(0);
    expect(metrics.agentSuccessRate).toBe(0);
  });

  it('should compute diffAcceptanceRate correctly', () => {
    const { logEvent } = useTelemetryStore.getState();
    logEvent('diff_review', { action: 'accepted' }, 1000);
    logEvent('diff_review', { action: 'accepted' }, 1000);
    logEvent('diff_review', { action: 'rejected' }, 500);

    const metrics = useTelemetryStore.getState().getMetrics();
    expect(metrics.totalDiffsReviewed).toBe(3);
    // 2 accepted out of 3 = 0.666...
    expect(metrics.diffAcceptanceRate).toBeCloseTo(0.667, 2);
  });

  it('should compute averageDiffReviewLatencyMs correctly', () => {
    const { logEvent } = useTelemetryStore.getState();
    logEvent('diff_review', { action: 'accepted' }, 1000);
    logEvent('diff_review', { action: 'rejected' }, 3000);

    const metrics = useTelemetryStore.getState().getMetrics();
    expect(metrics.averageDiffReviewLatencyMs).toBe(2000);
  });

  it('should compute agentSuccessRate correctly', () => {
    const { logEvent } = useTelemetryStore.getState();
    logEvent('agent_execution', { toolName: 'fs_write', status: 'success' }, 200);
    logEvent('agent_execution', { toolName: 'fs_write', status: 'success' }, 200);
    logEvent('agent_execution', { toolName: 'exec_cmd', status: 'failure' }, 50);

    const metrics = useTelemetryStore.getState().getMetrics();
    expect(metrics.totalAgentExecutions).toBe(3);
    expect(metrics.agentSuccessRate).toBeCloseTo(0.667, 2);
  });

  it('should compute averageExecutionDurationMs correctly', () => {
    const { logEvent } = useTelemetryStore.getState();
    logEvent('agent_execution', { status: 'success' }, 100);
    logEvent('agent_execution', { status: 'success' }, 300);

    const metrics = useTelemetryStore.getState().getMetrics();
    expect(metrics.averageExecutionDurationMs).toBe(200);
  });

  it('should exclude zero-duration events from latency averages', () => {
    const { logEvent } = useTelemetryStore.getState();
    // One real event, one with no duration
    logEvent('diff_review', { action: 'accepted' }, 2000);
    logEvent('diff_review', { action: 'rejected' }); // no durationMs

    const metrics = useTelemetryStore.getState().getMetrics();
    // Only the 2000ms event should be factored
    expect(metrics.averageDiffReviewLatencyMs).toBe(2000);
  });
});

// ── Clear ─────────────────────────────────────────────────────────────────────

describe('Telemetry — Clear', () => {
  it('should clear all events on clearTelemetry()', () => {
    const { logEvent, clearTelemetry } = useTelemetryStore.getState();
    logEvent('diff_review', { action: 'accepted' }, 500);
    logEvent('agent_execution', { status: 'success' }, 300);

    clearTelemetry();
    expect(useTelemetryStore.getState().events).toHaveLength(0);
  });
});
