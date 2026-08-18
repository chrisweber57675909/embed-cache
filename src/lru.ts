export interface LruOptions {
  maxEntries?: number;
  maxBytes?: number;
}

/**
 * Byte-aware LRU. Insertion order in the backing Map doubles as recency
 * order: a get() re-inserts the key so it moves to the "newest" end, and
 * eviction walks from the front, which is always the least recently used.
 */
export class Lru {
  readonly #map = new Map<string, Float32Array>();
  readonly #maxEntries: number;
  readonly #maxBytes: number;
  #bytes = 0;

  constructor(options: LruOptions = {}) {
    this.#maxEntries = options.maxEntries ?? Infinity;
    this.#maxBytes = options.maxBytes ?? Infinity;
  }

  get size(): number {
    return this.#map.size;
  }

  get bytes(): number {
    return this.#bytes;
  }

  has(key: string): boolean {
    return this.#map.has(key);
  }

  get(key: string): Float32Array | undefined {
    const value = this.#map.get(key);
    if (value === undefined) return undefined;
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  set(key: string, value: Float32Array): void {
    const existing = this.#map.get(key);
    if (existing !== undefined) {
      this.#bytes -= existing.byteLength;
      this.#map.delete(key);
    }
    this.#map.set(key, value);
    this.#bytes += value.byteLength;
    this.#evict();
  }

  delete(key: string): boolean {
    const existing = this.#map.get(key);
    if (existing === undefined) return false;
    this.#bytes -= existing.byteLength;
    return this.#map.delete(key);
  }

  clear(): void {
    this.#map.clear();
    this.#bytes = 0;
  }

  #evict(): void {
    for (const [key, value] of this.#map) {
      if (this.#map.size <= this.#maxEntries && this.#bytes <= this.#maxBytes) break;
      this.#map.delete(key);
      this.#bytes -= value.byteLength;
    }
  }
}
