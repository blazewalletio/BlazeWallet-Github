/**
 * API Queue System
 * 
 * Features:
 * - Client-side rate limiting to prevent API overload
 * - Max 3 concurrent requests
 * - 200ms delay between batches
 * - Automatic queue processing
 * - Prevents 429 rate limit errors during peak traffic
 */

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

class APIQueue {
  private queue: QueuedRequest<any>[] = [];
  private processing = false;
  private maxConcurrent = 3; // Max 3 requests at once
  private batchDelay = 200; // 200ms between batches
  private activeRequests = 0;

  /**
   * Add a request to the queue
   */
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0 || this.activeRequests > 0) {
      // Process requests in batches
      while (this.activeRequests < this.maxConcurrent && this.queue.length > 0) {
        const request = this.queue.shift();
        if (!request) break;

        this.activeRequests++;
        
        // Execute request
        request.fn()
          .then(request.resolve)
          .catch(request.reject)
          .finally(() => {
            this.activeRequests--;
          });
      }

      // Wait for at least one request to complete
      if (this.activeRequests > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Delay between batches to respect rate limits
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.batchDelay));
      }
    }

    this.processing = false;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear the queue (emergency stop)
   */
  clear(): void {
    this.queue = [];
  }
}

// Singleton instance
export const apiQueue = new APIQueue();

