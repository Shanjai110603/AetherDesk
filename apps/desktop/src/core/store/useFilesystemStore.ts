import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';


export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
  extension?: string;
}

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

function pathToLanguage(extension?: string): string {
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    rs: 'rust', py: 'python', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    html: 'html', css: 'css', scss: 'scss', json: 'json', toml: 'toml',
    md: 'markdown', yaml: 'yaml', yml: 'yaml', sh: 'shell', bash: 'shell',
  };
  return map[extension || ''] || 'plaintext';
}

interface FilesystemStoreState {
  fileTree: FileNode[];
  openTabs: EditorTab[];
  activeTabId: string | null;
  isLoading: boolean;

  loadDirectory: (path: string) => Promise<void>;
  openFile: (node: FileNode) => Promise<void>;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  saveActiveFile: () => Promise<void>;
}

export const useFilesystemStore = create<FilesystemStoreState>((set, get) => ({
  fileTree: [],
  openTabs: [],
  activeTabId: null,
  isLoading: false,

  loadDirectory: async (path) => {
    set({ isLoading: true });
    try {
      const tree = await invoke<FileNode[]>('fs_read_dir', { path });
      
      // Phase 11 P0: Scaffold AI workspace structure
      try {
        await invoke('scaffold_workspace_fs', { workspacePath: path });
        await invoke('start_workspace_indexer', { workspacePath: path });
      } catch (e) {
        console.error('Failed to initialize workspace AI infrastructure:', e);
      }

      set({ fileTree: tree, isLoading: false });
    } catch (err) {
      console.error('Failed to load directory:', err);
      set({ isLoading: false });
    }
  },

  openFile: async (node) => {
    if (node.is_dir) return;
    const { openTabs } = get();

    // Check if already open
    const existing = openTabs.find(t => t.path === node.path);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    try {
      const content = await invoke<string>('fs_read_file', { path: node.path });
      const tab: EditorTab = {
        id: node.path,
        path: node.path,
        name: node.name,
        content,
        isDirty: false,
        language: pathToLanguage(node.extension),
      };
      set(state => ({ openTabs: [...state.openTabs, tab], activeTabId: tab.id }));
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  },

  closeTab: (tabId) => {
    set(state => {
      const tabs = state.openTabs.filter(t => t.id !== tabId);
      const activeTabId = state.activeTabId === tabId
        ? (tabs[tabs.length - 1]?.id ?? null)
        : state.activeTabId;
      return { openTabs: tabs, activeTabId };
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabContent: (tabId, content) => {
    set(state => ({
      openTabs: state.openTabs.map(t =>
        t.id === tabId ? { ...t, content, isDirty: true } : t
      ),
    }));
  },

  saveActiveFile: async () => {
    const { activeTabId, openTabs } = get();
    const tab = openTabs.find(t => t.id === activeTabId);
    if (!tab) return;
    try {
      await invoke('fs_write_file', { path: tab.path, content: tab.content });
      set(state => ({
        openTabs: state.openTabs.map(t => t.id === tab.id ? { ...t, isDirty: false } : t)
      }));
    } catch (err) {
      console.error('Failed to save:', err);
    }
  },
}));
