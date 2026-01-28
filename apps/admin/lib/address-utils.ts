import { ethers } from 'ethers';
import { logger } from './logger';

/**
 * Validate and normalize an Ethereum address to EIP-55 checksum format
 * 
 * @param address - The address to validate and checksum
 * @returns Checksummed address or throws error if invalid
 * 
 * @example
 * ```typescript
 * const addr = '0x742d35cc6634c0532925a3b844bc9e7595f0beb';
 * const checksummed = getChecksumAddress(addr);
 * // Returns: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'
 * ```
 */
export function getChecksumAddress(address: string): string {
  try {
    // ethers.getAddress() validates and returns checksummed address
    // Throws if address is invalid
    return ethers.getAddress(address);
  } catch (error: any) {
    logger.error('❌ Invalid Ethereum address:', {
      address,
      error: error.message,
    });
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
}

/**
 * Check if an address is a valid Ethereum address
 * Does NOT throw, returns boolean
 * 
 * @param address - The address to validate
 * @returns true if valid, false otherwise
 */
export function isValidEthereumAddress(address: string): boolean {
  try {
    ethers.getAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure all addresses in a list are checksummed
 * Filters out invalid addresses
 * 
 * @param addresses - Array of addresses
 * @returns Array of checksummed addresses (invalid ones removed)
 */
export function checksumAddresses(addresses: string[]): string[] {
  return addresses
    .map(addr => {
      try {
        return ethers.getAddress(addr);
      } catch {
        logger.warn('⚠️ Invalid address filtered out:', addr);
        return null;
      }
    })
    .filter((addr): addr is string => addr !== null);
}

/**
 * Get checksum address with fallback
 * Returns null instead of throwing if address is invalid
 * 
 * @param address - The address to checksum
 * @returns Checksummed address or null if invalid
 */
export function getChecksumAddressSafe(address: string | null | undefined): string | null {
  if (!address) return null;
  
  try {
    return ethers.getAddress(address);
  } catch {
    logger.warn('⚠️ Could not checksum address:', address);
    return null;
  }
}

