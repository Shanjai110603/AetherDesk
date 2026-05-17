import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  useWorkflowStore,
  setupWorkflowEvents,
  NODE_LIBRARY,
  CATEGORY_LABELS,
} from '../../core/store/useWorkflowStore';
import type {
  WorkflowNode,
  WorkflowEdge,
  NodeTemplate,
  NodeCategory,
  EdgeCondition,
} from '../../core/store/useWorkflowStore';
import { useAiStore } from '../../core/store/useAiStore';
import { useAgentLoop } from '../../core/ai/useAgentLoop';

// ── SVG Edge Component ───────────────────────────────────────────────────────

const EdgePath: React.FC<{
  edge: WorkflowEdge;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ edge, sourceNode, targetNode, isSelected, onSelect }) => {
  // Calculate port positions
  const sourcePortIdx = sourceNode.ports.filter(p => p.type === 'output').findIndex(p => p.id === edge.sourcePortId);
  const sx = sourceNode.x + sourceNode.width;
  const sy = sourceNode.y + 50 + sourcePortIdx * 30;

  const tx = targetNode.x;
  const ty = targetNode.y + 50;

  // Bezier control points
  const dx = Math.abs(tx - sx) * 0.5;
  const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;

  // Condition-based coloring
  const conditionColor = edge.condition === 'error' ? '#f44336' 
    : edge.condition === 'success' ? '#4caf50' 
    : '#2fd9f4';

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  return (
    <g>
      {/* Glow layer for flowing edges */}
      {edge.isFlowing && (
        <path
          d={path}
          fill="transparent"
          stroke={conditionColor}
          strokeWidth={6}
          opacity={0.15}
          style={{ filter: `drop-shadow(0 0 6px ${conditionColor})` }}
        />
      )}
      {/* Main edge */}
      <path
        d={path}
        fill="transparent"
        stroke={edge.isFlowing ? conditionColor : edge.active ? conditionColor : '#908fa0'}
        strokeWidth={isSelected ? 3 : 2}
        strokeDasharray={edge.isFlowing ? '8 4' : edge.active ? undefined : '6 3'}
        opacity={edge.active || edge.isFlowing ? 1 : 0.35}
        className="cursor-pointer"
        style={{ 
          transition: 'stroke 0.3s, opacity 0.3s',
          animation: edge.isFlowing ? 'edgeFlow 0.6s linear infinite' : undefined,
        }}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      />
      {/* Condition label */}
      {edge.condition !== 'always' && (
        <g transform={`translate(${midX - 20}, ${midY - 8})`}>
          <rect
            x={0} y={0} width={40} height={16} rx={4}
            fill={edge.condition === 'error' ? 'rgba(244,67,54,0.15)' : 'rgba(76,175,80,0.15)'}
            stroke={edge.condition === 'error' ? 'rgba(244,67,54,0.4)' : 'rgba(76,175,80,0.4)'}
            strokeWidth={1}
          />
          <text
            x={20} y={12}
            textAnchor="middle"
            fill={edge.condition === 'error' ? '#f44336' : '#4caf50'}
            fontSize={8}
            fontWeight={700}
            fontFamily="monospace"
          >
            {edge.condition.toUpperCase()}
          </text>
        </g>
      )}
    </g>
  );
};

// ── SVG Dragging Edge Component ──────────────────────────────────────────────

