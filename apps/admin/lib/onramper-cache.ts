// Onramper API Cache
// Implements caching strategy to protect against rate limits

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class OnramperCache {
  private static quotesCache = new Map<string, CacheEntry<any[]>>();
  private static providersCache = new Map<string, CacheEntry<any[]>>();
  private static paymentMethodsCache = new Map<string, CacheEntry<any[]>>();
  private static defaultsCache = new Map<string, CacheEntry<any>>();

  // Cache durations (in milliseconds)
  private static readonly QUOTES_TTL = 30 * 1000; // 30 seconds
  private static readonly PROVIDERS_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly PAYMENT_METHODS_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly DEFAULTS_TTL = 60 * 60 * 1000; // 1 hour

  /**
   * Get cached quotes
   */
  static getQuotes(key: string): any[] | null {
    const cached = this.quotesCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.QUOTES_TTL) {
      return cached.data;
    }
    this.quotesCache.delete(key);
    return null;
  }

  /**
   * Set cached quotes
   */
  static setQuotes(key: string, data: any[]): void {
    this.quotesCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached providers
   */
  static getProviders(key: string): any[] | null {
    const cached = this.providersCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.PROVIDERS_TTL) {
      return cached.data;
    }
    this.providersCache.delete(key);
    return null;
  }

  /**
   * Set cached providers
   */
  static setProviders(key: string, data: any[]): void {
    this.providersCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached payment methods
   */
  static getPaymentMethods(key: string): any[] | null {
    const cached = this.paymentMethodsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.PAYMENT_METHODS_TTL) {
      return cached.data;
    }
    this.paymentMethodsCache.delete(key);
    return null;
  }

  /**
   * Set cached payment methods
   */
  static setPaymentMethods(key: string, data: any[]): void {
    this.paymentMethodsCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Get cached defaults
   */
  static getDefaults(key: string): any | null {
    const cached = this.defaultsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.DEFAULTS_TTL) {
      return cached.data;
    }
    this.defaultsCache.delete(key);
    return null;
  }

  /**
   * Set cached defaults
   */
  static setDefaults(key: string, data: any): void {
    this.defaultsCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all caches
   */
  static clearAll(): void {
    this.quotesCache.clear();
    this.providersCache.clear();
    this.paymentMethodsCache.clear();
    this.defaultsCache.clear();
  }

  /**
   * Clear expired entries
   */
  static clearExpired(): void {
    const now = Date.now();
    
    // Clear expired quotes
    for (const [key, entry] of this.quotesCache.entries()) {
      if (now - entry.timestamp >= this.QUOTES_TTL) {
        this.quotesCache.delete(key);
      }
    }
    
    // Clear expired providers
    for (const [key, entry] of this.providersCache.entries()) {
      if (now - entry.timestamp >= this.PROVIDERS_TTL) {
        this.providersCache.delete(key);
      }
    }
    
    // Clear expired payment methods
    for (const [key, entry] of this.paymentMethodsCache.entries()) {
      if (now - entry.timestamp >= this.PAYMENT_METHODS_TTL) {
        this.paymentMethodsCache.delete(key);
      }
    }
    
    // Clear expired defaults
    for (const [key, entry] of this.defaultsCache.entries()) {
      if (now - entry.timestamp >= this.DEFAULTS_TTL) {
        this.defaultsCache.delete(key);
      }
    }
  }
}

// Auto-cleanup expired entries every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    OnramperCache.clearExpired();
  }, 5 * 60 * 1000);
}

export { OnramperCache };

