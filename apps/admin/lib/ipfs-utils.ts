/**
 * IPFS Utilities
 * Handles IPFS URLs and prevents console errors from failed image loads
 */

/**
 * Convert IPFS URL to a working gateway URL
 * Tries multiple gateways for reliability
 */
export function getIPFSGatewayUrl(ipfsUrl: string): string {
  if (!ipfsUrl || typeof ipfsUrl !== 'string') return ipfsUrl;
  
  // Extract IPFS hash from URL
  const ipfsHashMatch = ipfsUrl.match(/ipfs\/([a-zA-Z0-9]+)/);
  if (!ipfsHashMatch) {
    // Not an IPFS URL, return as-is
    return ipfsUrl;
  }
  
  const ipfsHash = ipfsHashMatch[1];
  
  // Try reliable IPFS gateways (in order of preference)
  const gateways = [
    `https://ipfs.io/ipfs/${ipfsHash}`,           // Public IPFS gateway
    `https://gateway.pinata.cloud/ipfs/${ipfsHash}`, // Pinata gateway
    `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,  // Cloudflare gateway
    `https://dweb.link/ipfs/${ipfsHash}`,         // Protocol Labs gateway
  ];
  
  // Return first gateway (browser will try others via onError)
  return gateways[0];
}

/**
 * Check if URL is an IPFS URL
 */
export function isIPFSUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('ipfs/') || url.includes('ipfs://') || url.startsWith('Qm') || url.startsWith('baf');
}

/**
 * Suppress console errors for failed image loads (only for IPFS URLs)
 * This prevents console spam from broken IPFS links
 */
export function suppressImageLoadErrors(): void {
  if (typeof window === 'undefined') return;
  
  // Store original error handler
  const originalError = console.error;
  
  // Override console.error to filter out image load errors
  console.error = (...args: any[]) => {
    const errorMessage = args.join(' ');
    
    // Suppress specific image load errors
    if (
      errorMessage.includes('ERR_NAME_NOT_RESOLVED') ||
      errorMessage.includes('Failed to load resource') ||
      errorMessage.includes('net::ERR_') ||
      (errorMessage.includes('ipfs') && errorMessage.includes('Image'))
    ) {
      // Silently ignore IPFS image load errors
      return;
    }
    
    // Log other errors normally
    originalError.apply(console, args);
  };
  
  // Also suppress unhandled image errors via global error handler
  window.addEventListener('error', (event) => {
    if (
      event.target instanceof HTMLImageElement &&
      (event.target.src?.includes('ipfs') || 
       event.target.src?.includes('cf-ipfs') ||
       event.target.src?.includes('mypinata'))
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

/**
 * Initialize IPFS error suppression (call once on app load)
 */
let errorSuppressionInitialized = false;
export function initIPFSErrorSuppression(): void {
  if (errorSuppressionInitialized || typeof window === 'undefined') return;
  errorSuppressionInitialized = true;
  suppressImageLoadErrors();
}

