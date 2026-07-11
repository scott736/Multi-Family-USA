// ============================================
// Filesystem-Backed API Response Cache
// ============================================

import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";

const CACHE_ROOT = path.resolve("src/data/api-cache");
const MEMORY_LRU_CAP = 200;

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ----------------
// In-memory LRU (simple Map-backed, insertion-order eviction)
// ----------------

const memoryCache = new Map<string, CacheEntry<unknown>>();

function memoryGet<T>(cacheKey: string): CacheEntry<T> | undefined {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return undefined;
  // Refresh recency by re-inserting
  memoryCache.delete(cacheKey);
  memoryCache.set(cacheKey, entry);
  return entry as CacheEntry<T>;
}

function memorySet<T>(cacheKey: string, entry: CacheEntry<T>): void {
  if (memoryCache.has(cacheKey)) {
    memoryCache.delete(cacheKey);
  } else if (memoryCache.size >= MEMORY_LRU_CAP) {
    // Evict oldest (first inserted)
    const firstKey = memoryCache.keys().next().value;
    if (firstKey !== undefined) memoryCache.delete(firstKey);
  }
  memoryCache.set(cacheKey, entry);
}

function memoryDelete(cacheKey: string): void {
  memoryCache.delete(cacheKey);
}

// ----------------
// Path helpers
// ----------------

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function cacheFilePath(namespace: string, key: string): string {
  return path.join(CACHE_ROOT, namespace, `${hashKey(key)}.json`);
}

function cacheMemoryKey(namespace: string, key: string): string {
  return `${namespace}:${hashKey(key)}`;
}

// ----------------
// Public API
// ----------------

/**
 * Read-through cache with TTL. If a fresh cached value exists, returns it.
 * Otherwise calls `fetcher()`, persists the result, and returns it.
 *
 * - Cache files: src/data/api-cache/{namespace}/{sha256(key).slice(0,16)}.json
 * - Payload: { data: T, expiresAt: number (epoch ms) }
 * - Errors from `fetcher` propagate (no stale-on-error fallback).
 * - Caller is responsible for supplying filesystem-safe `namespace` values.
 */
export async function getCached<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const memKey = cacheMemoryKey(namespace, key);
  const now = Date.now();

  // 1. Try in-memory LRU
  const mem = memoryGet<T>(memKey);
  if (mem && mem.expiresAt > now) {
    return mem.data;
  }

  // 2. Try filesystem
  const filePath = cacheFilePath(namespace, key);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (typeof entry.expiresAt === "number" && entry.expiresAt > now) {
      memorySet(memKey, entry);
      return entry.data;
    }
  } catch (error: unknown) {
    // ENOENT is expected on cache miss; anything else we log and continue.
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code && code !== "ENOENT") {
      console.warn(
        `[api-cache] Failed to read ${namespace} cache entry: ${String(error)}`
      );
    }
  }

  // 3. Fetch, persist, return
  const data = await fetcher();
  const entry: CacheEntry<T> = { data, expiresAt: now + ttlMs };

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(entry), "utf-8");
  } catch (error) {
    console.warn(
      `[api-cache] Failed to write ${namespace} cache entry: ${String(error)}`
    );
  }

  memorySet(memKey, entry);
  return data;
}

/**
 * Invalidate cache entries. If `key` is provided, removes just that entry;
 * otherwise removes every entry in the namespace.
 */