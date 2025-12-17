/**
 * Official Token Addresses Whitelist
 * These are the canonical, official token addresses that should ALWAYS appear first in search results
 * This ensures users see the real tokens (like MetaMask does) instead of spam/clones
 */

export const OFFICIAL_TOKENS: Record<string, Record<string, string>> = {
  solana: {
    // Official USDT on Solana (Tether)
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
    // Official USDC on Solana (Circle)
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    // Official RAY (Raydium)
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
    // Official BONK
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
    // Official JUP (Jupiter)
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
    // Official WIF (dogwifhat)
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 'WIF',
  },
  ethereum: {
    // Official USDT (Tether)
    '0xdAC17F958D2ee523a2206206994597C13D831ec7': 'USDT',
    // Official USDC (Circle)
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
    // Official WBTC
    '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'WBTC',
    // Official LINK
    '0x514910771AF9Ca656af840dff83E8264EcF986CA': 'LINK',
  },
  polygon: {
    '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT',
    '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': 'USDC',
  },
  bsc: {
    '0x55d398326f99059fF775485246999027B3197955': 'USDT',
    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d': 'USDC',
  },
  arbitrum: {
    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9': 'USDT',
    '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8': 'USDC',
  },
  base: {
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': 'USDC',
  },
  optimism: {
    '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58': 'USDT',
    '0x7F5c764cBc14f9669B88837ca1490cCa17c31607': 'USDC',
  },
  avalanche: {
    '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7': 'USDT',
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E': 'USDC',
  },
  cronos: {
    '0x66e428c3f67a68878562e79A0234c1F83c208770': 'USDT',
    '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59': 'USDC',
  },
  zksync: {
    '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C': 'USDT',
    '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4': 'USDC',
  },
  linea: {
    '0xA219439258ca9da29E9Cc4cE5596924745e12B93': 'USDT',
    '0x176211869cA2b568f2A7D4EE941E073a821EE1ff': 'USDC',
  },
};

/**
 * Check if a token address is the official/canonical address for its symbol
 */
export function isOfficialToken(chainKey: string, address: string): boolean {
  const chainTokens = OFFICIAL_TOKENS[chainKey];
  if (!chainTokens) return false;
  return address.toLowerCase() in Object.keys(chainTokens).reduce((acc, key) => {
    acc[key.toLowerCase()] = true;
    return acc;
  }, {} as Record<string, boolean>);
}

/**
 * Get the official token address for a symbol on a chain
 */
export function getOfficialTokenAddress(chainKey: string, symbol: string): string | null {
  const chainTokens = OFFICIAL_TOKENS[chainKey];
  if (!chainTokens) return null;
  
  const symbolUpper = symbol.toUpperCase();
  for (const [address, officialSymbol] of Object.entries(chainTokens)) {
    if (officialSymbol.toUpperCase() === symbolUpper) {
      return address;
    }
  }
  return null;
}

