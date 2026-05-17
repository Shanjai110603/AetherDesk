import { create } from 'zustand';

export interface ApprovalRequest {
  id: string;
  toolName: string;
  parameters: Record<string, any>;
  resolve: (approved: boolean) => void;
  timestamp: number;
}

interface ApprovalStoreState {
  pendingRequests: ApprovalRequest[];
  requestApproval: (toolName: string, parameters: Record<string, any>) => Promise<boolean>;
  resolveApproval: (id: string, approved: boolean) => void;
}

export const useApprovalStore = create<ApprovalStoreState>((set) => ({
  pendingRequests: [],

  requestApproval: (toolName, parameters) => {
    return new Promise((resolve) => {
      const id = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      set(state => ({
        pendingRequests: [...state.pendingRequests, { id, toolName, parameters, resolve, timestamp: Date.now() }]
      }));
    });
  },

  resolveApproval: (id, approved) => {
    set(state => {
      const req = state.pendingRequests.find(r => r.id === id);
      if (req) {
        req.resolve(approved);
      }
      return { pendingRequests: state.pendingRequests.filter(r => r.id !== id) };
    });
  }
}));
