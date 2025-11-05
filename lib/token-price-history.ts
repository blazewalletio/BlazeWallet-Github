/**
 * Token Price History Service
 * Fetches historical price data for tokens/cryptocurrencies
 */

interface PriceDataPoint {
  timestamp: number;
  price: number;
}

interface PriceHistoryResult {
  prices: PriceDataPoint[];
  success: boolean;
  error?: string;
}

/**
 * Fetch 7-day price history for a token/crypto
 */
export async function getTokenPriceHistory(
  symbol: string,
  days: number = 7
): Promise<PriceHistoryResult> {
  try {
    // Use CoinGecko API for historical data
    // Format: vs_currency=usd, days=7, interval=daily
    const coinGeckoId = getCoinGeckoId(symbol);
    
    if (!coinGeckoId) {
      console.warn(`❌ No CoinGecko ID mapping for ${symbol}`);
      return { prices: [], success: false, error: 'Unsupported token' };
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinGeckoId}/market_chart?vs_currency=usd&days=${days}&interval=hourly`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    
    // CoinGecko returns [[timestamp, price], ...]
    const prices: PriceDataPoint[] = data.prices.map(([timestamp, price]: [number, number]) => ({
      timestamp,
      price,
    }));

    return { prices, success: true };
  } catch (error) {
    console.error(`❌ Failed to fetch price history for ${symbol}:`, error);
    return { prices: [], success: false, error: String(error) };
  }
}

/**
 * Map token symbol to CoinGecko ID
 */
function getCoinGeckoId(symbol: string): string | null {
  const mapping: Record<string, string> = {
    // Major cryptocurrencies
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'SOL': 'solana',
    'USDC': 'usd-coin',
    'USDT': 'tether',
    'BNB': 'binancecoin',
    'XRP': 'ripple',
    'ADA': 'cardano',
    'DOGE': 'dogecoin',
    'MATIC': 'matic-network',
    'DOT': 'polkadot',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'AVAX': 'avalanche-2',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'ATOM': 'cosmos',
    'DAI': 'dai',
    'SHIB': 'shiba-inu',
    'TRX': 'tron',
    'FTM': 'fantom',
    'CRO': 'crypto-com-chain',
    'NEAR': 'near',
    'APT': 'aptos',
    
    // Popular SPL tokens
    'JUP': 'jupiter-exchange-solana',
    'RAY': 'raydium',
    'BONK': 'bonk',
    'WIF': 'dogwifcoin',
    'JTO': 'jito-governance-token',
    'PYTH': 'pyth-network',
    'ORCA': 'orca',
    'MNGO': 'mango-markets',
    'SRM': 'serum',
    'FIDA': 'bonfida',
    
    // Popular ERC20 tokens
    'AAVE': 'aave',
    'MKR': 'maker',
    'COMP': 'compound-governance-token',
    'SUSHI': 'sushi',
    'GRT': 'the-graph',
    '1INCH': '1inch',
    'ENS': 'ethereum-name-service',
    'LDO': 'lido-dao',
    'CRV': 'curve-dao-token',
    'BAL': 'balancer',
    'SNX': 'havven',
    'YFI': 'yearn-finance',
    'PENDLE': 'pendle',
    
    // Add more as needed
  };

  return mapping[symbol.toUpperCase()] || null;
}

/**
 * Calculate price change percentage
 */
export function calculatePriceChange(prices: PriceDataPoint[]): number {
  if (prices.length < 2) return 0;
  
  const firstPrice = prices[0].price;
  const lastPrice = prices[prices.length - 1].price;
  
  return ((lastPrice - firstPrice) / firstPrice) * 100;
}

/**
 * Get min/max prices from history
 */
export function getPriceRange(prices: PriceDataPoint[]): { min: number; max: number } {
  if (prices.length === 0) return { min: 0, max: 0 };
  
  const priceValues = prices.map(p => p.price);
  return {
    min: Math.min(...priceValues),
    max: Math.max(...priceValues),
  };
}

