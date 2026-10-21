import { useSyncExternalStore } from 'react';
import * as initial from './index';

export type CityRegistry = typeof initial;

let registry: CityRegistry = initial;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The city registry. In development an edited city module swaps in a fresh
 * registry (and with it a fresh module cache) without reloading the page.
 * Runtime imports of `./index` belong here only, so that edit stops at this
 * module's HMR boundary instead of remounting the app.
 */
export function useCityRegistry(): CityRegistry {
  return useSyncExternalStore(subscribe, () => registry);
}

if (import.meta.hot) {
  import.meta.hot.accept('./index', (mod) => {
    if (!mod) return;
    // Vite types accepted modules as a loose namespace; this is our own registry module.
    registry = mod as unknown as CityRegistry;
    for (const listener of listeners) listener();
  });
}
