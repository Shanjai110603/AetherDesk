import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export type AIProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openrouter' | 'local';

export interface AIProvider {
  id: AIProviderId;
  name: string;
  isLocal: boolean;
  isConfigured: boolean;
  icon: string;
}

export interface AIModel {
  id: string;
  name: string;
  providerId: AIProviderId;
  contextWindow: number;
  size?: string;
  isLocal?: boolean;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  contextSymbols?: Array<{ name: string; kind: string; file_path: string }>;
}

export interface AIChatSession {
  id: string;
  title: string;
  modelId: string;
  messages: AIChatMessage[];
  updatedAt: number;
}

export interface TelemetrySnapshot {
  inference_ms: number;
  tokens_per_sec: number;
  provider?: string;
  model?: string;
}

interface AiStoreState {
  providers: Record<AIProviderId, AIProvider>;
  models: AIModel[];
  activeModelId: string | null;
  sessions: Record<string, AIChatSession>;
  activeSessionId: string | null;
  forgeSessionId: string;           // Isolated Forge AI panel session
  isStreaming: boolean;
  lastTelemetry: TelemetrySnapshot | null;
  // Transient in-memory API keys (not persisted to disk in plain text)
  apiKeys: Partial<Record<AIProviderId, string>>;
  
  // Artisan AI specific state
  artisanSessionId: string;
  activeArtisanNodeId: string | null;
  artisanGenerationHistory: Array<{
    id: string;
    nodeId: string;
    prompt: string;
    componentName: string;
    code: string;
    timestamp: number;
    version: number;
  }>;

  setActiveModel: (modelId: string) => void;
  setActiveSession: (sessionId: string) => void;
  addMessage: (sessionId: string, message: AIChatMessage) => void;
  newSession: () => void;
  setOllamaModels: (models: AIModel[]) => void;
  setProviderConfigured: (providerId: AIProviderId, configured: boolean) => void;
  // Securely store API key in Rust memory + update frontend state
  saveApiKey: (providerId: AIProviderId, key: string) => Promise<void>;
  getApiKey: (providerId: AIProviderId) => string | undefined;
  clearForgeSession: () => void;     // Reset the forge chat
}

const initialProviders: Record<AIProviderId, AIProvider> = {
  openai:     { id: 'openai',     name: 'OpenAI',        isLocal: false, isConfigured: false, icon: 'cloud' },
  anthropic:  { id: 'anthropic',  name: 'Anthropic',     isLocal: false, isConfigured: false, icon: 'cloud' },
  gemini:     { id: 'gemini',     name: 'Google Gemini', isLocal: false, isConfigured: false, icon: 'cloud' },
  ollama:     { id: 'ollama',     name: 'Ollama (Local)', isLocal: true,  isConfigured: true,  icon: 'memory' },
  openrouter: { id: 'openrouter', name: 'OpenRouter',    isLocal: false, isConfigured: false, icon: 'router' },
  local:      { id: 'local',      name: 'Aether Local',  isLocal: true,  isConfigured: true,  icon: 'developer_board' },
};

const initialModels: AIModel[] = [
  // Local models — always shown, status depends on Ollama
  { id: 'llama3:8b',          name: 'Llama 3 (8B)',       providerId: 'ollama',    contextWindow: 8192,   isLocal: true },
  { id: 'mistral:7b',         name: 'Mistral (7B)',        providerId: 'ollama',    contextWindow: 8192,   isLocal: true },
  { id: 'codellama:7b',       name: 'CodeLlama (7B)',      providerId: 'ollama',    contextWindow: 8192,   isLocal: true },
  { id: 'phi3:mini',          name: 'Phi-3 Mini',          providerId: 'ollama',    contextWindow: 4096,   isLocal: true },
  // Cloud models — unlocked when API key is present
  { id: 'gpt-4o',             name: 'GPT-4o',              providerId: 'openai',    contextWindow: 128000 },
  { id: 'gpt-4o-mini',        name: 'GPT-4o Mini',         providerId: 'openai',    contextWindow: 128000 },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', providerId: 'anthropic', contextWindow: 200000 },
  { id: 'claude-3-haiku-20240307',    name: 'Claude 3 Haiku',    providerId: 'anthropic', contextWindow: 200000 },
];

export const FORGE_SESSION_ID = 'forge-ai-panel';
export const ARTISAN_SESSION_ID = 'artisan-ai-session';

export const useAiStore = create<AiStoreState>((set, get) => ({
  providers: initialProviders,
  models: initialModels,
  activeModelId: 'llama3:8b',
  isStreaming: false,
  lastTelemetry: null,
  apiKeys: {},
  forgeSessionId: FORGE_SESSION_ID,
  artisanSessionId: ARTISAN_SESSION_ID,
  activeArtisanNodeId: null,
  artisanGenerationHistory: [],

  sessions: {
    'default': {
      id: 'default',
      title: 'New Session',
      modelId: 'llama3:8b',
      messages: [],
      updatedAt: Date.now(),
    },
    [FORGE_SESSION_ID]: {
      id: FORGE_SESSION_ID,
      title: 'Forge AI',
      modelId: 'llama3:8b',
      messages: [],
      updatedAt: Date.now(),
    },
    [ARTISAN_SESSION_ID]: {
      id: ARTISAN_SESSION_ID,
      title: 'Artisan Visual AI',
      modelId: 'claude-3-5-sonnet-20241022',
      messages: [],
      updatedAt: Date.now(),
    },
  },
  activeSessionId: 'default',

  setActiveModel: (modelId) => set({ activeModelId: modelId }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),

  addMessage: (sessionId, message) =>
    set((state) => {
      const session = state.sessions[sessionId];
      if (!session) return state;
      // Auto-title session from first user message
      const title = session.messages.length === 0 && message.role === 'user'
        ? message.content.slice(0, 40)
        : session.title;
      return {
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...session,
            title,
            messages: [...session.messages, message],
            updatedAt: Date.now(),
          }
        }
      };
    }),

  newSession: () => {
    const id = crypto.randomUUID();
    set(state => ({
      sessions: {
        ...state.sessions,
        [id]: { id, title: 'New Session', modelId: state.activeModelId ?? 'llama3:8b', messages: [], updatedAt: Date.now() },
      },
      activeSessionId: id,
    }));
  },

  setOllamaModels: (models) =>
    set(state => ({
      models: [
        ...state.models.filter(m => m.providerId !== 'ollama'),
        ...models,
      ]
    })),

  setProviderConfigured: (providerId, configured) =>
    set(state => ({
      providers: {
        ...state.providers,
        [providerId]: { ...state.providers[providerId], isConfigured: configured },
      }
    })),

  clearForgeSession: () =>
    set(state => ({
      sessions: {
        ...state.sessions,
        [FORGE_SESSION_ID]: {
          id: FORGE_SESSION_ID,
          title: 'Forge AI',
          modelId: state.activeModelId ?? 'llama3:8b',
          messages: [],
          updatedAt: Date.now(),
        }
      }
    })),

  saveApiKey: async (providerId, key) => {
    // Send key to Rust's in-memory store (never touches disk as plain text)
    try {
      await invoke('set_api_key', { provider: providerId, key });
    } catch (e) {
      console.error('Failed to save key to Rust state:', e);
    }
    // Also keep a transient copy in the JS store for quick lookups
    set(state => ({
      apiKeys: { ...state.apiKeys, [providerId]: key },
      providers: {
        ...state.providers,
        [providerId]: {
          ...state.providers[providerId],
          isConfigured: key.length > 0,
        },
      },
    }));
  },

  getApiKey: (providerId) => get().apiKeys[providerId],
}));
