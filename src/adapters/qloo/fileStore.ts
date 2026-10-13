import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CacheMeta, CacheStore } from "./cached";
import { MemoryCacheStore } from "./cached";
import type { QuotaState, QuotaStore } from "./quota";

/** Default directory for raw Qloo data in development. Gitignored: never commit its contents. */
export const QLOO_CACHE_DIR = path.join(process.cwd(), ".qloo-cache");

/**
 * Development cache: one JSON file per entry. If the filesystem is read-only (e.g. Vercel),
 * the first failed write switches it to an in-memory store for the rest of the process.
 */
export class FileCacheStore implements CacheStore {
  private fallback?: MemoryCacheStore;

  constructor(
    private readonly dir: string = QLOO_CACHE_DIR,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string) {
    if (this.fallback) return this.fallback.get(key);
    try {
      const entry = JSON.parse(await readFile(this.file(key), "utf8")) as {
        expiresAt: number;
        value: unknown;
      };
      return entry.expiresAt > this.now() ? entry.value : undefined;
    } catch {
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlMs: number, meta?: CacheMeta) {
    if (this.fallback) return this.fallback.set(key, value, ttlMs, meta);
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(
        this.file(key),
        JSON.stringify({ expiresAt: this.now() + ttlMs, meta, value }),
      );
    } catch (error) {
      console.warn(`FileCacheStore: falling back to memory (${(error as Error).message})`);
      this.fallback = new MemoryCacheStore();
      await this.fallback.set(key, value, ttlMs, meta);
    }
  }

  get usingFallback() {
    return this.fallback !== undefined;
  }

  private file(key: string) {
    return path.join(this.dir, `${key}.json`);
  }
}

/** Persists the last-known monthly quota next to the file cache. */
export class FileQuotaStore implements QuotaStore {
  constructor(private readonly file: string = path.join(QLOO_CACHE_DIR, "quota.json")) {}

  async load(): Promise<QuotaState | undefined> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as QuotaState;
    } catch {
      return undefined;
    }
  }

  async save(state: QuotaState) {
    try {
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify(state));
    } catch {
      // Read-only filesystem: the in-memory guard state still applies.
    }
  }
}
