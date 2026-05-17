import { LazyStore } from '@tauri-apps/plugin-store';
import type { StoreApi } from 'zustand';

// The local file where all state will be saved
const store = new LazyStore('aetherdesk-state.bin');

/**
 * Hydrates a Zustand store from disk and sets up an auto-save subscription.
 *
 * @param key The unique key in the store (e.g., 'workflow-state')
 * @param useStore The Zustand store to bind
 * @param keysToPersist An array of state keys to save to disk. State not listed here will be ignored.
 */
export async function hydrateStore<T extends object>(
  key: string,
  useStore: { getState: () => T; setState: (partial: Partial<T>) => void; subscribe: StoreApi<T>['subscribe'] },
  keysToPersist: (keyof T)[]
) {
  try {
    // 1. Read existing data from disk
    const savedState = await store.get<Partial<T>>(key);

    // 2. Hydrate the store if data exists and is an object
    if (savedState && typeof savedState === 'object' && !Array.isArray(savedState)) {
      console.log(`[Persistence] Hydrating ${key}...`);
      useStore.setState(savedState);
    }

    // 3. Setup subscription to automatically save changes
    let debounceTimer: ReturnType<typeof setTimeout>;

    useStore.subscribe((state) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        // Extract only the keys we want to persist
        const stateToSave = keysToPersist.reduce((acc, k) => {
          acc[k] = state[k];
          return acc;
        }, {} as Partial<T>);

        await store.set(key, stateToSave);
        await store.save(); // Write to disk
      }, 1000); // Debounce saves by 1 second to minimize I/O
    });
  } catch (err) {
    console.error(`[Persistence] Failed to hydrate store for key: ${key}`, err);
  }
}
