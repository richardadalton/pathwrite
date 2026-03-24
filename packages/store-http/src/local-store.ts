import type { SerializedPathState, PathStore } from "@daltonr/pathwrite-core";

/**
 * Minimal interface for a key-value string storage backend.
 * Both `localStorage` and `sessionStorage` satisfy this interface, as does
 * any custom stub you inject for testing or SSR environments.
 */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /**
   * Return every key currently held in the storage backend.
   * Required by `LocalStorageStore.list()` and `LocalStorageStore.clear()`.
   * Implementations that don't need those methods may omit this.
   */
  getAllKeys?(): string[];
}

export interface LocalStorageStoreOptions {
  /**
   * Prefix prepended to every storage key to avoid collisions.
   * Defaults to `"@daltonr/pathwrite:"`.
   */
  prefix?: string;
  /**
   * Storage backend to use.
   * - Omit (or `undefined`): uses global `localStorage` when available, otherwise falls back to
   *   an in-process memory store (useful in Node / test environments).
   * - Pass a `StorageAdapter` (e.g. `sessionStorage`, or a custom stub): uses that object.
   * - Pass `null`: forces the in-memory fallback regardless of environment.
   */
  storage?: StorageAdapter | null;
}

function createMemoryStorage(): StorageAdapter {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    getAllKeys() {
      return Array.from(map.keys());
    },
  };
}

export class LocalStorageStore implements PathStore {
  private prefix: string;
  private storage: StorageAdapter;

  constructor(options: LocalStorageStoreOptions = {}) {
    this.prefix = options.prefix ?? "@daltonr/pathwrite:";

    if (options.storage !== undefined) {
      this.storage = options.storage !== null ? options.storage : createMemoryStorage();
    } else if (typeof localStorage !== "undefined") {
      this.storage = {
        getItem: (k: string) => localStorage.getItem(k),
        setItem: (k: string, v: string) => localStorage.setItem(k, v),
        removeItem: (k: string) => localStorage.removeItem(k),
        getAllKeys: () => {
          const keys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k !== null) keys.push(k);
          }
          return keys;
        },
      };
    } else {
      this.storage = createMemoryStorage();
    }
  }

  private storageKey(key: string): string {
    return this.prefix + encodeURIComponent(key);
  }

  async save(key: string, state: SerializedPathState): Promise<void> {
    try {
      this.storage.setItem(this.storageKey(key), JSON.stringify(state));
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async load(key: string): Promise<SerializedPathState | null> {
    try {
      const raw = this.storage.getItem(this.storageKey(key));
      if (raw === null || raw === undefined) return null;
      return JSON.parse(raw) as SerializedPathState;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async delete(key: string): Promise<void> {
    try {
      this.storage.removeItem(this.storageKey(key));
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  /**
   * Returns every key stored under this store's prefix, decoded back to the
   * original key strings passed to `save()`.
   *
   * Requires the underlying `StorageAdapter` to implement `getAllKeys()`.
   * Throws if the adapter does not support key enumeration.
   *
   * ```ts
   * const store = new LocalStorageStore({ prefix: "app:" });
   * await store.save("wizard-a", stateA);
   * await store.save("wizard-b", stateB);
   * await store.list(); // → ["wizard-a", "wizard-b"]
   * ```
   */
  async list(): Promise<string[]> {
    if (!this.storage.getAllKeys) {
      throw new Error(
        "LocalStorageStore.list() requires the StorageAdapter to implement getAllKeys(). " +
          "Add getAllKeys() to your custom adapter or use the built-in localStorage/memory backends."
      );
    }
    try {
      return this.storage
        .getAllKeys()
        .filter((k) => k.startsWith(this.prefix))
        .map((k) => decodeURIComponent(k.slice(this.prefix.length)));
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  /**
   * Removes every entry stored under this store's prefix.
   * Useful for "log out" / "reset all" scenarios.
   *
   * Requires the underlying `StorageAdapter` to implement `getAllKeys()`.
   */
  async clear(): Promise<void> {
    const keys = await this.list();
    for (const key of keys) {
      await this.delete(key);
    }
  }
}
