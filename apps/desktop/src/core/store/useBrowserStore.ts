import { create } from 'zustand';

interface BrowserState {
  // Navigation State
  url: string;
  inputValue: string;
  history: string[];
  historyIndex: number;
  isLoading: boolean;
  
  // UI State
  isAiContextSidebarOpen: boolean;

  // Actions
  navigate: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  setInputValue: (value: string) => void;
  setLoading: (loading: boolean) => void;
  toggleAiContextSidebar: () => void;
}

export const useBrowserStore = create<BrowserState>((set, get) => ({
  url: 'http://localhost:5173', // Default local preview
  inputValue: 'http://localhost:5173',
  history: ['http://localhost:5173'],
  historyIndex: 0,
  isLoading: false,
  isAiContextSidebarOpen: true,

  navigate: (newUrl) => {
    let formattedUrl = newUrl;
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      formattedUrl = `https://${newUrl}`;
    }

    const { history, historyIndex, url } = get();
    if (url === formattedUrl) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(formattedUrl);

    set({
      url: formattedUrl,
      inputValue: formattedUrl,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      isLoading: true,
    });
  },

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const newUrl = history[newIndex];
      set({ url: newUrl, inputValue: newUrl, historyIndex: newIndex, isLoading: true });
    }
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      const newUrl = history[newIndex];
      set({ url: newUrl, inputValue: newUrl, historyIndex: newIndex, isLoading: true });
    }
  },

  reload: () => {
    set({ isLoading: true });
    // Reload is handled functionally by the iframe's key or ref trick in the component
  },

  setInputValue: (value) => set({ inputValue: value }),
  setLoading: (loading) => set({ isLoading: loading }),
  toggleAiContextSidebar: () => set((state) => ({ isAiContextSidebarOpen: !state.isAiContextSidebarOpen })),
}));
