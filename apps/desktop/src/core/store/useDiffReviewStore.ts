import { create } from 'zustand';
import { useTelemetryStore } from './useTelemetryStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiffLineKind = 'added' | 'removed' | 'unchanged' | 'header';

export interface DiffLine {
  kind: DiffLineKind;
  lineNo: number | null;  // null for added lines without old line number
  newLineNo: number | null;
  content: string;
}

export interface FileDiff {
  id: string;
  path: string;
  language: string;
  oldContent: string;
  newContent: string;
  lines: DiffLine[];   // Computed diff
  summary: string;     // AI-generated description of change
  agentId?: string;
  sessionId?: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected';
}

interface DiffReviewState {
  pendingDiffs: FileDiff[];
  resolvedDiffs: FileDiff[];

  // Actions
  stageDiff: (diff: Omit<FileDiff, 'id' | 'lines' | 'status' | 'timestamp'>) => Promise<boolean>;
  editDiff: (id: string, newContent: string) => void;
  acceptDiff: (id: string) => Promise<void>;
  rejectDiff: (id: string) => void;
  dismissResolved: () => void;
}

// ── Diff Computation ──────────────────────────────────────────────────────────

function computeDiffLines(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (
      lcsIdx < lcs.length &&
      oldIdx < oldLines.length &&
      newIdx < newLines.length &&
      oldLines[oldIdx] === lcs[lcsIdx] &&
      newLines[newIdx] === lcs[lcsIdx]
    ) {
      result.push({ kind: 'unchanged', lineNo: oldIdx + 1, newLineNo: newIdx + 1, content: oldLines[oldIdx] });
      oldIdx++; newIdx++; lcsIdx++;
    } else if (newIdx < newLines.length && (lcsIdx >= lcs.length || newLines[newIdx] !== lcs[lcsIdx])) {
      result.push({ kind: 'added', lineNo: null, newLineNo: newIdx + 1, content: newLines[newIdx] });
      newIdx++;
    } else if (oldIdx < oldLines.length) {
      result.push({ kind: 'removed', lineNo: oldIdx + 1, newLineNo: null, content: oldLines[oldIdx] });
      oldIdx++;
    }
  }

  return result;
}

function computeLCS(a: string[], b: string[]): string[] {
  // Limit to first 500 lines for performance
  const maxLen = 500;
  const A = a.slice(0, maxLen);
  const B = b.slice(0, maxLen);
  const m = A.length, n = B.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (A[i - 1] === B[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (A[i - 1] === B[j - 1]) { lcs.unshift(A[i - 1]); i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  return lcs;
}

export function pathToLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript/React', js: 'JavaScript', jsx: 'JavaScript/React',
    rs: 'Rust', py: 'Python', go: 'Go', md: 'Markdown', json: 'JSON',
    css: 'CSS', html: 'HTML', toml: 'TOML', yaml: 'YAML', sh: 'Shell',
  };
  return map[ext] || ext.toUpperCase() || 'Text';
}

function generateSummary(oldContent: string, newContent: string, path: string): string {
  const oldLines = oldContent.split('\n').length;
  const newLines = newContent.split('\n').length;
  const delta = newLines - oldLines;
  const sign = delta >= 0 ? `+${delta}` : `${delta}`;
  const filename = path.split(/[\\/]/).pop() ?? path;
  if (!oldContent) return `New file: ${filename} (${newLines} lines)`;
  if (!newContent) return `Delete file: ${filename}`;
  return `Modify ${filename} (${sign} lines, ${oldLines} → ${newLines})`;
}

// ── Persistent resolve callback map ──────────────────────────────────────────
// Maps diff ID to its Promise resolve function so the staging caller can await.
const pendingResolvers = new Map<string, (accepted: boolean) => void>();

// ── Store ─────────────────────────────────────────────────────────────────────

export const useDiffReviewStore = create<DiffReviewState>((set) => ({
  pendingDiffs: [],
  resolvedDiffs: [],

  stageDiff: async (rawDiff) => {
    const id = `diff-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const lines = computeDiffLines(rawDiff.oldContent, rawDiff.newContent);
    const summary = rawDiff.summary || generateSummary(rawDiff.oldContent, rawDiff.newContent, rawDiff.path);
    const language = pathToLanguage(rawDiff.path);

    const diff: FileDiff = {
      ...rawDiff,
      id,
      lines,
      language,
      summary,
      status: 'pending',
      timestamp: Date.now(),
    };

    set(state => ({ pendingDiffs: [...state.pendingDiffs, diff] }));

    // Return a Promise that resolves when user accepts or rejects
    return new Promise<boolean>(resolve => {
      pendingResolvers.set(id, resolve);
    });
  },

  editDiff: (id, newContent) => {
    set(state => {
      const diffIndex = state.pendingDiffs.findIndex(d => d.id === id);
      if (diffIndex === -1) return state;

      const diff = state.pendingDiffs[diffIndex];
      const lines = computeDiffLines(diff.oldContent, newContent);
      const summary = generateSummary(diff.oldContent, newContent, diff.path);
      
      const updatedDiff: FileDiff = { ...diff, newContent, lines, summary };
      
      const nextPending = [...state.pendingDiffs];
      nextPending[diffIndex] = updatedDiff;

      return { pendingDiffs: nextPending };
    });
  },

  acceptDiff: async (id) => {
    set(state => {
      const pending = state.pendingDiffs.find(d => d.id === id)!;
      const resolved: FileDiff = { ...pending, status: 'accepted' };
      
      const latencyMs = Date.now() - pending.timestamp;
      useTelemetryStore.getState().logEvent('diff_review', { 
        action: 'accepted', 
        path: pending.path, 
        language: pending.language 
      }, latencyMs);

      return {
        pendingDiffs: state.pendingDiffs.filter(d => d.id !== id),
        resolvedDiffs: [...state.resolvedDiffs, resolved].slice(-20),
      };
    });
    pendingResolvers.get(id)?.(true);
    pendingResolvers.delete(id);
  },

  rejectDiff: (id) => {
    set(state => {
      const pending = state.pendingDiffs.find(d => d.id === id)!;
      const resolved: FileDiff = { ...pending, status: 'rejected' };

      const latencyMs = Date.now() - pending.timestamp;
      useTelemetryStore.getState().logEvent('diff_review', { 
        action: 'rejected', 
        path: pending.path, 
        language: pending.language 
      }, latencyMs);

      return {
        pendingDiffs: state.pendingDiffs.filter(d => d.id !== id),
        resolvedDiffs: [...state.resolvedDiffs, resolved].slice(-20),
      };
    });
    pendingResolvers.get(id)?.(false);
    pendingResolvers.delete(id);
  },

  dismissResolved: () => set({ resolvedDiffs: [] }),
}));
