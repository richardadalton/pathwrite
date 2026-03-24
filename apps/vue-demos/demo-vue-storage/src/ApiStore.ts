import type { SerializedPathState } from "@daltonr/pathwrite-vue";
import type { PathStore } from "@daltonr/pathwrite-core";

/**
 * HttpStore with list() support that uses GET /api/state to enumerate keys.
 * This extends the standard HttpStore pattern to support session listing.
 */
export class ApiStore implements PathStore {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3001/api") {
    this.baseUrl = baseUrl;
  }

  async save(key: string, state: SerializedPathState): Promise<void> {
    const response = await fetch(`${this.baseUrl}/state/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      throw new Error(`Failed to save: ${response.status} ${response.statusText}`);
    }
  }

  async load(key: string): Promise<SerializedPathState | null> {
    const response = await fetch(`${this.baseUrl}/state/${encodeURIComponent(key)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to load: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/state/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });

    if (response.status === 404) {
      return; // Already gone
    }

    if (!response.ok) {
      throw new Error(`Failed to delete: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * List all snapshot keys stored on the server.
   * Uses GET /api/state which returns { keys: string[] }
   */
  async list(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/state`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to list: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.keys || [];
  }

  /**
   * Delete all snapshots by listing then deleting each one.
   */
  async clear(): Promise<void> {
    const keys = await this.list();
    await Promise.all(keys.map((key) => this.delete(key)));
  }
}

