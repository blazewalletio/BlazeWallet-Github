/**
 * Li.Fi Chain ID Mapping
 * 
 * According to Li.Fi documentation, chain IDs can be either:
 * - Numeric chain ID (for EVM chains)
 * - String chain ID (for non-EVM chains like Solana)
 * 
 * Source: https://docs.li.fi/introduction/chains
 */

/**
 * Li.Fi Chain ID Mapping
 * 
 * CRITICAL: Solana uses string ID "1151111081099710", not numeric 101!
 * Source: https://docs.li.fi/introduction/chains
 * 
 * Chain IDs can be:
 * - Numeric (EVM chains): 1, 137, 56, etc.
 * - String (Non-EVM): "1151111081099710" for Solana
 */
export const LIFI_CHAIN_IDS: Record<string, string | number> = {
  // EVM Chains (numeric IDs - match standard chain IDs)
  ethereum: 1,
  optimism: 10,
  bsc: 56,
  gnosis: 100,
  polygon: 137,
  fantom: 250,
  arbitrum: 42161,
  avalanche: 43114,
  base: 8453,
  zksync: 324,
  linea: 59144,
  cronos: 25,
  
  // Non-EVM Chains (string IDs)
  // ✅ CRITICAL: Solana chain ID in Li.Fi is "1151111081099710" (string), NOT 101!
  // According to docs: https://docs.li.fi/introduction/chains
  solana: '1151111081099710',
};

// Chains that exist in LI.FI mapping but are temporarily disabled in wallet UX/runtime.
const TEMPORARILY_DISABLED_LIFI_CHAIN_KEYS = new Set<string>([
  'fantom',
]);

/**
 * Get Li.Fi chain ID for a chain key
 */
export function getLiFiChainId(chainKey: string): string | number | undefined {
  return LIFI_CHAIN_IDS[chainKey];
}

export function isLiFiChainKeySupported(chainKey: string): boolean {
  return Object.prototype.hasOwnProperty.call(LIFI_CHAIN_IDS, chainKey) &&
    !TEMPORARILY_DISABLED_LIFI_CHAIN_KEYS.has(chainKey);
}

export function getLiFiSupportedChainKeys(): string[] {
  return Object.keys(LIFI_CHAIN_IDS).filter(isLiFiChainKeySupported);
}

/**
 * Check if chain ID is Solana
 */
export function isSolanaChainId(chainId: string | number): boolean {
  return chainId === '1151111081099710' || chainId === 101;
}

export function isLiFiChainIdSupported(chainId: string | number): boolean {
  const normalizedChainId = typeof chainId === 'number' ? chainId.toString() : chainId;

  return Object.entries(LIFI_CHAIN_IDS).some(([chainKey, mappedId]) => {
    if (TEMPORARILY_DISABLED_LIFI_CHAIN_KEYS.has(chainKey)) {
      return false;
    }

    return mappedId.toString() === normalizedChainId.toString();
  });
}

