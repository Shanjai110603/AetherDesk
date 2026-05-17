# AetherDesk Architectural Expansion Roadmap

**Status**: Strategic architectural analysis & phased integration plan  
**Date**: May 17, 2026  
**Objective**: Evolve AetherDesk into a semantic AI operating environment while maintaining modularity, performance, and desktop-native architecture.

---

## Executive Summary

This document synthesizes 13 strategic feature directions into a coherent architectural roadmap that enhances AetherDesk's core differentiators:

- **Semantic AI orchestration** (not generic LLM wrapper)
- **Provider-agnostic intelligence** (not vendor lock-in)
- **Security-first execution** (not open sandboxes)
- **Cost-aware workflows** (not unlimited API calls)
- **Visual-code bidirectionality** (not regex string replacement)

The roadmap is organized by **4 architectural phases** with clear dependencies, integration points, and risk mitigations.

---

## Current Architecture Analysis

### Existing Strengths

1. **Event-Driven Foundation**
   - `aetherDeskEvents.ts`: Typed window event bus (annotation events, semantic navigation)
   - Rust `event_bus.rs`: Platform event enum (workflow, agent, sandbox events)
   - Decoupled workspace communication (Forge ↔ Nexus ↔ Artisan ↔ Swarm)

2. **Zustand State Architecture**
   - `useAiStore.ts`: Provider-aware model registry, session management, API key handling
   - `useSwarmStore.ts`: Agent personas with role-scoped capabilities
   - `useRuntimeStore.ts`: Subprocess lifecycle, port management, logging
   - `useWorkflowStore.ts`: Workflow execution state
   - Clear separation of concerns (AI, runtime, workspace, approval states)

3. **Orchestration Capabilities**
   - `orchestration/engine.rs`: Workflow graph execution, parallel node handling
   - `orchestration/nodes.rs`: Bash/script execution, tool dispatch
   - `orchestration/memory.rs`: Agent memory persistence (observations, decisions)
   - `event_bus.rs`: Pub/sub pattern for workflow state changes

4. **Capability-Scoped Agent System**
   - `useSwarmStore.ts`: Personas with capability lists (READ_FS, WRITE_FS, EXEC_CMD, WORKFLOW_EXECUTION)
   - `ToolBroker.ts`: Tool execution with capability validation
   - Delegation system: agents can delegate tasks to other personas

5. **Existing AI Integration**
   - Provider support: OpenAI, Anthropic, Gemini, Ollama, OpenRouter, Local
   - In-memory API keys (transient, not persisted)
   - Session isolation (Forge AI panel, Artisan session, Nexus chat)
   - Streaming inference (`ai_chat_stream` command)

### Existing Gaps

1. **No Intelligent Model Routing** → Task defaults to single configured model
2. **No Cost Awareness** → Unbounded API calls, no spend controls
3. **No Rate-Limit Handling** → Crashes on TPM/RPM limits
4. **No Secure Credential Storage** → API keys in-memory, vulnerable to disk dumps
5. **No Sandbox Isolation** → Agent execution in host process
6. **No Local Inference Fallback** → Full cloud dependency
7. **No Visual ↔ Code Sync** → Artisan uses regex/string manipulation
8. **Limited Inter-Agent Coordination** → No messaging, delegation only
9. **No Operations Dashboard** → No realtime execution telemetry
10. **No Dependency Intelligence** → Semantic engine is symbol-indexing only
11. **No Execution Snapshots** → No replay/rollback capability
12. **No Diff Review UI** → AI changes apply directly

---

## Phased Implementation Roadmap

### Phase 1: Intelligence & Cost Control (8-10 weeks)

**Goal**: Implement provider-agnostic intelligent routing and spend awareness.

#### 1.1: Intelligent Model Routing Engine
**Files to create/modify**:
- `src/core/ai/routing/RouterEngine.ts` (NEW)
- `src/core/ai/routing/ModelScorer.ts` (NEW)
- `src/core/store/useAiStore.ts` (EXTEND)
- `src-tauri/src/providers/routing.rs` (NEW)

