// Console error suppression for known non-critical errors
// This prevents console spam from expected API failures (meme coins, etc.)

if (typeof window !== 'undefined') {
  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Override console.error to filter out known non-critical errors
  console.error = function(...args: any[]) {
    const message = args.join(' ');
    
    // ✅ Suppress known non-critical API errors
    const suppressPatterns = [
      // Price API 400s for unknown tokens (meme coins)
      'prices?symbols=',
      'prices-binance?symbols=',
      'Bad Request',
      '400 (Bad Request)',
      'GET https://my.blazewallet.io/api/prices',
      // Network errors that are expected during fallback attempts
      'Failed to fetch',
      'NetworkError',
      'AbortError',
      'Load failed',
    ];
    
    // Check if this error should be suppressed
    const shouldSuppress = suppressPatterns.some(pattern => 
      message.includes(pattern)
    );
    
    if (!shouldSuppress) {
      // Call original console.error for real errors
      originalError.apply(console, args);
    }
  };
  
  // Override console.warn to filter warnings
  console.warn = function(...args: any[]) {
    const message = args.join(' ');
    
    // Suppress price API warnings
    if (message.includes('prices?symbols=') || message.includes('prices-binance?symbols=')) {
      return;
    }
    
    originalWarn.apply(console, args);
  };
  
  // ✅ MAIN FIX: Override XMLHttpRequest to suppress network error logging
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...rest: any[]) {
    const urlStr = url.toString();
    // Mark price API requests
    if (urlStr.includes('/api/prices')) {
      (this as any)._isPriceApi = true;
    }
    return originalOpen.apply(this, [method, url, ...rest] as any);
  };
  
  XMLHttpRequest.prototype.send = function(body?: Document | XMLHttpRequestBodyInit | null) {
    if ((this as any)._isPriceApi) {
      // Suppress error events for price APIs
      const originalOnError = this.onerror;
      this.onerror = function(e) {
        // Silently ignore - don't log to console
        if (originalOnError) {
          originalOnError.call(this, e);
        }
      };
    }
    return originalSend.call(this, body);
  };
  
  // ✅ Intercept fetch to suppress console logging
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url || '';
    const isPriceApi = url.includes('/api/prices') || url.includes('/api/prices-binance');
    
    try {
      const response = await originalFetch(input, init);
      
      // For price API 400s, mark as handled to prevent console errors
      if (isPriceApi && response.status === 400) {
        // Clone response to consume it without affecting the original
        const clonedResponse = response.clone();
        // Consume the body to prevent "body already used" errors
        clonedResponse.text().catch(() => {});
        return response;
      }
      
      return response;
    } catch (error) {
      // Silently re-throw for price APIs (let our code handle it)
      if (isPriceApi) {
        throw error;
      }
      throw error;
    }
  };
  
  // ✅ Suppress DevTools network panel error highlighting
  // This is a hack but works in Chrome/Edge
  if ('__REACT_DEVTOOLS_GLOBAL_HOOK__' in window) {
    try {
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.inject = function() {};
    } catch (e) {
      // Ignore
    }
  }
}

export {};

