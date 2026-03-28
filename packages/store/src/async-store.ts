import type { SerializedPathState, PathStore } from "@daltonr/pathwrite-core";

/**
 * Minimal interface for an async key-value string storage backend.
 * `@react-native-async-storage/async-storage` satisfies this interface directly,
 * as does any other async key-value store with the same shape.
 */
export interface AsyncStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /**
   * Return every key currently held in the storage backend.
   * Required by `AsyncStorageStore.list()` and `AsyncStorageStore.clear()`.
   * Implementations that don't need those methods may omit this.
   */
  getAllKeys?(): Promise<readonly string[]>;
}

export interface AsyncStorageStoreOptions {
  /**
   * The async storage backend to use.
   * Pass `AsyncStorage` from `@react-native-async-storage/async-storage`,
   * or any object that satisfies `AsyncStorageAdapter`.
   */
  storage: AsyncStorageAdapter;
  /**
   * Prefix prepended to every storage key to avoid collisions.
   * Defaults to `"@daltonr/pathwrite:"`.
   */
  prefix?: string;
}

export class AsyncStorageStore implements PathStore {
  private prefix: string;
  private storage: AsyncStorageAdapter;

  constructor(options: AsyncStorageStoreOptions) {
    this.prefix = options.prefix ?? "@daltonr/pathwrite:";
    this.storage = options.storage;
  }

  private storageKey(key: string): string {
    return this.prefix + encodeURIComponent(key);
  }

  async save(key: string, state: SerializedPathState): Promise<void> {
    try {
      await this.storage.setItem(this.storageKey(key), JSON.stringify(state));
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async load(key: string): Promise<SerializedPathState | null> {
    try {
      const raw = await this.storage.getItem(this.storageKey(key));
      if (raw === null || raw === undefined) return null;
      return JSON.parse(raw) as SerializedPathState;
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.storage.removeItem(this.storageKey(key));
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
        "AsyncStorageStore.list() requires the AsyncStorageAdapter to implement getAllKeys(). " +
          "Pass an adapter that supports key enumeration, such as @react-native-async-storage/async-storage."
      );
    }
    try {
      const allKeys = await this.storage.getAllKeys();
      return Array.from(allKeys)
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