**Design**:
```typescript
// Router selects models based on task context
interface RoutingContext {
  taskType: 'formatting' | 'testing' | 'architecture' | 'generation' | 'analysis';
  contextSize: number;
  targetLatency: 'realtime' | 'normal' | 'batch';
  costSensitivity: 'free' | 'cheap' | 'standard' | 'premium';
  requiresOffline: boolean;
  workflowId?: string;
}

interface ModelScore {
  modelId: string;
  score: number;
  reason: string;
  estimatedCostPer1k: number;
  estimatedLatencyMs: number;
  fallbackOrder: string[];
}

class IntelligentRouter {
  async scoreModels(context: RoutingContext): Promise<ModelScore[]>;
  async selectBestModel(context: RoutingContext): Promise<string>;
  registerRoutingRule(pattern: string, modelId: string): void;
  async handleModelFailure(modelId: string, fallbackContext: RoutingContext): Promise<string>;
}
```

**Routing Rules** (extensible):
- Formatting task → Cheap local model (e.g., Mistral 7B)
- Unit tests → Cheap cloud model (e.g., GPT-4 Mini)
- Architecture design → Premium model (e.g., Claude 3 Opus)
- Mass generation → Local GPU model (e.g., Llama 2 70B)
- Analysis tasks → Cost-optimized (Gemini if cheap quota available)

**Integration Points**:
- Modify `useAiStore.ts` to store routing rules and model metadata
- Extend `ai_chat_stream` command in Tauri to use router
- Update Nexus chat to query router for model selection
- Forge AI panel uses router for action-specific model selection

#### 1.2: Session Cost Controls & Token Management
**Files to create/modify**:
- `src/core/store/useCostStore.ts` (NEW)
- `src/core/ai/CostCalculator.ts` (NEW)
- `src-tauri/src/providers/cost_tracker.rs` (NEW)
- `src/workspaces/nexus/TokenDashboard.tsx` (NEW)

**Design**:
```typescript
interface CostConfig {
  sessionSpendCap: number;           // $X per session
  dailyBudget: number;               // $X per day
  monthlyBudget: number;             // $X per month
  perAgentTokenLimit: number;        // Tokens per agent execution
  warningThreshold: number;          // Warn at 75% of cap
  hardStopAt: number;                // 100% → reject requests
}

interface TokenTelemetry {
  sessionId: string;
  providerId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
}

class CostTracker {
  async recordTokens(telemetry: TokenTelemetry): Promise<void>;
  async checkBudgetAvailable(sessionId: string, estimatedTokens: number): Promise<boolean>;
  async getSessionCost(sessionId: string): Promise<number>;
  async getDailyCost(): Promise<number>;
  async emitWarningIfThreshold(sessionId: string): Promise<void>;
}
```

**UI Components**:
- **TokenDashboard.tsx**: Real-time cost display, daily/monthly burn chart
- **CostWarningBanner.tsx**: Appears when threshold reached
- **PerAgentTokenMonitor.tsx**: Individual agent token usage in Swarm registry

**Integration Points**:
- Hook into `ai_chat_stream` to track tokens
- Nexus: Show live token count during streaming
- Forge: Display AI action cost estimate before execution
- Swarm: Show per-agent token usage in agent card

#### 1.3: Rate-Limit Queueing & Backoff
**Files to create/modify**:
- `src/core/ai/RequestQueue.ts` (NEW)
- `src/core/ai/RetryStrategy.ts` (NEW)
- `src-tauri/src/providers/rate_limiter.rs` (NEW)

**Design**:
```typescript
interface QueuedRequest {
  id: string;
  sessionId: string;
  agentId?: string;
  priority: 'realtime' | 'normal' | 'batch';
  payload: StreamRequest;
  retryCount: number;
  createdAt: number;
}

class RequestQueue {
  async enqueue(request: QueuedRequest): Promise<void>;
  async processQueue(): Promise<void>;
  async handleRateLimitError(error: RateLimitError, request: QueuedRequest): Promise<void>;
  async pauseWorkflow(workflowId: string): Promise<void>;
  async resumeWorkflow(workflowId: string): Promise<void>;
}
```

**Behavior**:
- Queue requests when TPM/RPM hit
- Exponential backoff: 1s → 2s → 4s → 8s (max 5 min)
- Pause related workflows (show UI indicator)
- Auto-fallback to cheaper provider if available
- Emit queue status events to Mission Control

