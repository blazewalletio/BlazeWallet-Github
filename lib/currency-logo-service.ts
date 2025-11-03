/**
 * 🎨 Currency Logo Service
 * 
 * Dynamically fetches cryptocurrency logos from multiple sources
 * This ensures EVERY currency/token has the correct logo
 * 
 * Sources (in priority order):
 * 1. CoinGecko API - 10,000+ cryptocurrencies
 * 2. CryptoCompare API - 6,000+ cryptocurrencies
 * 3. Local fallback logos for major currencies
 */

interface CurrencyLogoCache {
  [key: string]: {
    logo: string;
    timestamp: number;
  };
}

// In-memory cache (24 hour TTL)
const logoCache: CurrencyLogoCache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Local fallback logos for major currencies (instant loading)
const LOCAL_LOGOS: Record<string, string> = {
  'ETH': '/crypto-eth.png',
  'BTC': '/crypto-bitcoin.png',
  'SOL': '/crypto-solana.png',
  'MATIC': '/crypto-polygon.png',
  'BNB': '/crypto-bnb.png',
  'tBNB': '/crypto-bnb.png',
  'AVAX': '/crypto-avalanche.png',
  'FTM': '/crypto-fantom.png',
  'CRO': '/crypto-cronos.png',
  'LTC': '/crypto-litecoin.png',
  'DOGE': '/crypto-doge.png',
  'BCH': '/crypto-bitcoincash.png',
  'USDC': '/crypto-usdc.png',
  'USDT': '/crypto-usdt.png',
};

// Symbol to CoinGecko ID mapping (for accurate lookups)
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  'ETH': 'ethereum',
  'BTC': 'bitcoin',
  'SOL': 'solana',
  'MATIC': 'matic-network',
  'BNB': 'binancecoin',
  'AVAX': 'avalanche-2',
  'FTM': 'fantom',
  'CRO': 'crypto-com-chain',
  'LTC': 'litecoin',
  'DOGE': 'dogecoin',
  'BCH': 'bitcoin-cash',
  'USDC': 'usd-coin',
  'USDT': 'tether',
  'WETH': 'weth',
  'DAI': 'dai',
  'LINK': 'chainlink',
  'UNI': 'uniswap',
  'AAVE': 'aave',
  'WBTC': 'wrapped-bitcoin',
};

/**
 * Get currency logo dynamically
 * @param symbol Token symbol (e.g., 'ETH', 'BTC', 'USDC')
 * @param contractAddress Optional contract address for ERC20/SPL tokens
 * @returns Logo URL (local file or external URL)
 */
export async function getCurrencyLogo(
  symbol: string,
  contractAddress?: string
): Promise<string> {
  // Check cache first
  const cacheKey = contractAddress || symbol;
  const cached = logoCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.logo;
  }

  // Return local logo if available (instant)
  if (LOCAL_LOGOS[symbol]) {
    return LOCAL_LOGOS[symbol];
  }

  try {
    // Try CoinGecko API
    const coinGeckoLogo = await getCoinGeckoLogo(symbol, contractAddress);
    if (coinGeckoLogo) {
      // Cache the result
      logoCache[cacheKey] = {
        logo: coinGeckoLogo,
        timestamp: Date.now(),
      };
      return coinGeckoLogo;
    }

    // Try CryptoCompare API as fallback
    const cryptoCompareLogo = await getCryptoCompareLogo(symbol);
    if (cryptoCompareLogo) {
      logoCache[cacheKey] = {
        logo: cryptoCompareLogo,
        timestamp: Date.now(),
      };
      return cryptoCompareLogo;
    }
  } catch (error) {
    console.warn(`[CurrencyLogoService] Failed to fetch logo for ${symbol}:`, error);
  }

  // Fallback to generic crypto logo
  return '/crypto-eth.png';
}

/**
 * Fetch logo from CoinGecko API
 */
async function getCoinGeckoLogo(
  symbol: string,
  contractAddress?: string
): Promise<string | null> {
  try {
    // If we have a contract address, use it for more accurate results
    if (contractAddress) {
      // Determine platform based on contract address format
      let platform = 'ethereum';
      if (contractAddress.length === 44 || contractAddress.length === 43) {
        platform = 'solana';
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${platform}/contract/${contractAddress}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.image?.large || data.image?.small) {
          return data.image.large || data.image.small;
        }
      }
    }

    // Fallback: search by symbol
    const coinId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()];
    if (coinId) {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.image?.large || data.image?.small) {
          return data.image.large || data.image.small;
        }
      }
    }

    // Last resort: search by symbol name
    const searchResponse = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${symbol}`
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      const coin = searchData.coins?.[0];
      if (coin?.large || coin?.thumb) {
        return coin.large || coin.thumb;
      }
    }
  } catch (error) {
    console.warn(`[CoinGecko] Failed to fetch logo for ${symbol}:`, error);
  }

  return null;
}

/**
 * Fetch logo from CryptoCompare API
 */
async function getCryptoCompareLogo(symbol: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${symbol.toUpperCase()}&tsyms=USD`
    );

    if (response.ok) {
      const data = await response.json();
      const coinData = data.RAW?.[symbol.toUpperCase()]?.USD;
      if (coinData?.IMAGEURL) {
        return `https://www.cryptocompare.com${coinData.IMAGEURL}`;
      }
    }
  } catch (error) {
    console.warn(`[CryptoCompare] Failed to fetch logo for ${symbol}:`, error);
  }

  return null;
}

/**
 * Synchronous version that returns local logo or placeholder
 * Use this when you need instant response (e.g., initial render)
 * Then call getCurrencyLogo() in background to get the real logo
 */
export function getCurrencyLogoSync(symbol: string): string {
  // Check cache
  const cached = logoCache[symbol];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.logo;
  }

  // Return local logo if available
  return LOCAL_LOGOS[symbol] || '/crypto-eth.png';
}

/**
 * Prefetch logos for multiple currencies (batch optimization)
 */
export async function prefetchCurrencyLogos(
  currencies: Array<{ symbol: string; contractAddress?: string }>
): Promise<void> {
  const promises = currencies.map(({ symbol, contractAddress }) =>
    getCurrencyLogo(symbol, contractAddress).catch(() => null)
  );
  await Promise.allSettled(promises);
}

