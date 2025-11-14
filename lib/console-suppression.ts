// Console error suppression for known non-critical errors
// This prevents console spam from expected API failures (meme coins, etc.)

if (typeof window !== 'undefined') {
  // Store original console.error
  const originalError = console.error;
  
  // Override console.error to filter out known non-critical errors
  console.error = function(...args: any[]) {
    const message = args.join(' ');
    
    // ✅ Suppress known non-critical API errors
    const suppressPatterns = [
      // Price API 400s for unknown tokens (meme coins)
      'prices?symbols=',
      'prices-binance?symbols=',
      'Bad Request',
      // Network errors that are expected during fallback attempts
      'Failed to fetch',
      'NetworkError',
      'AbortError',
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
  
  // Also suppress fetch rejections for price APIs in the browser
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
      const response = await originalFetch(input, init);
      
      // For price API 400s, don't let them bubble as errors
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url || '';
      if ((url.includes('/api/prices') || url.includes('/api/prices-binance')) && 
          response.status === 400) {
        // Return the response normally, but don't log error
        return response;
      }
      
      return response;
    } catch (error) {
      // For price API errors, suppress console logging
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url || '';
      if (url.includes('/api/prices') || url.includes('/api/prices-binance')) {
        // Suppress the error but still throw it for code to catch
        throw error;
      }
      throw error;
    }
  };
}

export {};