---

### Phase 2: Security & Execution Isolation (10-12 weeks)

**Goal**: Implement secure credential storage and sandboxed execution environments.

#### 2.1: OS-Level Secure Credential Vault
**Files to create/modify**:
- `src-tauri/src/vault/mod.rs` (NEW)
- `src-tauri/src/vault/windows_dpapi.rs` (NEW)
- `src-tauri/src/vault/macos_keychain.rs` (NEW)
- `src-tauri/src/vault/linux_secret_service.rs` (NEW)
- `src/core/store/useVaultStore.ts` (NEW)

**Design**:
```rust
// Vault abstraction layer
pub trait CredentialVault {
    async fn store_key(&self, provider: &str, key: &str) -> Result<(), String>;
    async fn retrieve_key(&self, provider: &str) -> Result<String, String>;
    async fn delete_key(&self, provider: &str) -> Result<(), String>;
    async fn list_providers(&self) -> Result<Vec<String>, String>;
}

// Platform implementations
pub struct WindowsDpapiVault { ... }
pub struct MacosKeychainVault { ... }
pub struct LinuxSecretServiceVault { ... }

pub fn create_vault() -> Box<dyn CredentialVault> {
    #[cfg(target_os = "windows")] return Box::new(WindowsDpapiVault::new());
    #[cfg(target_os = "macos")] return Box::new(MacosKeychainVault::new());
    #[cfg(target_os = "linux")] return Box::new(LinuxSecretServiceVault::new());
}
```

**Tauri Commands**:
```rust
#[tauri::command]
pub async fn vault_store_credential(provider: String, key: String) -> Result<(), String>;

#[tauri::command]
pub async fn vault_retrieve_credential(provider: String) -> Result<String, String>;

#[tauri::command]
pub async fn vault_list_stored_providers() -> Result<Vec<String>, String>;
```

**Frontend Integration**:
- `useVaultStore.ts`: Wraps Tauri commands, provides React hook interface
- Credentials never transmitted to frontend in plain text
- Session injection: Rust retrieves key, injects into subprocess/request

#### 2.2: Secure Sandbox Execution Layer
**Files to create/modify**:
- `src-tauri/src/sandbox/mod.rs` (NEW)
- `src-tauri/src/sandbox/wsl2_sandbox.rs` (NEW)
- `src-tauri/src/sandbox/windows_sandbox.rs` (NEW)
- `src-tauri/src/sandbox/container_sandbox.rs` (NEW)
- `src/core/store/useSandboxStore.ts` (NEW)
- `src/workspaces/nexus/SandboxApprovalModal.tsx` (NEW)

**Design**:
```rust
pub enum SandboxKind {
    Wsl2 { distro: String },
    WindowsSandbox,
    Container { image: String, mount_path: String },
}

pub struct SandboxConfig {
    kind: SandboxKind,
    permissions: SandboxPermissions,
    timeout_ms: u64,
    cleanup_on_exit: bool,
}

pub struct SandboxPermissions {
    filesystem: PathSet,      // Allowed mount points
    network: bool,            // Allow network access
    requires_approval: bool,  // User must approve execution
}

pub struct SandboxExecutor {
    config: SandboxConfig,
}

impl SandboxExecutor {
    pub async fn execute(&self, command: String, args: Vec<String>) -> Result<ExecutionResult, String>;
    pub async fn get_status(&self) -> Result<SandboxStatus, String>;
    pub async fn cleanup(&self) -> Result<(), String>;
}
```

**Approval Workflow**:
- Agent requests execution (e.g., `npm install`, `cargo build`)
- Frontend shows modal: command, permissions, timeout
- User approves/denies
- If approved: execute in sandbox with telemetry
- If denied: return simulated result or error

**Use Cases**:
- Safe package installation testing
- Runtime testing without host pollution
- Autonomous repair workflows
- Browser automation testing

---

### Phase 3: Intelligence & Observability (12-14 weeks)

**Goal**: Implement embedded local inference, inter-agent communication, and operations dashboard.

