/**
 * E2E Test: Full Orchestration Loop
 *
 * Simulates the complete agent-human-orchestration pipeline:
 * Tool Execution → Diff Staging → User Review → Telemetry
 *
 * This is the integration test that validates all 4 phases work together.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDiffReviewStore } from '@/core/store/useDiffReviewStore';
import { useTelemetryStore } from '@/core/store/useTelemetryStore';
import { platformToolBroker } from '@/core/ai/tools/ToolBroker';

// ── Reset state before each test ──────────────────────────────────────────────

beforeEach(() => {
  useDiffReviewStore.setState({ pendingDiffs: [], resolvedDiffs: [] });
  useTelemetryStore.setState({ events: [] });
  platformToolBroker.onRequestApproval = undefined;
  platformToolBroker.onDelegateTask = undefined;
});

// ── Tool Broker — Capability Gates ───────────────────────────────────────────

describe('ToolBroker — Capability Gates', () => {
  it('should deny execution if agent lacks required capability', async () => {
    platformToolBroker.setCapabilities([]); // Clear all capabilities
    const result = await platformToolBroker.executeTool({
      name: 'fs_read',
      parameters: { path: '/some/file.ts' },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('lacks required capability');
    platformToolBroker.setCapabilities(['READ_FS', 'WORKFLOW_EXECUTION']); // Restore
  });

  it('should allow execution when required capability is present', async () => {
    platformToolBroker.setCapabilities(['READ_FS', 'WORKFLOW_EXECUTION']);
    const result = await platformToolBroker.executeTool({
      name: 'fs_read',
      parameters: { path: '/some/file.ts' },
    });
    // fs_read invokes Tauri which is mocked to return stub content
    expect(result.success).toBe(true);
  });
});

// ── Tool Broker — Approval Gate ───────────────────────────────────────────────

describe('ToolBroker — UX Approval Gate', () => {
  it('should block destructive tools when user denies', async () => {
    // fs_write requires WRITE_FS capability and isDestructive: true
    platformToolBroker.setCapabilities(['READ_FS', 'WRITE_FS', 'WORKFLOW_EXECUTION']);
    platformToolBroker.onRequestApproval = vi.fn().mockResolvedValue(false);

    const result = await platformToolBroker.executeTool({
      name: 'fs_write',
      parameters: { path: '/src/index.ts', content: 'bad code' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('denied');
    expect(platformToolBroker.onRequestApproval).toHaveBeenCalledOnce();

    // Restore safe default capabilities
    platformToolBroker.setCapabilities(['READ_FS', 'WORKFLOW_EXECUTION']);
    platformToolBroker.onRequestApproval = undefined;
  });
});

// ── Tool Broker — Telemetry ───────────────────────────────────────────────────

describe('ToolBroker — Telemetry Recording', () => {
  it('should log an agent_execution event on successful tool call', async () => {
    platformToolBroker.setCapabilities(['READ_FS', 'WORKFLOW_EXECUTION']);
    await platformToolBroker.executeTool({
      name: 'fs_read',
      parameters: { path: '/some/file.ts' },
    });

    const { events } = useTelemetryStore.getState();
    const execEvent = events.find(e => e.type === 'agent_execution');
    expect(execEvent).toBeDefined();
    expect(execEvent!.metadata.toolName).toBe('fs_read');
    expect(execEvent!.metadata.status).toBe('success');
    expect(execEvent!.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should NOT log an agent_execution event when blocked at the approval gate', async () => {
    // Approval gate fires BEFORE execution — so no telemetry should be logged
    platformToolBroker.setCapabilities(['READ_FS', 'WRITE_FS', 'WORKFLOW_EXECUTION']);
    platformToolBroker.onRequestApproval = vi.fn().mockResolvedValue(false);

    await platformToolBroker.executeTool({
      name: 'fs_write',
      parameters: { path: '/src/x.ts', content: 'x' },
    });

    const { events } = useTelemetryStore.getState();
    // Approval denial exits before reaching the try/catch that logs telemetry
    const execEvent = events.find(e => e.type === 'agent_execution');
    expect(execEvent).toBeUndefined();

    // Restore
    platformToolBroker.setCapabilities(['READ_FS', 'WORKFLOW_EXECUTION']);
    platformToolBroker.onRequestApproval = undefined;
  });
});

// ── Full Pipeline: Stage → Accept → Telemetry ────────────────────────────────

describe('Orchestration — Full E2E Loop', () => {
  it('should complete the full stage → accept → telemetry loop', async () => {
    const { stageDiff, acceptDiff } = useDiffReviewStore.getState();

    // 1. Agent stages a diff
    const approvalPromise = stageDiff({
      path: 'src/agent/planner.ts',
      language: 'TypeScript',
      oldContent: 'export const plan = () => null;',
      newContent: 'export const plan = () => ({ steps: [] });',
      summary: 'Return empty plan instead of null',
    });

    // 2. Verify it shows up as pending
    expect(useDiffReviewStore.getState().pendingDiffs).toHaveLength(1);
    const id = useDiffReviewStore.getState().pendingDiffs[0].id;

    // 3. User accepts
    await acceptDiff(id);
    const approved = await approvalPromise;
    expect(approved).toBe(true);

    // 4. Diff moves to resolved
    expect(useDiffReviewStore.getState().pendingDiffs).toHaveLength(0);
    expect(useDiffReviewStore.getState().resolvedDiffs[0].status).toBe('accepted');

    // 5. Telemetry captured
    const { events } = useTelemetryStore.getState();
    const diffEvent = events.find(e => e.type === 'diff_review');
    expect(diffEvent).toBeDefined();
    expect(diffEvent!.metadata.action).toBe('accepted');
    expect(diffEvent!.metadata.path).toBe('src/agent/planner.ts');
  });

  it('should complete the full stage → edit → accept → telemetry loop', async () => {
    const { stageDiff, editDiff, acceptDiff } = useDiffReviewStore.getState();

    // 1. Agent proposes code
    const approvalPromise = stageDiff({
      path: 'src/utils/helper.ts',
      language: 'TypeScript',
      oldContent: 'export const greet = () => "hello";',
      newContent: 'export const greet = () => "Hello, World!";',
      summary: 'Update greeting',
    });

    const id = useDiffReviewStore.getState().pendingDiffs[0].id;

    // 2. User edits proposed code before accepting
    editDiff(id, 'export const greet = (name: string) => `Hello, ${name}!`;');

    // 3. Verify edit is reflected
    const edited = useDiffReviewStore.getState().pendingDiffs[0];
    expect(edited.newContent).toContain('name: string');

    // 4. Accept the edited version
    await acceptDiff(id);
    const approved = await approvalPromise;
    expect(approved).toBe(true);

    // 5. Accepted version contains the user's edit
    const resolved = useDiffReviewStore.getState().resolvedDiffs[0];
    expect(resolved.newContent).toContain('name: string');
    expect(resolved.status).toBe('accepted');
  });

  it('should complete the full stage → reject → telemetry loop', async () => {
    const { stageDiff, rejectDiff } = useDiffReviewStore.getState();

    const approvalPromise = stageDiff({
      path: 'src/risky.ts',
      language: 'TypeScript',
      oldContent: 'export const x = 1;',
      newContent: 'export const x = 0; // risky change',
      summary: 'Risky modification',
    });

    const id = useDiffReviewStore.getState().pendingDiffs[0].id;
    rejectDiff(id);

    const approved = await approvalPromise;
    expect(approved).toBe(false);

    // Telemetry reflects rejection
    const { getMetrics } = useTelemetryStore.getState();
    const metrics = getMetrics();
    expect(metrics.diffAcceptanceRate).toBe(0);
    expect(metrics.totalDiffsReviewed).toBe(1);
  });
});
