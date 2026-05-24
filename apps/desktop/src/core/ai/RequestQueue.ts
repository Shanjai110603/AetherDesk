export type QueuePriority = 'realtime' | 'normal' | 'batch';

export interface StreamRequest {
  sessionId: string;
  prompt: string;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
}

export interface QueuedRequest {
  id: string;
  sessionId: string;
  agentId?: string;
  priority: QueuePriority;
  payload: StreamRequest;
  retryCount: number;
  createdAt: number;
  expiresAt: number;
}

export interface RateLimitError {
  type: 'rate_limit' | 'timeout' | 'server_error';
  retryAfterMs: number;
  message: string;
}

export class RequestQueue {
  private queue: Map<string, QueuedRequest[]> = new Map();
  private processing = false;
  private pausedWorkflows: Set<string> = new Set();
  private statusListeners: Array<(status: QueueStatus) => void> = [];

  async enqueue(request: QueuedRequest): Promise<void> {
    const sessionQueue = this.queue.get(request.sessionId) || [];
    sessionQueue.push(request);
    sessionQueue.sort((a, b) => this.priorityValue(b.priority) - this.priorityValue(a.priority));
    this.queue.set(request.sessionId, sessionQueue);
    this.emitStatus();

    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.size > 0) {
      let processedAny = false;
      for (const [sessionId, requests] of Array.from(this.queue.entries())) {
        if (requests.length === 0) {
          this.queue.delete(sessionId);
          continue;
        }

        const request = requests.shift()!;
        processedAny = true;

        try {
          // Simulate processing - in real implementation would call ai_chat_stream
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          await this.handleError(error as RateLimitError, request);
        }

        this.emitStatus();
      }

      if (!processedAny) break;
      // Small delay to prevent busy-waiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
    this.emitStatus();
  }

  private async handleError(error: RateLimitError, request: QueuedRequest): Promise<void> {
    if (error.type === 'rate_limit') {
      // Re-queue with backoff
      const backoffMs = Math.min(
        error.retryAfterMs,
        1000 * Math.pow(2, Math.min(request.retryCount, 5)),
      );

      setTimeout(() => {
        this.enqueue({
          ...request,
          retryCount: request.retryCount + 1,
        });
      }, backoffMs);

      // Pause related workflows
      if (request.agentId) {
        this.pauseWorkflow(request.agentId);
      }
    }
  }

  pauseWorkflow(workflowId: string): void {
    if (!this.pausedWorkflows.has(workflowId)) {
      this.pausedWorkflows.add(workflowId);
      window.dispatchEvent(new CustomEvent('aetherdesk:workflow_paused', { detail: { workflowId } }));
    }
  }

  resumeWorkflow(workflowId: string): void {
    if (this.pausedWorkflows.has(workflowId)) {
      this.pausedWorkflows.delete(workflowId);
      window.dispatchEvent(new CustomEvent('aetherdesk:workflow_resumed', { detail: { workflowId } }));
    }
  }

  private priorityValue(priority: QueuePriority): number {
    return priority === 'realtime' ? 3 : priority === 'normal' ? 2 : 1;
  }

  getQueueStatus(): QueueStatus {
    const bySession: Record<string, number> = {};
    let totalQueued = 0;

    for (const [sessionId, requests] of this.queue) {
      bySession[sessionId] = requests.length;
      totalQueued += requests.length;
    }

    return {
      totalQueued,
      bySession,
      isProcessing: this.processing,
      pausedWorkflows: Array.from(this.pausedWorkflows),
    };
  }

  private emitStatus(): void {
    const status = this.getQueueStatus();
    this.statusListeners.forEach(listener => listener(status));
    window.dispatchEvent(new CustomEvent('aetherdesk:queue_status_changed', { detail: status }));
  }

  subscribe(listener: (status: QueueStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }
}

export interface QueueStatus {
  totalQueued: number;
  bySession: Record<string, number>;
  isProcessing: boolean;
  pausedWorkflows: string[];
}

// Export singleton instance
export const requestQueue = new RequestQueue();
