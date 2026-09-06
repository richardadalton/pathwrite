import { UnusableStateError } from "./errors.js";
import type { SerializedPathState, PathStore } from "@daltonr/pathwrite-core";

/**
 * Minimal interface for a synchronous key-value string storage backend.
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

/**
 * Whether `localStorage` can be touched at all. In a sandboxed iframe, or with
 * site data blocked, merely *reading* `localStorage` throws a SecurityError —
 * `typeof localStorage` included — so the probe has to be wrapped.
 */
function localStorageIsUsable(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    console.warn(
      "[pathwrite] localStorage is not accessible here (sandboxed frame or blocked storage); LocalStorageStore is using in-memory storage for this session."
    );
    return false;
  }
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
    } else if (localStorageIsUsable()) {
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
    const raw = this.storage.getItem(this.storageKey(key));
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as SerializedPathState;
    } catch (err) {
      // We read the record; its contents are not JSON. That is a property of
      // the record, not of the storage, so it is reported as unusable and
      // restoreOrStart may clear it. A getItem() failure above is left to
      // propagate as-is: it says nothing about the record.
      throw new UnusableStateError(
        `LocalStorageStore.load: the stored value for "${key}" is not valid JSON.`,
        { cause: err }
      );
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
   */
  async clear(): Promise<void> {
    const keys = await this.list();
    for (const key of keys) {
      await this.delete(key);
    }
  }
}
