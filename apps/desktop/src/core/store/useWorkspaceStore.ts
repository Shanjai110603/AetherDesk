import { create } from 'zustand';

export interface WorkspaceInfo {
  path: string;
  name: string;
  lastOpenedAt: number;
}

interface WorkspaceStoreState {
  currentWorkspace: WorkspaceInfo | null;
  recentWorkspaces: WorkspaceInfo[];
  hasCompletedOnboarding: boolean;
  setCurrentWorkspace: (ws: WorkspaceInfo | null) => void;
  addRecentWorkspace: (ws: WorkspaceInfo) => void;
  completeOnboarding: () => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  currentWorkspace: null,
  recentWorkspaces: [],
  hasCompletedOnboarding: false,

  completeOnboarding: () => set({ hasCompletedOnboarding: true }),

  setCurrentWorkspace: (ws) => {
    set({ currentWorkspace: ws });
    if (ws) get().addRecentWorkspace(ws);
  },

  addRecentWorkspace: (ws) => {
    set((state) => {
      const filtered = state.recentWorkspaces.filter(r => r.path !== ws.path);
      return { recentWorkspaces: [ws, ...filtered].slice(0, 10) };
    });
  },
}));
