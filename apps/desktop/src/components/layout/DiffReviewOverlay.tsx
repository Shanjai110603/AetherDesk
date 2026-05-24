import React, { useState } from 'react';
import { useDiffReviewStore } from '../../core/store/useDiffReviewStore';
import Editor from '@monaco-editor/react';

const getMonacoLanguage = (path: string) => {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': case 'tsx': return 'typescript';
    case 'js': case 'jsx': return 'javascript';
    case 'py': return 'python';
    case 'rs': return 'rust';
    case 'md': return 'markdown';
    case 'json': return 'json';
    case 'css': return 'css';
    case 'html': return 'html';
    case 'yml': case 'yaml': return 'yaml';
    case 'sh': return 'shell';
    default: return 'plaintext';
  }
};

export const DiffReviewOverlay: React.FC = () => {
  const { pendingDiffs, acceptDiff, rejectDiff, editDiff } = useDiffReviewStore();
  const [expandedDiffs, setExpandedDiffs] = useState<Set<string>>(new Set());
  const [editingDiffs, setEditingDiffs] = useState<Record<string, string>>({});

  if (pendingDiffs.length === 0) return null;

  const toggleExpand = (id: string) => {
    setExpandedDiffs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAcceptAll = async () => {
    for (const diff of pendingDiffs) {
      await acceptDiff(diff.id);
    }
  };

  const handleRejectAll = () => {
    for (const diff of pendingDiffs) {
      rejectDiff(diff.id);
    }
  };

  const startEdit = (id: string, newContent: string) => {
    setEditingDiffs(prev => ({ ...prev, [id]: newContent }));
    setExpandedDiffs(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const cancelEdit = (id: string) => {
    setEditingDiffs(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveEdit = (id: string) => {
    const newContent = editingDiffs[id];
    if (newContent !== undefined) {
      editDiff(id, newContent);
      cancelEdit(id);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-background/80 backdrop-blur-sm flex items-center justify-center p-xl">
      <div className="bg-surface border border-outline-variant shadow-elevation-3 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="p-lg border-b border-outline-variant flex items-center justify-between bg-surface-container flex-shrink-0">
          <div>
            <h2 className="text-xl font-heading text-on-surface">Review AI Changes</h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Agents have proposed {pendingDiffs.length} file modification{pendingDiffs.length > 1 ? 's' : ''}.
            </p>
          </div>
          <div className="flex gap-md">
            <button
              onClick={handleRejectAll}
              className="px-md py-sm rounded border border-outline-variant text-on-surface hover:bg-surface-variant hover:text-error transition-colors"
            >
              Reject All
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-md py-sm rounded bg-primary text-on-primary hover:bg-primary-hover shadow-elevation-1 transition-colors font-medium flex items-center gap-sm"
            >
              <span className="material-symbols-outlined text-sm">check</span>
              Accept All
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-lg space-y-lg">
          {pendingDiffs.map(diff => {
            const isEditing = editingDiffs[diff.id] !== undefined;

            return (
              <div key={diff.id} className="border border-outline-variant rounded-lg overflow-hidden bg-surface flex flex-col max-h-[60vh]">
                {/* Header */}
                <div 
                  className="bg-surface-container-high px-md py-sm flex items-center justify-between cursor-pointer hover:bg-surface-variant transition-colors flex-shrink-0"
                  onClick={() => !isEditing && toggleExpand(diff.id)}
                >
                  <div className="flex items-center gap-md">
                    <span className="material-symbols-outlined text-on-surface-variant">
                      {expandedDiffs.has(diff.id) ? 'expand_more' : 'chevron_right'}
                    </span>
                    <span className="font-code text-sm text-on-surface">{diff.path}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant border border-outline-variant">
                      {diff.language}
                    </span>
                  </div>
                  <div className="flex items-center gap-lg">
                    <span className="text-sm text-on-surface-variant">{diff.summary}</span>
                    <div className="flex gap-xs" onClick={e => e.stopPropagation()}>
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(diff.id, diff.newContent)}
                          className="p-1 rounded hover:bg-primary/10 hover:text-primary text-on-surface-variant transition-colors"
                          title="Edit before accept"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                      )}
                      <button
                        onClick={() => rejectDiff(diff.id)}
                        className="p-1 rounded hover:bg-error/10 hover:text-error text-on-surface-variant transition-colors"
                        title="Reject"
                        disabled={isEditing}
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                      <button
                        onClick={() => acceptDiff(diff.id)}
                        className="p-1 rounded hover:bg-primary/10 hover:text-primary text-on-surface-variant transition-colors"
                        title="Accept"
                        disabled={isEditing}
                      >
                        <span className="material-symbols-outlined text-sm">check</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Diff Content / Edit Content */}
                {expandedDiffs.has(diff.id) && (
                  <div className="flex-1 flex flex-col min-h-[300px] bg-[#1e1e1e] overflow-hidden">
                    {isEditing ? (
                      <div className="flex flex-col h-full w-full">
                        <div className="flex-1 min-h-[300px]">
                          <Editor
                            height="100%"
                            language={getMonacoLanguage(diff.path)}
                            theme="vs-dark"
                            value={editingDiffs[diff.id]}
                            onChange={(val) => setEditingDiffs(prev => ({ ...prev, [diff.id]: val ?? '' }))}
                            options={{
                              minimap: { enabled: false },
                              fontSize: 13,
                              fontFamily: 'JetBrains Mono, monospace',
                              padding: { top: 16 },
                              scrollBeyondLastLine: false,
                            }}
                          />
                        </div>
                        <div className="bg-surface-container px-md py-sm flex justify-end gap-md border-t border-outline-variant">
                          <button
                            onClick={() => cancelEdit(diff.id)}
                            className="px-md py-sm rounded border border-outline-variant text-on-surface hover:bg-surface-variant transition-colors text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(diff.id)}
                            className="px-md py-sm rounded bg-primary text-on-primary hover:bg-primary-hover shadow-elevation-1 transition-colors font-medium text-sm"
                          >
                            Update & Re-evaluate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="font-code text-sm overflow-auto h-full">
                        <table className="w-full border-collapse text-left whitespace-pre">
                          <tbody className="divide-y divide-[#333]">
                            {diff.lines.map((line, idx) => (
                              <tr 
                                key={idx}
                                className={`
                                  ${line.kind === 'added' ? 'bg-[#1e3a29] text-[#4ade80]' : ''}
                                  ${line.kind === 'removed' ? 'bg-[#402020] text-[#f87171]' : ''}
                                  ${line.kind === 'unchanged' ? 'text-[#a3a3a3]' : ''}
                                `}
                              >
                                <td className="w-12 px-2 py-1 text-right text-[#666] border-r border-[#333] select-none text-xs">
                                  {line.lineNo ?? ''}
                                </td>
                                <td className="w-12 px-2 py-1 text-right text-[#666] border-r border-[#333] select-none text-xs">
                                  {line.newLineNo ?? ''}
                                </td>
                                <td className="w-6 text-center select-none opacity-50">
                                  {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
                                </td>
                                <td className="px-4 py-1">
                                  {line.content || ' '}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
