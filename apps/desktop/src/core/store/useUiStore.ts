import { create } from 'zustand';

interface UiStoreState {
  isSidebarOpen: boolean;
  isBottomPanelOpen: boolean;
  toggleSidebar: () => void;
  toggleBottomPanel: () => void;
  setSidebarOpen: (open: boolean) => void;
  setBottomPanelOpen: (open: boolean) => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  isSidebarOpen: true,
  isBottomPanelOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  toggleBottomPanel: () => set((state) => ({ isBottomPanelOpen: !state.isBottomPanelOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setBottomPanelOpen: (open) => set({ isBottomPanelOpen: open }),
}));