#### 3.1: Embedded Local Inference Engine
**Files to create/modify**:
- `src-tauri/src/inference/mod.rs` (NEW)
- `src-tauri/src/inference/onnx_runtime.rs` (NEW)
- `src-tauri/src/inference/gpu_accelerator.rs` (NEW)
- `src/core/ai/LocalInferenceProvider.ts` (NEW)

**Design**:
```rust
pub struct LocalInferenceEngine {
    runtime: ort::Session,
    model_path: String,
    device: InferenceDevice,
}

pub enum InferenceDevice {
    Cpu,
    Nvidia { cuda_compute: String },
    Amd { rocm_version: String },
    IntelNpu,
}

impl LocalInferenceEngine {
    pub async fn initialize(model_name: &str, device: InferenceDevice) -> Result<Self, String>;
    pub async fn infer(&self, prompt: String, context: Option<Vec<String>>) -> Result<InferenceResult, String>;
    pub fn supports_model(&self, model_name: &str) -> bool;
}
```

**Supported Models** (bundled or auto-downloaded):
- Mistral 7B (4-bit quantized, ~4GB)
- Llama 2 13B (8-bit, ~7GB)
- TinyLlama 1.1B (2-bit, ~500MB for quick responses)
- CodeLlama 7B (code-specialized)

**Integration**:
- Fallback provider in router when cloud unavailable
- Formatting/simple tasks use local inference
- Download models on demand (with progress indicator)
- GPU acceleration auto-detected

#### 3.2: Inter-Agent Communication Bus
**Files to create/modify**:
- `src/core/orchestration/AgentBus.ts` (NEW)
- `src-tauri/src/orchestration/agent_messaging.rs` (NEW)
- `src/workspaces/swarm/CollaborativeExecutor.tsx` (NEW)

**Design**:
```typescript
interface AgentMessage {
  id: string;
  senderId: string;
  recipientId: string;
  type: 'task_delegation' | 'review_request' | 'context_share' | 'status_update';
  payload: any;
  priority: 'high' | 'normal' | 'low';
  createdAt: number;
}

class AgentBus {
  async sendMessage(message: AgentMessage): Promise<void>;
  async subscribeToMessages(agentId: string, handler: (msg: AgentMessage) => void): Promise<void>;
  async getMessageHistory(agentId: string, limit: number): Promise<AgentMessage[]>;
  async createCollaborativeWorkflow(agents: string[], objective: string): Promise<WorkflowId>;
}
```

**Workflow Patterns**:
- **Review Workflow**: Agent A requests review from Agent B, Agent B provides feedback, A revises
- **Delegated Subtasks**: Agent A breaks task into subtasks, delegates to B & C, collates results
- **Shared Scratchpad**: Multiple agents write to shared JSON/markdown file in workspace
- **Orchestration Supervision**: Supervisor agent monitors task agents, intervenes if needed

#### 3.3: Mission Control Dashboard
**Files to create/modify**:
- `src/workspaces/missioncontrol/MissionControl.tsx` (NEW)
- `src/workspaces/missioncontrol/AgentMonitor.tsx` (NEW)
- `src/workspaces/missioncontrol/ExecutionTimeline.tsx` (NEW)
- `src/workspaces/missioncontrol/MetricsPanel.tsx` (NEW)
- `src-tauri/src/telemetry/mod.rs` (NEW)

**Dashboard Sections**:
1. **Active Agents**: Real-time list with status, current task, elapsed time
2. **Running Workflows**: DAG visualization, node status, estimated completion
3. **Runtime Health**: CPU/memory usage, sandbox states, cleanup status
4. **Token Usage**: Live provider routing dashboard, cumulative costs, daily burn
5. **Provider Routing**: Which models being used, fallback events, queue depth
6. **Execution Telemetry**: Latency histogram, error rate, retry attempts
7. **Workflow Timeline**: Execution history, duration breakdown, bottleneck identification
8. **Orchestration Logs**: Structured logs with filtering by agent/workflow/provider

---

### Phase 4: Advanced Capabilities (14-18 weeks)

**Goal**: Implement visual-code sync, dependency intelligence, execution replay, and diff review.

