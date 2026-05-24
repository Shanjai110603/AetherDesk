/**
 * E2E Test: Diff Review Pipeline
 *
 * Validates the full human-in-the-loop trust boundary:
 * stage → review → edit → accept/reject → telemetry recorded
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDiffReviewStore } from '@/core/store/useDiffReviewStore';
import { useTelemetryStore } from '@/core/store/useTelemetryStore';

// Reset both stores before each test
beforeEach(() => {
  useDiffReviewStore.setState({ pendingDiffs: [], resolvedDiffs: [] });
  useTelemetryStore.setState({ events: [] });
});

// ── Helper ───────────────────────────────────────────────────────────────────

async function stageTestDiff(opts: { path?: string; oldContent?: string; newContent?: string } = {}) {
  const { stageDiff } = useDiffReviewStore.getState();
  return stageDiff({
    path: opts.path ?? 'src/core/agent.ts',
    language: 'TypeScript',
    oldContent: opts.oldContent ?? 'const x = 1;',
    newContent: opts.newContent ?? 'const x = 2;',
    summary: 'Test diff',
  });
}

// ── Stage ─────────────────────────────────────────────────────────────────────

describe('Diff Review — Stage', () => {
  it('should add a pending diff when stageDiff is called', async () => {
    const promise = stageTestDiff();

    const { pendingDiffs } = useDiffReviewStore.getState();
    expect(pendingDiffs).toHaveLength(1);
    expect(pendingDiffs[0].path).toBe('src/core/agent.ts');
    expect(pendingDiffs[0].status).toBe('pending');

    // Resolve to avoid unhandled promise
    useDiffReviewStore.getState().rejectDiff(pendingDiffs[0].id);
    await promise;
  });

  it('should compute diff lines correctly', async () => {
    const promise = stageTestDiff({
      oldContent: 'const x = 1;',
      newContent: 'const x = 2;',
    });

    const { pendingDiffs } = useDiffReviewStore.getState();
    const diff = pendingDiffs[0];

    // Should have at least one removed and one added line
    const removed = diff.lines.filter(l => l.kind === 'removed');
    const added = diff.lines.filter(l => l.kind === 'added');
    expect(removed.length).toBeGreaterThan(0);
    expect(added.length).toBeGreaterThan(0);

    useDiffReviewStore.getState().rejectDiff(diff.id);
    await promise;
  });

  it('should auto-detect language from file path', async () => {
    const promise = stageTestDiff({ path: 'src/main.py' });
    const { pendingDiffs } = useDiffReviewStore.getState();
    expect(pendingDiffs[0].language).toBe('Python');
    useDiffReviewStore.getState().rejectDiff(pendingDiffs[0].id);
    await promise;
  });
});

// ── Accept ────────────────────────────────────────────────────────────────────

describe('Diff Review — Accept', () => {
  it('should resolve the staged promise with true on accept', async () => {
    const promise = stageTestDiff();
    const { pendingDiffs, acceptDiff } = useDiffReviewStore.getState();
    const id = pendingDiffs[0].id;

    await acceptDiff(id);
    const result = await promise;
    expect(result).toBe(true);
  });

  it('should move diff from pending to resolved on accept', async () => {
    const promise = stageTestDiff();
    const { pendingDiffs, acceptDiff } = useDiffReviewStore.getState();
    const id = pendingDiffs[0].id;

    await acceptDiff(id);
    await promise;

    const state = useDiffReviewStore.getState();
    expect(state.pendingDiffs).toHaveLength(0);
    expect(state.resolvedDiffs).toHaveLength(1);
    expect(state.resolvedDiffs[0].status).toBe('accepted');
  });

  it('should log a diff_review accepted event to telemetry', async () => {
    const promise = stageTestDiff();
    const { pendingDiffs, acceptDiff } = useDiffReviewStore.getState();
    await acceptDiff(pendingDiffs[0].id);
    await promise;

    const { events } = useTelemetryStore.getState();
    const diffEvent = events.find(e => e.type === 'diff_review');
    expect(diffEvent).toBeDefined();
    expect(diffEvent!.metadata.action).toBe('accepted');
    expect(diffEvent!.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Reject ────────────────────────────────────────────────────────────────────

describe('Diff Review — Reject', () => {
  it('should resolve the staged promise with false on reject', async () => {
    const promise = stageTestDiff();
    const { pendingDiffs, rejectDiff } = useDiffReviewStore.getState();
    rejectDiff(pendingDiffs[0].id);
    const result = await promise;
    expect(result).toBe(false);
  });

  it('should log a diff_review rejected event to telemetry', async () => {
    const promise = stageTestDiff();
    const { pendingDiffs, rejectDiff } = useDiffReviewStore.getState();
    rejectDiff(pendingDiffs[0].id);
    await promise;

    const { events } = useTelemetryStore.getState();
    const diffEvent = events.find(e => e.type === 'diff_review');
    expect(diffEvent!.metadata.action).toBe('rejected');
  });
});

// ── Edit ──────────────────────────────────────────────────────────────────────

describe('Diff Review — Edit', () => {
  it('should update newContent and recompute diff lines on editDiff', async () => {
    const promise = stageTestDiff({
      oldContent: 'const x = 1;',
      newContent: 'const x = 2;',
    });

    const { pendingDiffs, editDiff, acceptDiff } = useDiffReviewStore.getState();
    const id = pendingDiffs[0].id;

    // User edits the proposed content
    editDiff(id, 'const x = 99; // manually corrected');

    const updated = useDiffReviewStore.getState().pendingDiffs[0];
    expect(updated.newContent).toBe('const x = 99; // manually corrected');

    // Diff should reflect the user's edit
    const added = updated.lines.filter(l => l.kind === 'added');
    expect(added.some(l => l.content.includes('99'))).toBe(true);

    await acceptDiff(id);
    await promise;
  });
});

// ── Multiple diffs ────────────────────────────────────────────────────────────

describe('Diff Review — Multiple Diffs', () => {
  it('should handle staging and accepting multiple diffs independently', async () => {
    const p1 = stageTestDiff({ path: 'a.ts', oldContent: 'a', newContent: 'b' });
    const p2 = stageTestDiff({ path: 'b.ts', oldContent: 'c', newContent: 'd' });

    const { pendingDiffs, acceptDiff, rejectDiff } = useDiffReviewStore.getState();
    expect(pendingDiffs).toHaveLength(2);

    await acceptDiff(pendingDiffs[0].id);
    rejectDiff(useDiffReviewStore.getState().pendingDiffs[0].id);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(true);
    expect(r2).toBe(false);

    const state = useDiffReviewStore.getState();
    expect(state.pendingDiffs).toHaveLength(0);
    expect(state.resolvedDiffs).toHaveLength(2);
  });
});
