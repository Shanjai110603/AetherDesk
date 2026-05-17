import React from 'react';
import { useAiStore } from '../../core/store/useAiStore';
import { useRuntimeStore } from '../../core/store/useRuntimeStore';
import { useWorkflowStore } from '../../core/store/useWorkflowStore';

interface StatusItem {
  icon: string;
  label: string;
  color?: string;
}

export const BottomNavBar: React.FC = () => {
  const { activeModelId, isStreaming, lastTelemetry } = useAiStore();
  const { status: runtimeStatus } = useRuntimeStore();
  const { isExecuting: workflowExecuting } = useWorkflowStore();

  const getSystemStatus = () => {
    if (workflowExecuting) return 'Workflow Running';
    if (isStreaming) return 'AI Streaming';
    if (runtimeStatus === 'running') return 'Runtime Active';
    return 'System: Ready';
  };

  const getDotColor = () => {
    if (workflowExecuting) return 'bg-secondary';
    if (isStreaming) return 'bg-primary shadow-[0_0_6px_rgba(192,193,255,0.5)]';
    if (runtimeStatus === 'running') return 'bg-tertiary';
    return 'bg-secondary-fixed-dim shadow-[0_0_6px_rgba(47,217,244,0.3)]';
  };

  const getStatusColor = () => {
    if (workflowExecuting) return 'text-secondary';
    if (isStreaming) return 'text-primary';
    if (runtimeStatus === 'running') return 'text-tertiary';
    return 'text-secondary-fixed-dim';
  };

  const leftItems: StatusItem[] = [
    { icon: 'account_tree', label: 'main*', color: 'text-secondary-fixed-dim' },
    { icon: 'psychology', label: activeModelId || 'No Model', color: 'text-outline-variant' },
    { icon: 'monitoring', label: lastTelemetry?.tokens_per_sec ? `${lastTelemetry.tokens_per_sec.toFixed(1)} t/s` : '0.0 t/s', color: 'text-outline-variant' },
    { icon: 'memory', label: runtimeStatus === 'running' ? 'Active Runtime' : 'Idle', color: 'text-outline-variant' },
  ];

  return (
    <footer className="bg-surface-container-lowest w-full flex items-center h-[22px] border-t border-outline-variant select-none flex-shrink-0 z-50 overflow-hidden">
      {leftItems.map((item, i) => (
        <React.Fragment key={item.label}>
          <div className={`flex items-center gap-1 px-2 font-code-md text-[11px] cursor-pointer hover:bg-surface-container-high h-full transition-colors ${item.color || 'text-outline'}`}>
            <span className="material-symbols-outlined text-[12px]">{item.icon}</span>
            <span className="truncate max-w-[120px]">{item.label}</span>
          </div>
          {i < leftItems.length - 1 && (
            <span className="w-px h-3 bg-outline-variant flex-shrink-0" />
          )}
        </React.Fragment>
      ))}

      <div className="flex-1" />

      {/* Status indicator */}
      <div className={`flex items-center gap-1 px-2 font-code-md text-[11px] h-full cursor-pointer hover:bg-surface-container-high transition-colors ${getStatusColor()}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getDotColor()} ${(isStreaming || workflowExecuting) ? 'animate-pulse' : ''}`} />
        <span>{getSystemStatus()}</span>
      </div>
    </footer>
  );
};