#### 4.1: Compiler-Level Dependency Graph
**Files to create/modify**:
- `services/semantic-engine/dependency-graph/` (NEW Rust module)
- `src/core/semantic/DependencyAnalyzer.ts` (NEW)
- `src/workspaces/forge/DependencyOverlay.tsx` (NEW)

**Design**:
```rust
pub struct DependencyGraph {
    nodes: HashMap<String, Symbol>,      // symbol_id → metadata
    edges: Vec<(String, String)>,        // (from, to) relationships
    affected_index: HashMap<String, Vec<String>>, // symbol → affected symbols
}

impl DependencyGraph {
    pub fn compute_affected_symbols(&self, symbol_id: &str) -> Vec<String>;
    pub fn compute_affected_files(&self, file_path: &str) -> Vec<String>;
    pub fn detect_circular_deps(&self) -> Vec<Vec<String>>;
    pub fn get_refactor_impact(&self, old_type: &str, new_type: &str) -> RefactorImpact;
}
```

**Use Cases**:
- Change a data structure → highlight all affected APIs
- Rename a component → show all imports/usages
- Modify a hook → identify all affected components
- Refactor a module → detect cascade impacts
- Performance regression → trace to symbol changes

#### 4.2: True Visual ↔ Code Synchronization
**Files to create/modify**:
- `src/core/artisan/AstSync.ts` (NEW)
- `src/core/artisan/SourceMapManager.ts` (NEW)
- `src/workspaces/artisan/BidirectionalEditor.tsx` (REWRITE)
- `src-tauri/src/ast/mod.rs` (EXTEND)

**Design**:
```typescript
// Visual change → AST transform
async function applyVisualEdit(
  sourceCode: string,
  edit: VisualEdit,
): Promise<string> {
  const ast = parse(sourceCode);
  const transformer = new AstTransformer();
  
  // Mutation: position change, property update, etc.
  applyVisualMutation(ast, edit);
  
  return generate(ast);
}

// AST change → visual update (via source maps)
async function syncVisualFromSource(
  oldSource: string,
  newSource: string,
): Promise<VisualUpdate[]> {
  const oldAst = parse(oldSource);
  const newAst = parse(newSource);
  const diff = computeAstDiff(oldAst, newAst);
  
  return diff.map(change => ({
    componentId: sourceMapLookup(change.node),
    attribute: change.key,
    oldValue: change.oldValue,
    newValue: change.newValue,
  }));
}
```

**No More Regex**: True AST-aware transforms
- Position/layout changes → AST dimension updates
- Component prop edits → AST property mutations
- Responsive breakpoint changes → Media query updates
- Source code edits → Live preview sync

#### 4.3: Runtime Snapshots & Execution Replay
**Files to create/modify**:
- `src/core/store/useSnapshotStore.ts` (NEW)
- `src-tauri/src/snapshots/mod.rs` (NEW)
- `src/workspaces/loom/SnapshotTimeline.tsx` (NEW)

**Design**:
```typescript
interface ExecutionSnapshot {
  id: string;
  workflowId: string;
  timestamp: number;
  nodeId: string;
  state: {
    agentMemory: Record<string, any>;
    workspaceFiles: Record<string, string>;
    runtimeEnv: Record<string, string>;
    modelOutputs: Record<string, any>;
  };
  isRollbackPoint: boolean;
}

class SnapshotManager {
  async captureSnapshot(workflowId: string, nodeId: string): Promise<ExecutionSnapshot>;
  async listSnapshots(workflowId: string): Promise<ExecutionSnapshot[]>;
  async rollbackToSnapshot(snapshotId: string): Promise<void>;
  async replayFrom(snapshotId: string): Promise<WorkflowResult>;
  async diffSnapshots(snapshotA: string, snapshotB: string): Promise<StateDiff>;
}
```

**Use Cases**:
- Debug agent decision: step through execution
- Rollback failed workflow: return to last known-good state
- Replay with different model: test sensitivity
- Timeline debugging: see state at each node

#### 4.4: AI Diff Review System
**Files to create/modify**:
- `src/components/DiffReview/StructuredDiff.tsx` (NEW)
- `src/components/DiffReview/PatchPreview.tsx` (NEW)
- `src/core/ai/DiffAnalyzer.ts` (NEW)
- `src-tauri/src/diff/mod.rs` (NEW)