const DraggingEdgePath: React.FC<{
  sourceNode: WorkflowNode;
  sourcePortId: string;
  cursorX: number;
  cursorY: number;
}> = ({ sourceNode, sourcePortId, cursorX, cursorY }) => {
  const sourcePortIdx = sourceNode.ports.filter(p => p.type === 'output').findIndex(p => p.id === sourcePortId);
  const sx = sourceNode.x + sourceNode.width;
  const sy = sourceNode.y + 50 + sourcePortIdx * 30;

  const dx = Math.abs(cursorX - sx) * 0.5;
  const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${cursorX - dx} ${cursorY}, ${cursorX} ${cursorY}`;

  return (
    <path
      d={path}
      fill="transparent"
      stroke="#2fd9f4"
      strokeWidth={2}
      strokeDasharray="6 3"
      opacity={0.8}
    />
  );
};

// ── Draggable Node Component ─────────────────────────────────────────────────

const CanvasNode: React.FC<{
  node: WorkflowNode;
  isSelected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onPortMouseDown: (portId: string, e: React.MouseEvent) => void;
  onPortMouseUp: (portId: string, e: React.MouseEvent) => void;
  zoom: number;
}> = ({ node, isSelected, onSelect, onMove, onPortMouseDown, onPortMouseUp, zoom }) => {
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const nodeStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    nodeStart.current = { x: node.x, y: node.y };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = (ev.clientX - dragStart.current.x) / zoom;
      const dy = (ev.clientY - dragStart.current.y) / zoom;
      onMove(nodeStart.current.x + dx, nodeStart.current.y + dy);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const headerBg = {
    trigger: 'bg-secondary-fixed-dim/10',
    ai: 'bg-primary/20',
    execution: 'bg-tertiary/20',
    integration: 'bg-secondary/10',
    logic: 'bg-error/10',
  }[node.category] || 'bg-surface-container-high';

  const inputPorts = node.ports.filter(p => p.type === 'input');
  const outputPorts = node.ports.filter(p => p.type === 'output');

  return (
    <div
      className={`absolute select-none cursor-grab active:cursor-grabbing transition-shadow duration-150 ${
        isSelected ? 'z-20' : 'z-10'
      }`}
      style={{ left: node.x, top: node.y, width: node.width }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`bg-surface-container-highest rounded-lg overflow-hidden ${
          node.status === 'running'
            ? 'border-2 border-secondary shadow-[0_0_24px_rgba(47,217,244,0.3)]'
            : node.status === 'success'
            ? 'border-2 border-[#4caf50] shadow-[0_0_16px_rgba(76,175,80,0.2)]'
            : node.status === 'error'
            ? 'border-2 border-error shadow-[0_0_16px_rgba(244,67,54,0.2)]'
            : isSelected
            ? 'border-2 border-secondary-fixed-dim shadow-[0_0_20px_rgba(47,217,244,0.15)]'
            : 'border border-outline-variant shadow-[0_0_15px_rgba(47,217,244,0.06)]'
        }`}
        style={{
          transition: 'border-color 0.3s, box-shadow 0.3s',
          animation: node.status === 'running' ? 'nodePulse 1.5s ease-in-out infinite' : undefined,
        }}
      >
        {/* Header */}
        <div className={`${headerBg} border-b border-outline-variant p-sm flex items-center justify-between`}>
          <div className="flex items-center gap-sm">
            <span className={`material-symbols-outlined text-[16px] ${node.iconColor}`}>{node.icon}</span>
            <span className="text-label-caps text-on-surface font-semibold">{node.label}</span>
          </div>
          {node.status === 'running' && (
            <span className="material-symbols-outlined text-[14px] text-secondary animate-spin" title="Running">sync</span>
          )}
          {node.status === 'success' && (
            <span className="material-symbols-outlined text-[14px] text-[#4caf50]" title="Completed" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          )}
          {node.status === 'error' && (
            <span className="material-symbols-outlined text-[14px] text-error" title="Error" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
          )}
          {isSelected && !node.status && (
            <span className="material-symbols-outlined text-[14px] text-outline">touch_app</span>
          )}
        </div>

        {/* Body */}
        <div className="p-md space-y-xs">
          {node.type === 'ai_action' ? (
            <div className="text-[10px] font-code-md text-outline">
              <div className="mb-xs truncate">
                model: <span className="text-secondary">{node.config.model || 'llama3:8b'}</span>
              </div>
              {node.config.prompt && (
                <div className="bg-surface-dim p-sm rounded text-on-surface-variant border border-outline-variant/30 line-clamp-2 leading-relaxed text-[11px] mb-xs">
                  {node.config.prompt}
                </div>
              )}
              {node.output && (
                <div className="bg-secondary/10 p-sm rounded text-secondary border border-secondary/30 line-clamp-3 leading-relaxed text-[11px]">
                  <span className="font-bold block mb-1">OUTPUT:</span>
                  {node.output}
                </div>
              )}
            </div>
          ) : (
            Object.entries(node.config).map(([key, value]) => (
              <div key={key} className="text-[10px] font-code-md text-outline truncate">
                <span>{key}: <span className="text-on-surface-variant">{value}</span></span>
              </div>
            ))
          )}
          {node.type !== 'ai_action' && node.output && (
            <div className="text-[10px] font-code-md mt-sm bg-surface-dim p-sm rounded text-primary border border-outline-variant/30 line-clamp-2">
              OUT: {node.output}
            </div>
          )}
        </div>
      </div>

      {/* Input Ports (left side) */}
      {inputPorts.map((port, i) => (
        <div
          key={port.id}
          className="absolute w-2.5 h-2.5 rounded-full border-2 border-surface-dim bg-secondary-fixed-dim hover:scale-150 transition-transform cursor-crosshair"
          style={{ left: -5, top: 50 + i * 30 }}
          title={port.label}
          onMouseUp={(e) => onPortMouseUp(port.id, e)}
        />
      ))}

      {/* Output Ports (right side) */}
      {outputPorts.map((port, i) => (
        <div
          key={port.id}
          className={`absolute w-2.5 h-2.5 rounded-full border-2 border-surface-dim hover:scale-150 transition-transform cursor-crosshair ${
            port.id === 'err' ? 'bg-outline' : 'bg-secondary-fixed-dim'
          }`}
          style={{ right: -5, top: 50 + i * 30 }}
          title={port.label}
          onMouseDown={(e) => onPortMouseDown(port.id, e)}
        />
      ))}
    </div>
  );
};

// ── Node Library Sidebar ─────────────────────────────────────────────────────

const NodeLibrary: React.FC<{ onDragTemplate: (t: NodeTemplate) => void }> = ({ onDragTemplate }) => {
  const grouped = NODE_LIBRARY.reduce<Record<NodeCategory, NodeTemplate[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {} as Record<NodeCategory, NodeTemplate[]>);

  return (
    <div className="w-64 bg-surface-container border-r border-outline-variant flex flex-col flex-shrink-0">
      <div className="p-md border-b border-outline-variant">
        <span className="text-label-caps text-on-surface-variant uppercase tracking-widest font-bold">Node Library</span>
      </div>
      <div className="flex-1 overflow-y-auto p-sm space-y-md">
        {(Object.entries(grouped) as [NodeCategory, NodeTemplate[]][]).map(([category, templates]) => (
          <div key={category}>
            <span className="text-[10px] font-label-caps text-outline px-sm uppercase tracking-wider">{CATEGORY_LABELS[category]}</span>
            <div className="mt-xs space-y-xs">
              {templates.map(t => (
                <button
                  key={t.type}
                  onClick={() => onDragTemplate(t)}
                  className="w-full p-sm bg-surface-container-high border border-outline-variant rounded flex items-center gap-sm cursor-pointer hover:border-secondary-fixed-dim active:scale-95 transition-all text-left"
                >
                  <span className={`material-symbols-outlined text-[16px] ${t.iconColor}`}>{t.icon}</span>
                  <span className="text-body-sm">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Node Inspector Panel ─────────────────────────────────────────────────────

const NodeInspector: React.FC = () => {
  const { nodes, edges, selectedNodeId, selectedEdgeId, updateNodeConfig, removeNode, updateEdgeCondition } = useWorkflowStore();
  const { models } = useAiStore();
  const node = nodes.find(n => n.id === selectedNodeId);
  
  const { startAutonomousLoop } = useAgentLoop();
  const [loopState, setLoopState] = useState({
    status: 'idle',
    currentStep: 0,
    logs: [] as string[]
  });

  const selectedEdge = selectedEdgeId ? edges.find(e => e.id === selectedEdgeId) : null;

  // If an edge is selected, show the edge inspector
  if (!node && selectedEdge) {
    const sourceNode = nodes.find(n => n.id === selectedEdge.sourceNodeId);
    const targetNode = nodes.find(n => n.id === selectedEdge.targetNodeId);
    return (
      <div className="w-80 bg-surface-container border-l border-outline-variant flex flex-col flex-shrink-0">
        <div className="p-md border-b border-outline-variant">
          <span className="text-label-caps text-on-surface-variant uppercase tracking-widest font-bold">Edge Inspector</span>
        </div>
        <div className="flex-1 overflow-y-auto p-md space-y-lg">
          {/* Connection Info */}
          <div className="space-y-sm">
            <label className="text-[10px] font-label-caps text-outline uppercase">Connection</label>
            <div className="p-md bg-surface-container-high rounded border border-outline-variant/50 space-y-xs">
              <div className="flex items-center gap-sm text-body-sm">
                <span className="material-symbols-outlined text-[14px] text-secondary">output</span>
                <span className="text-on-surface font-semibold">{sourceNode?.label || 'Unknown'}</span>
                <span className="text-outline text-[10px] font-mono">:{selectedEdge.sourcePortId}</span>
              </div>
              <div className="flex items-center gap-sm text-outline pl-[22px]">
                <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
              </div>
              <div className="flex items-center gap-sm text-body-sm">
                <span className="material-symbols-outlined text-[14px] text-primary">input</span>
                <span className="text-on-surface font-semibold">{targetNode?.label || 'Unknown'}</span>
                <span className="text-outline text-[10px] font-mono">:{selectedEdge.targetPortId}</span>
              </div>
            </div>
          </div>

          {/* Condition Selector */}
          <div className="space-y-sm">
            <label className="text-[10px] font-label-caps text-outline uppercase">Routing Condition</label>
            <div className="space-y-xs">
              {(['always', 'success', 'error'] as EdgeCondition[]).map(cond => {
                const isActive = selectedEdge.condition === cond;
                const colors = cond === 'error' 
                  ? { bg: 'bg-error/10', border: 'border-error/40', text: 'text-error', icon: 'error' }
                  : cond === 'success'
                  ? { bg: 'bg-[#4caf50]/10', border: 'border-[#4caf50]/40', text: 'text-[#4caf50]', icon: 'check_circle' }
                  : { bg: 'bg-secondary/10', border: 'border-secondary/40', text: 'text-secondary', icon: 'route' };
                return (
                  <button
                    key={cond}
                    onClick={() => updateEdgeCondition(selectedEdge.id, cond)}
                    className={`w-full flex items-center gap-sm p-sm rounded border transition-all ${
                      isActive ? `${colors.bg} ${colors.border} ${colors.text}` : 'bg-surface-container-high border-outline-variant/30 text-outline hover:bg-surface-container-highest'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{colors.icon}</span>
                    <span className="text-label-caps font-bold uppercase">{cond}</span>
                    {isActive && <span className="material-symbols-outlined text-[14px] ml-auto">check</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-outline leading-relaxed">
              Controls when data flows through this edge. <strong>Always</strong> fires unconditionally. <strong>Success</strong> fires only when the source node completes. <strong>Error</strong> fires only on failure.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="w-80 bg-surface-container border-l border-outline-variant flex flex-col flex-shrink-0">
        <div className="p-md border-b border-outline-variant">
          <span className="text-label-caps text-on-surface-variant uppercase tracking-widest font-bold">Inspector</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-center p-md">
          <div>
            <span className="material-symbols-outlined text-3xl text-outline block mb-sm">touch_app</span>
            <p className="text-body-sm text-outline">Select a node or edge to inspect</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-surface-container border-l border-outline-variant flex flex-col flex-shrink-0">
      <div className="p-md border-b border-outline-variant flex justify-between items-center">
        <span className="text-label-caps text-on-surface-variant uppercase tracking-widest font-bold">Node Inspector</span>
        <span className="material-symbols-outlined text-outline text-[16px]">info</span>
      </div>
      <div className="flex-1 overflow-y-auto p-md space-y-lg">
        {/* Active Selection */}
        <div className="space-y-sm">
          <label className="text-[10px] font-label-caps text-outline uppercase">Active Selection</label>
          <div className="p-md bg-surface-container-high rounded border border-secondary-fixed-dim/30">
            <div className="flex items-center gap-md mb-sm">
              <div className={`w-10 h-10 rounded flex items-center justify-center ${
                node.category === 'ai' ? 'bg-primary/20 text-primary' :
                node.category === 'trigger' ? 'bg-secondary-fixed-dim/20 text-secondary-fixed-dim' :
                node.category === 'execution' ? 'bg-tertiary/20 text-tertiary' :
                'bg-secondary/20 text-secondary'
              }`}>
                <span className="material-symbols-outlined">{node.icon}</span>
              </div>
              <div>
                <div className="text-body-base font-bold text-on-surface">{node.label}</div>
                <div className="text-[10px] font-code-md text-outline">ID: {node.id}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-sm">
          <label className="text-[10px] font-label-caps text-outline uppercase flex justify-between items-center">
            Configuration
            <button
              onClick={() => {
                const defaults = NODE_LIBRARY.find(t => t.type === node.type);
                if (defaults) Object.entries(defaults.defaultConfig).forEach(([k, v]) => updateNodeConfig(node.id, k, v));
              }}
              className="text-secondary hover:text-secondary-fixed-dim uppercase text-[9px] font-bold cursor-pointer"
            >Reset</button>
          </label>
          <div className="space-y-sm">
            {node.type === 'ai_action' ? (
              <>
                <div>
                  <div className="text-[11px] text-on-surface-variant mb-xs">Model</div>
                  <select
                    className="w-full bg-surface-container-highest border border-outline-variant rounded p-xs text-body-sm text-on-surface font-code-md focus:outline-none focus:border-secondary transition-colors"
                    value={node.config.model || 'llama3:8b'}
                    onChange={e => updateNodeConfig(node.id, 'model', e.target.value)}
                  >
                    {models.filter(m => m.providerId === 'ollama').map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-[11px] text-on-surface-variant mb-xs">Prompt</div>
                  <textarea
                    className="w-full bg-surface-container-highest border border-outline-variant rounded p-sm text-body-sm text-on-surface font-code-md text-[12px] focus:outline-none focus:border-secondary transition-colors resize-none h-32 leading-relaxed"
                    value={node.config.prompt || ''}
                    placeholder="Enter prompt..."
                    onChange={e => updateNodeConfig(node.id, 'prompt', e.target.value)}
                  />
                </div>
              </>
            ) : (
              Object.entries(node.config).map(([key, value]) => (
                <div key={key}>
                  <div className="text-[11px] text-on-surface-variant mb-xs capitalize">{key.replace(/_/g, ' ')}</div>
                  {key === 'prompt' || key === 'script' ? (
                    <textarea
                      className="w-full bg-surface-container-highest border border-outline-variant rounded p-sm text-body-sm text-on-surface font-code-md text-[12px] focus:outline-none focus:border-secondary transition-colors resize-none h-20"
                      value={value}
                      onChange={e => updateNodeConfig(node.id, key, e.target.value)}
                    />
                  ) : (
                    <input
                      className="w-full bg-surface-container-highest border border-outline-variant rounded p-xs text-body-sm text-on-surface font-code-md focus:outline-none focus:border-secondary transition-colors"
                      value={value}
                      onChange={e => updateNodeConfig(node.id, key, e.target.value)}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Data Context */}
        <div className="space-y-sm">
          <label className="text-[10px] font-label-caps text-outline uppercase">Data Context (Live)</label>
          <div className="font-code-md text-[11px] bg-surface-container-lowest p-sm border border-outline-variant rounded text-secondary-fixed-dim h-40 overflow-y-auto">
            <pre>{JSON.stringify({
              node_id: node.id,
              node_type: node.type,
              category: node.category,
              status: node.status || 'idle',
              config_keys: Object.keys(node.config),
              ports: { input: node.ports.filter(p => p.type === 'input').length, output: node.ports.filter(p => p.type === 'output').length },
              has_output: !!node.output,
              output_preview: node.output ? node.output.slice(0, 80) + (node.output.length > 80 ? '…' : '') : null,
            }, null, 2)}</pre>
          </div>
        </div>
      </div>

      {/* Agent Execution Area */}
      {node.type === 'agent' && (
        <div className="p-md border-t border-outline-variant space-y-sm">
          <label className="text-[10px] font-label-caps text-outline uppercase">Autonomous Loop</label>
          <div className="bg-surface-container-low border border-outline-variant rounded p-sm text-label-caps space-y-sm">
            <div className="flex justify-between items-center text-outline">
              <span>Status: {loopState.status}</span>
              <span>Step: {loopState.currentStep}</span>
            </div>
            {loopState.status === 'running' ? (
              <div className="flex justify-center p-sm">
                <span className="material-symbols-outlined animate-spin text-secondary">progress_activity</span>
              </div>
            ) : (
              <button 
                onClick={() => {
                  startAutonomousLoop(
                    node.config.system_prompt || 'You are an autonomous agent.',
                    node.config.model || 'llama3:8b',
                    'ollama',
                    (state) => setLoopState(s => ({ ...s, ...state, logs: [...s.logs, ...(state.logs || [])] }))
                  );
                }}
                className="w-full py-1 bg-secondary text-on-secondary rounded hover:opacity-90 transition-all font-bold"
              >
                Start Autonomous Loop
              </button>
            )}
            <div className="h-32 overflow-y-auto bg-surface-container-lowest border border-outline-variant rounded p-xs mt-xs flex flex-col-reverse text-[10px]">
              {[...loopState.logs].reverse().map((log, i) => {
                const match = log.match(/^\[([^\]]+)\]\s*(.*)$/);
                if (match && match[1] !== 'Step 1' && match[1] !== 'Step 2' && match[1] !== 'Step 3' && match[1] !== 'Step 4' && match[1] !== 'Step 5' && match[1] !== 'Step 6' && match[1] !== 'Step 7' && match[1] !== 'Step 8' && match[1] !== 'Step 9' && match[1] !== 'Step 10') {
                  return (
                    <div key={i} className="truncate pl-2 border-l border-primary/50 text-primary-fixed-dim">
                      <span className="font-bold opacity-80 uppercase text-[8px] mr-1">@{match[1]}</span>
                      {match[2]}
                    </div>
                  );
                }
                const isStep = log.startsWith('[Step');
                return (
                  <div key={i} className={`truncate ${isStep ? 'text-secondary opacity-80' : 'text-outline'}`}>
                    {log}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="p-md border-t border-outline-variant space-y-sm">
        <button 
          onClick={() => useWorkflowStore.getState().executeWorkflow()}
          className="w-full py-sm bg-surface-container-high border border-outline-variant rounded text-label-caps text-on-surface hover:bg-surface-container-highest transition-colors"
        >
          Test Node
        </button>
        <button
          onClick={() => removeNode(node.id)}
          className="w-full py-sm bg-error/10 border border-error/30 rounded text-label-caps text-error hover:bg-error/20 transition-colors"
        >
          Delete Node
        </button>
      </div>
    </div>
  );
};

// ── Execution Replay Timeline ────────────────────────────────────────────────

const ExecutionTimeline: React.FC = () => {
  const { executionSteps } = useWorkflowStore();
  const totalMs = executionSteps.reduce((acc, s) => Math.max(acc, s.startMs + s.durationMs), 0) || 3000;
  const [playheadPos, setPlayheadPos] = useState(60);

  return (
    <div className="h-28 bg-surface-container-lowest border-t border-outline-variant backdrop-blur-md bg-opacity-90 p-md flex flex-col gap-sm flex-shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-label-caps text-outline uppercase font-bold">Execution Replay</span>
        <div className="flex gap-md items-center">
          <button className="material-symbols-outlined text-outline cursor-pointer hover:text-on-surface text-[20px]">skip_previous</button>
          <button 
            className={`material-symbols-outlined ${useWorkflowStore.getState().isExecuting ? 'text-error' : 'text-secondary-fixed-dim'} cursor-pointer hover:text-on-surface text-[20px]`} 
            style={{ fontVariationSettings: "'FILL' 1" }}
            onClick={() => useWorkflowStore.getState().executeWorkflow()}
          >
            {useWorkflowStore.getState().isExecuting ? 'stop_circle' : 'play_arrow'}
          </button>
          <button className="material-symbols-outlined text-outline cursor-pointer hover:text-on-surface text-[20px]">skip_next</button>
        </div>
      </div>
      <div className="relative flex-1 bg-surface-container rounded border border-outline-variant/20 overflow-hidden cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setPlayheadPos(((e.clientX - rect.left) / rect.width) * 100);
        }}
      >
        {/* Grid lines */}
        <div className="absolute inset-0 flex justify-between px-[10%] items-center pointer-events-none">
          {[0,1,2,3,4].map(i => <div key={i} className="h-full w-[1px] bg-outline-variant/30" />)}
        </div>

        {/* Execution blocks */}
        {executionSteps.map(step => {
          const left = (step.startMs / totalMs) * 100;
          const width = (step.durationMs / totalMs) * 100;
          const color = step.status === 'error' ? 'bg-error/40 border-error/60' :
                        step.status === 'completed' ? 'bg-secondary-fixed-dim/40 border-secondary-fixed-dim/60' :
                        'bg-primary/40 border-primary/60';
          return (
            <div
              key={step.id}
              className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-full border ${color}`}
              style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
            />
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-secondary-fixed-dim shadow-[0_0_8px_#2fd9f4] z-20 pointer-events-none"
          style={{ left: `${playheadPos}%` }}
        >
          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-secondary-fixed-dim rotate-45" />
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-code-md text-outline">
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const ms = Math.round(totalMs * frac);
          const s = Math.floor(ms / 1000);
          const msR = ms % 1000;
          return <span key={frac}>{`00:${String(s).padStart(2,'0')}.${String(msR).padStart(3,'0')}`}</span>;
        })}
      </div>
    </div>
  );
};

// ── Main Loom Component ──────────────────────────────────────────────────────

export const Loom: React.FC = () => {
  useEffect(() => {
    setupWorkflowEvents();
  }, []);

  const {
    nodes, edges, selectedNodeId, selectedEdgeId, canvasOffset, canvasZoom, draggingEdge,
    addNode, moveNode, selectNode, selectEdge, removeEdge, panCanvas, zoomCanvas,
    startEdgeDrag, updateEdgeDrag, completeEdgeDrag, cancelEdgeDrag
  } = useWorkflowStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    } else if (e.button === 0) {
      selectNode(null);
      selectEdge(null);
    }
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isPanning.current) {
        panCanvas(e.clientX - panStart.current.x, e.clientY - panStart.current.y);
        panStart.current = { x: e.clientX, y: e.clientY };
      } else if (useWorkflowStore.getState().draggingEdge && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const zoom = useWorkflowStore.getState().canvasZoom;
        const offset = useWorkflowStore.getState().canvasOffset;
        const x = (e.clientX - rect.left - offset.x) / zoom;
        const y = (e.clientY - rect.top - offset.y) / zoom;
        updateEdgeDrag(x, y);
      }
    };
    const onMouseUp = () => {
      isPanning.current = false;
      if (useWorkflowStore.getState().draggingEdge) {
        cancelEdgeDrag();
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [panCanvas, updateEdgeDrag, cancelEdgeDrag]);

  // Handle Delete key for edge deletion
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && useWorkflowStore.getState().selectedEdgeId) {
        removeEdge(useWorkflowStore.getState().selectedEdgeId!);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [removeEdge]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      zoomCanvas(e.deltaY > 0 ? -0.05 : 0.05);
    }
  }, [zoomCanvas]);

  const handleAddFromLibrary = useCallback((template: NodeTemplate) => {
    const cx = 300 - canvasOffset.x + Math.random() * 100;
    const cy = 200 - canvasOffset.y + Math.random() * 100;
    addNode(template, cx / canvasZoom, cy / canvasZoom);
  }, [addNode, canvasOffset, canvasZoom]);

  const handlePortMouseDown = (nodeId: string, portId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasOffset.x) / canvasZoom;
    const y = (e.clientY - rect.top - canvasOffset.y) / canvasZoom;
    startEdgeDrag(nodeId, portId, x, y);
  };

  const handlePortMouseUp = (nodeId: string, portId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (draggingEdge && draggingEdge.sourceNodeId !== nodeId) {
      completeEdgeDrag(nodeId, portId);
    }
  };

  return (
    <div className="flex-1 flex w-full h-full bg-background overflow-hidden">
      {/* Node Library */}
      <NodeLibrary onDragTemplate={handleAddFromLibrary} />

      {/* Canvas + Timeline */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden blueprint-canvas cursor-default"
          style={{
            backgroundImage:
              `linear-gradient(rgba(144,143,160,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(144,143,160,0.05) 1px, transparent 1px)`,
            backgroundSize: `${20 * canvasZoom}px ${20 * canvasZoom}px`,
            backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`,
          }}
          onMouseDown={handleCanvasMouseDown}
          onWheel={handleWheel}
        >
          {/* Transform group */}
          <div style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasZoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            inset: 0,
          }}>
            {/* SVG Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
              {edges.map(edge => {
                const source = nodes.find(n => n.id === edge.sourceNodeId);
                const target = nodes.find(n => n.id === edge.targetNodeId);
                if (!source || !target) return null;
                return (
                  <EdgePath
                    key={edge.id}
                    edge={edge}
                    sourceNode={source}
                    targetNode={target}
                    isSelected={selectedEdgeId === edge.id}
                    onSelect={() => selectEdge(edge.id)}
                  />
                );
              })}
              {draggingEdge && nodes.find(n => n.id === draggingEdge.sourceNodeId) && (
                <DraggingEdgePath
                  sourceNode={nodes.find(n => n.id === draggingEdge.sourceNodeId)!}
                  sourcePortId={draggingEdge.sourcePortId}
                  cursorX={draggingEdge.cursorX}
                  cursorY={draggingEdge.cursorY}
                />
              )}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
              <CanvasNode
                key={node.id}
                node={node}
                isSelected={node.id === selectedNodeId}
                onSelect={() => selectNode(node.id)}
                onMove={(x, y) => moveNode(node.id, x, y)}
                onPortMouseDown={(portId, e) => handlePortMouseDown(node.id, portId, e)}
                onPortMouseUp={(portId, e) => handlePortMouseUp(node.id, portId, e)}
                zoom={canvasZoom}
              />
            ))}
          </div>

          {/* Canvas controls */}
          <div className="absolute bottom-md right-md z-30 flex items-center gap-xs bg-surface-container-highest/90 backdrop-blur-sm border border-outline-variant rounded p-xs shadow-lg">
            <button onClick={() => zoomCanvas(-0.1)} className="w-7 h-7 flex items-center justify-center text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <span className="text-label-caps text-on-surface-variant w-10 text-center">{Math.round(canvasZoom * 100)}%</span>
            <button onClick={() => zoomCanvas(0.1)} className="w-7 h-7 flex items-center justify-center text-outline hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
            <div className="w-[1px] h-4 bg-outline-variant mx-xs" />
            <button onClick={() => { useWorkflowStore.setState({ canvasOffset: { x: 0, y: 0 }, canvasZoom: 1 }); }} className="w-7 h-7 flex items-center justify-center text-outline hover:text-on-surface transition-colors" title="Reset View">
              <span className="material-symbols-outlined text-[18px]">fit_screen</span>
            </button>
          </div>
        </div>

        {/* Execution Replay Timeline */}
        <ExecutionTimeline />
      </div>

      {/* Inspector */}
      <NodeInspector />
    </div>
  );
};
