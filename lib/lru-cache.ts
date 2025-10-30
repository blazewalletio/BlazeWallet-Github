/**
 * 🚀 LRU (Least Recently Used) Cache
 * 
 * Fast in-memory cache with automatic eviction of least-used items
 * - O(1) get/set operations
 * - Automatic size management
 * - TTL support per entry
 * - Perfect for price data, balances, etc.
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get value from cache
   * Returns null if not found or expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Remove if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Add to end (most recently used)
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(1) : '0';
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Get current size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all entries (for debugging/stats)
   */
  entries(): IterableIterator<[string, CacheEntry<T>]> {
    return this.cache.entries();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Export singleton instances for common use cases
export const priceCache = new LRUCache<number>(200); // 200 price entries
export const balanceCache = new LRUCache<string>(50); // 50 balance entries
export const metadataCache = new LRUCache<any>(100); // 100 metadata entries

