import React, { useEffect, useState, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { platformToolBroker } from '../../core/ai/tools/ToolBroker';

const MonacoDiffEditor = lazy(() => import('@monaco-editor/react').then(mod => ({ default: mod.DiffEditor })));

export const AgentApprovalOverlay: React.FC = () => {
  const [pendingRequest, setPendingRequest] = useState<{
    toolName: string;
    details: any;
    resolve: (approved: boolean) => void;
  } | null>(null);

  const [originalContent, setOriginalContent] = useState<string | null>(null);
  const [isFetchingDiff, setIsFetchingDiff] = useState(false);

  useEffect(() => {
    platformToolBroker.onRequestApproval = (toolName: string, details: any) => {
      return new Promise((resolve) => {
        setPendingRequest({ toolName, details, resolve });
      });
    };
    return () => {
      platformToolBroker.onRequestApproval = undefined;
    };
  }, []);

  useEffect(() => {
    if (pendingRequest?.toolName === 'fs_write' && pendingRequest.details?.path) {
      setIsFetchingDiff(true);
      invoke<string>('fs_read_file', { path: pendingRequest.details.path })
        .then(content => {
          setOriginalContent(content);
          setIsFetchingDiff(false);
        })
        .catch(() => {
          // File probably doesn't exist, this is a create operation
          setOriginalContent('');
          setIsFetchingDiff(false);
        });
    } else {
      setOriginalContent(null);
    }
  }, [pendingRequest]);

  if (!pendingRequest) return null;

  const handleApprove = () => {
    pendingRequest.resolve(true);
    setPendingRequest(null);
  };

  const handleReject = () => {
    pendingRequest.resolve(false);
    setPendingRequest(null);
  };

  const isFsWrite = pendingRequest.toolName === 'fs_write';

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto">
      <div className={`${isFsWrite ? 'w-[90vw] h-[90vh]' : 'w-[500px]'} bg-surface-container-high border border-primary/30 rounded-xl shadow-[0_16px_64px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 transition-all`}>
        
        {/* Header */}
        <div className={`p-md border-b flex items-center gap-sm ${isFsWrite ? 'bg-primary/10 border-primary/20' : 'bg-error/10 border-error/20'}`}>
          <span className={`material-symbols-outlined text-2xl ${isFsWrite ? 'text-primary' : 'text-error'}`}>
            {isFsWrite ? 'difference' : 'security'}
          </span>
          <div>
            <h3 className="text-title-md font-bold text-on-surface">
              {isFsWrite ? 'Code Artifact Proposal' : 'Agent Action Requires Approval'}
            </h3>
            <p className={`text-body-sm ${isFsWrite ? 'text-primary/80' : 'text-error/80'}`}>
              {isFsWrite ? `Review changes for ${pendingRequest.details.path}` : 'An AI Agent has requested a sensitive operation.'}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-hidden flex flex-col p-md space-y-md">
          {isFsWrite ? (
            <div className="flex-1 border border-outline-variant rounded overflow-hidden relative">
              {isFetchingDiff ? (
                <div className="absolute inset-0 flex items-center justify-center text-secondary-fixed-dim">
                  <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
                </div>
              ) : (
                <Suspense fallback={<div className="p-4">Loading diff editor...</div>}>
                  <MonacoDiffEditor
                    theme="vs-dark"
                    original={originalContent || ''}
                    modified={pendingRequest.details.content || ''}
                    language={pendingRequest.details.path?.split('.').pop() || 'plaintext'}
                    options={{ readOnly: true, renderSideBySide: true, minimap: { enabled: false } }}
                  />
                </Suspense>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-label-caps text-outline uppercase tracking-widest">Requested Tool</label>
                <div className="text-body-lg text-secondary-fixed-dim font-code-md mt-xs">
                  {pendingRequest.toolName}
                </div>
              </div>
              
              <div>
                <label className="text-[10px] font-label-caps text-outline uppercase tracking-widest">Execution Parameters</label>
                <pre className="bg-surface-container-lowest border border-outline-variant rounded p-sm mt-xs overflow-auto max-h-48 text-[11px] font-code-md text-on-surface-variant">
                  <code>{JSON.stringify(pendingRequest.details, null, 2)}</code>
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-md bg-surface-container-highest border-t border-outline-variant flex justify-end gap-sm">
          <button 
            onClick={handleReject}
            className="px-lg py-sm rounded hover:bg-surface-container-low text-on-surface transition-colors"
          >
            Reject
          </button>
          <button 
            onClick={handleApprove}
            className={`px-lg py-sm rounded text-on-error hover:opacity-90 font-bold transition-opacity shadow-sm ${isFsWrite ? 'bg-primary' : 'bg-error'}`}
          >
            {isFsWrite ? 'Approve & Write' : 'Allow Execution'}
          </button>
        </div>
      </div>
    </div>
  );
};
