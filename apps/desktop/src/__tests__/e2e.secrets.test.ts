/**
 * E2E Test: OS-Native Secrets Management Pipeline
 *
 * Validates the full store_secret → retrieve_secret → delete_secret lifecycle
 * using the mocked Tauri IPC bridge, and validates loadApiKeys() hydration.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAiStore } from '@/core/store/useAiStore';

beforeEach(() => {
  // Reset to fresh provider/key state before each test
  useAiStore.setState(state => ({
    apiKeys: {},
    providers: Object.fromEntries(
      Object.entries(state.providers).map(([k, v]) => [k, { ...v, isConfigured: false }])
    ) as typeof state.providers,
  }));
});

// ── Store Secret ───────────────────────────────────────────────────────────────

describe('Secrets — Save', () => {
  it('should store a secret via the OS keychain bridge', async () => {
    const { saveApiKey } = useAiStore.getState();
    await saveApiKey('openai', 'sk-test-1234');

    const state = useAiStore.getState();
    // Should be available in transient JS state
    expect(state.apiKeys['openai']).toBe('sk-test-1234');
  });

  it('should mark the provider as configured after saving a key', async () => {
    await useAiStore.getState().saveApiKey('anthropic', 'sk-ant-test');
    const state = useAiStore.getState();
    expect(state.providers['anthropic'].isConfigured).toBe(true);
  });

  it('should mark the provider as NOT configured when saving an empty key', async () => {
    await useAiStore.getState().saveApiKey('openai', 'sk-temp');
    await useAiStore.getState().saveApiKey('openai', '');

    const state = useAiStore.getState();
    expect(state.providers['openai'].isConfigured).toBe(false);
  });
});

// ── Load / Hydrate Secrets ─────────────────────────────────────────────────────

describe('Secrets — Load (Hydration)', () => {
  it('should load a previously stored key back into the store', async () => {
    // First save into the mock OS keychain
    await useAiStore.getState().saveApiKey('openai', 'sk-recovered-key');

    // Clear the in-memory JS state to simulate an app restart
    useAiStore.setState({ apiKeys: {} });
    expect(useAiStore.getState().apiKeys['openai']).toBeUndefined();

    // Now trigger startup hydration
    await useAiStore.getState().loadApiKeys();

    const state = useAiStore.getState();
    expect(state.apiKeys['openai']).toBe('sk-recovered-key');
    expect(state.providers['openai'].isConfigured).toBe(true);
  });

  it('should gracefully handle missing keys on hydration (no throw)', async () => {
    // No keys stored — loadApiKeys should not throw
    await expect(useAiStore.getState().loadApiKeys()).resolves.not.toThrow();
    const state = useAiStore.getState();
    // Providers should remain unconfigured
    expect(state.providers['openai'].isConfigured).toBe(false);
    expect(state.providers['anthropic'].isConfigured).toBe(false);
  });

  it('should load multiple provider keys on hydration', async () => {
    await useAiStore.getState().saveApiKey('openai', 'sk-openai');
    await useAiStore.getState().saveApiKey('anthropic', 'sk-anthropic');

    // Simulate restart
    useAiStore.setState({ apiKeys: {} });

    await useAiStore.getState().loadApiKeys();

    const state = useAiStore.getState();
    expect(state.apiKeys['openai']).toBe('sk-openai');
    expect(state.apiKeys['anthropic']).toBe('sk-anthropic');
  });
});

// ── Delete Secret ─────────────────────────────────────────────────────────────

describe('Secrets — Delete', () => {
  it('should remove key from OS store when saving empty string', async () => {
    await useAiStore.getState().saveApiKey('openai', 'sk-will-be-deleted');
    await useAiStore.getState().saveApiKey('openai', '');

    // Clear in-memory state and verify keychain is also empty
    useAiStore.setState({ apiKeys: {} });
    await useAiStore.getState().loadApiKeys();

    const state = useAiStore.getState();
    expect(state.apiKeys['openai']).toBeUndefined();
    expect(state.providers['openai'].isConfigured).toBe(false);
  });
});