**Design**:
```typescript
interface StructuredDiff {
  id: string;
  sourceFile: string;
  changes: DiffChunk[];
  semanticSummary: string;
  riskLevel: 'low' | 'medium' | 'high';
  affectedTests?: string[];
}

interface DiffChunk {
  type: 'add' | 'remove' | 'modify';
  startLine: number;
  endLine: number;
  oldText: string;
  newText: string;
  semanti explanation: string;
}

class DiffReviewUI {
  async acceptChange(chunkId: string): Promise<void>;
  async rejectChange(chunkId: string, reason: string): Promise<void>;
  async requestModification(chunkId: string, feedback: string): Promise<void>;
  async applyAcceptedChanges(): Promise<void>;
}
```

**Workflow**:
1. AI generates code → produces diff
2. DiffReview modal shows structured changes
3. User accepts/rejects per-chunk
4. Optional: request modification with feedback
5. Apply accepted, optionally re-run AI on rejected chunks

---

## Workspace Health & Diagnostics System

**Files to create/modify**:
- `src/core/diagnostics/HealthMonitor.ts` (NEW)
- `src/workspaces/health/HealthDashboard.tsx` (NEW)
- `src-tauri/src/diagnostics/mod.rs` (NEW)

**Design**:
```typescript
interface HealthIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  type: 'broken_import' | 'crash' | 'dependency_conflict' | 'build_failure' | 'perf_regression';
  description: string;
  affectedFiles: string[];
  suggestedFix?: string;
  autoRepairWorkflow?: string;
}

class HealthMonitor {
  async scanWorkspace(): Promise<HealthIssue[]>;
  async watchForIssues(): Promise<void>;
  async triggerRepairAgent(issueId: string): Promise<void>;
}
```

**Integration**:
- Background health scan on workspace change
- Proactive warnings in a dedicated Health workspace
- Quick-fix buttons that trigger repair agents
- Integration with build pipeline monitoring

---

## Architectural Principles & Constraints

### DO (Adherence to AetherDesk Design Philosophy)

✅ **Maintain modular architecture**
- Each system (router, cost tracker, sandbox, etc.) is independent
- Event-driven communication between systems
- No circular dependencies

✅ **Preserve orchestration-first design**
- Workflows remain the primary execution model
- Agents coordinate through orchestration layer
- Sandbox, cost, and routing transparent to workflows

✅ **Preserve semantic intelligence systems**
- Dependency graph extends existing symbol indexer
- AST transforms build on existing AST infrastructure
- Source maps integrate cleanly

✅ **Preserve provider abstraction**
- Router is provider-agnostic
- Fallback mechanisms don't break provider boundaries
- Cost tracking works with any provider

✅ **Preserve capability-scoped security**
- Sandbox enforces capability boundaries
- Agents can only access approved resources
- Approval UI integrates with existing approval store

✅ **Preserve event-driven architecture**
- New systems emit events (cost_warning, sandbox_ready, agent_completed)
- Mission Control subscribes to all events
- No tight coupling

### DO NOT (Anti-Patterns to Avoid)

❌ **Tightly couple systems**
- Routing engine doesn't directly call cost tracker
- Instead: Router emits "model_selected" event → cost tracker listens

❌ **Create monolithic services**
- Each capability (router, vault, sandbox) is independent
- Composition happens via orchestration layer

❌ **Overload frontend state**
- Mission Control subscribes to backend events
- Don't store all telemetry in Zustand
- Use event bus for realtime updates

❌ **Compromise performance**
- Router decision < 100ms (cached scores)
- Diff computation async
- Snapshot capture in background

❌ **Degrade desktop responsiveness**
- Long operations in Tauri background tasks
- UI never blocks on orchestration
- Spinner/indicator for long operations

---

## Integration Points with Existing Systems

### Event Bus Extensions

```typescript
// New events to emit
export const ROUTER_SELECTED_MODEL = 'aetherdesk:router_selected_model';
export const COST_THRESHOLD_REACHED = 'aetherdesk:cost_threshold_reached';
export const REQUEST_QUEUED = 'aetherdesk:request_queued';
export const SANDBOX_APPROVAL_REQUIRED = 'aetherdesk:sandbox_approval_required';
export const AGENT_MESSAGE_SENT = 'aetherdesk:agent_message_sent';
export const WORKFLOW_SNAPSHOT_CAPTURED = 'aetherdesk:workflow_snapshot_captured';
```

### Zustand Store Extensions

```typescript
// New stores to add
export { useRouterStore } from './useRouterStore';
export { useCostStore } from './useCostStore';
export { useVaultStore } from './useVaultStore';
export { useSandboxStore } from './useSandboxStore';
export { useSnapshotStore } from './useSnapshotStore';
export { useHealthStore } from './useHealthStore';
```

### Tauri Command Extensions

```rust
// New command categories
pub mod vault_commands;        // vault_store_credential, vault_retrieve_key
pub mod sandbox_commands;      // sandbox_execute, sandbox_get_status
pub mod router_commands;       // router_score_models, router_select_best
pub mod cost_commands;         // cost_record_tokens, cost_get_spend
pub mod snapshot_commands;     // snapshot_capture, snapshot_rollback
pub mod health_commands;       // health_scan_workspace, health_trigger_repair
```

---

## Phasing Strategy & Dependencies

### Phase 1 Dependencies: NONE (Can start immediately)
- Router, cost tracking, rate-limit queue are independent
- Builds on existing AI infrastructure
- Estimated effort: 8-10 weeks (2 engineers)

### Phase 2 Dependencies: PHASE 1 (cost awareness needed for sandbox decisions)
- Cost tracking informs sandbox approval logic
- Vault standalone but integrates with existing API key management
- Estimated effort: 10-12 weeks (2 engineers)

### Phase 3 Dependencies: PHASE 1 + PHASE 2
- Router provides fallback to local inference
- Mission Control displays router/cost/sandbox telemetry
- Estimated effort: 12-14 weeks (2-3 engineers)

### Phase 4 Dependencies: PHASE 1 + PHASE 2 + PHASE 3
- Diff review integrates with cost tracking (estimate cost of re-run)
- Snapshots work with sandbox execution
- Dependency graph extends semantic engine
- Estimated effort: 14-18 weeks (3 engineers)

---

## Risk Mitigation

### Risk 1: Complexity Creep
**Mitigation**: Strict phase boundaries, no cross-phase features, weekly architecture reviews

### Risk 2: Performance Regression
**Mitigation**: Performance budgets for each system, benchmark suites, throttling mechanisms

### Risk 3: API Key Security Breach
**Mitigation**: Use OS-level vaults (not custom crypto), no keys in logs, audit trails

### Risk 4: Sandbox Escape
**Mitigation**: Use OS-native sandboxing (WSL2, Windows Sandbox, Docker), regular patching, security audits

### Risk 5: Cost Overruns
**Mitigation**: Hard stop at 100% of cap, daily/monthly budgets enforced, warning thresholds

---

## Success Metrics

- **Phase 1**: 30% cost reduction through intelligent routing; <5ms router latency
- **Phase 2**: 100% of secrets in OS vault; sandbox execution for 80% of agent tasks
- **Phase 3**: 10ms local inference latency; 3+ agents per workflow average
- **Phase 4**: 99% diff acceptance accuracy; <50ms diff computation; <10% regression in refactors

---

## Conclusion

This roadmap transforms AetherDesk from a capable desktop IDE into a **semantic AI operating environment** capable of secure, cost-aware, intelligent orchestration.

Each phase maintains architectural integrity while adding critical differentiators:
- **Phase 1**: Intelligence & cost awareness (competitive advantage)
- **Phase 2**: Security & isolation (enterprise requirement)
- **Phase 3**: Observability & coordination (operational excellence)
- **Phase 4**: Advanced capabilities (vertical differentiation)

Implementation prioritizes **modular independence**, **event-driven composition**, and **performance at scale**.

---

**Next Steps**:
1. Review roadmap with architecture team
2. Validate business priorities (which phases first?)
3. Begin Phase 1 design & prototype
4. Establish architecture review cadence
5. Create detailed task breakdowns per phase
