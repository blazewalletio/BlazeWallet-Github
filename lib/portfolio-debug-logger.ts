/**
 * 🔍 PORTFOLIO DEBUG LOGGER
 * 
 * Super gedetailleerde logging voor het debuggen van:
 * - Portfolio waarde berekeningen
 * - Native token balances en prijzen
 * - Token balances en prijzen
 * - 24h change percentages
 * - API calls en responses
 * 
 * Gebruik: import { portfolioDebug } from '@/lib/portfolio-debug-logger';
 */

// ALTIJD loggen voor debugging (ook in production)
const FORCE_DEBUG = true;

// Check if we're in development mode (works both server and client side)
const isDevelopment = typeof window !== 'undefined' 
  ? (window as any).__NEXT_DATA__?.props?.pageProps?.isDevelopment ?? true
  : true;

const shouldLog = FORCE_DEBUG || isDevelopment;

const log = (...args: any[]) => {
  if (shouldLog) {
    console.log(...args);
  }
};

const warn = (...args: any[]) => {
  if (shouldLog) {
    console.warn(...args);
  }
};

const error = (...args: any[]) => {
  console.error(...args);
};

const group = (label: string) => {
  if (shouldLog) {
    console.group(label);
  }
};

const groupEnd = () => {
  if (shouldLog) {
    console.groupEnd();
  }
};

const table = (data: any) => {
  if (shouldLog) {
    console.table(data);
  }
};

export interface ChainInfo {
  chainKey: string;
  chainName: string;
  nativeSymbol: string;
  nativeDecimals: number;
  isEVM: boolean;
  isSolana: boolean;
  isBitcoin: boolean;
  isBitcoinFork: boolean;
  hasAlchemy: boolean;
  rpcUrl: string;
}

export interface BalanceResult {
  raw: string;
  formatted: string;
  source: 'blockchain' | 'cache' | 'error';
  error?: string;
}

export interface PriceResult {
  symbol: string;
  price: number;
  change24h: number;
  source: 'coingecko' | 'binance' | 'dexscreener' | 'cache' | 'none';
  error?: string;
}

export interface TokenResult {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  balanceUSD: string;
  priceUSD: number;
  change24h: number;
  priceSource: string;
  logo?: string;
}

export interface PortfolioSummary {
  chain: string;
  address: string;
  nativeBalance: string;
  nativeSymbol: string;
  nativePriceUSD: number;
  nativeValueUSD: number;
  nativeChange24h: number;
  tokensCount: number;
  tokensTotalUSD: number;
  totalPortfolioUSD: number;
  weightedChange24h: number;
  timestamp: number;
}

class PortfolioDebugLogger {
  private sessionId: string;
  private startTime: number;

  constructor() {
    this.sessionId = Math.random().toString(36).substring(7);
    this.startTime = Date.now();
  }

  /**
   * Log de start van een fetch operatie
   */
  logFetchStart(chain: string, address: string, force: boolean = false) {
    const timestamp = new Date().toISOString();
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    🔄 PORTFOLIO FETCH START                                    ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Chain:     ${chain.padEnd(67)}║`);
    console.log(`║ Address:   ${address.padEnd(67)}║`);
    console.log(`║ Forced:    ${String(force).padEnd(67)}║`);
    console.log(`║ Time:      ${timestamp.padEnd(67)}║`);
    console.log(`║ Session:   ${this.sessionId.padEnd(67)}║`);
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  }

  /**
   * Log chain informatie
   */
  logChainInfo(info: ChainInfo) {
    group('📋 CHAIN INFO');
    log('Chain Key:', info.chainKey);
    log('Chain Name:', info.chainName);
    log('Native Symbol:', info.nativeSymbol);
    log('Native Decimals:', info.nativeDecimals);
    log('Type:', info.isEVM ? 'EVM' : info.isSolana ? 'Solana' : info.isBitcoin ? 'Bitcoin' : info.isBitcoinFork ? 'Bitcoin Fork' : 'Unknown');
    log('Has Alchemy:', info.hasAlchemy);
    log('RPC URL:', info.rpcUrl);
    groupEnd();
  }

  /**
   * Log native balance ophalen
   */
  logNativeBalanceFetch(chain: string, address: string, result: BalanceResult) {
    group(`💰 NATIVE BALANCE FETCH [${chain}]`);
    log('Address:', address);
    log('Raw Balance:', result.raw);
    log('Formatted Balance:', result.formatted);
    log('Source:', result.source);
    if (result.error) {
      error('Error:', result.error);
    }
    groupEnd();
  }

  /**
   * Log prijs ophalen
   */
  logPriceFetch(symbol: string, result: PriceResult) {
    const status = result.price > 0 ? '✅' : '❌';
    group(`${status} PRICE FETCH [${symbol}]`);
    log('Symbol:', symbol);
    log('Price USD:', result.price > 0 ? `$${result.price.toFixed(6)}` : 'NOT FOUND');
    log('24h Change:', result.change24h !== 0 ? `${result.change24h >= 0 ? '+' : ''}${result.change24h.toFixed(2)}%` : 'NOT FOUND');
    log('Source:', result.source);
    if (result.error) {
      warn('Error:', result.error);
    }
    groupEnd();
  }

  /**
   * Log meerdere prijzen in batch
   */
  logBatchPriceFetch(symbols: string[], results: Record<string, { price: number; change24h: number }>) {
    group(`📡 BATCH PRICE FETCH [${symbols.length} symbols]`);
    log('Requested symbols:', symbols.join(', '));
    
    const tableData: any[] = [];
    symbols.forEach(symbol => {
      const data = results[symbol];
      tableData.push({
        Symbol: symbol,
        'Price USD': data?.price > 0 ? `$${data.price.toFixed(6)}` : '❌ NOT FOUND',
        '24h Change': data?.change24h !== undefined ? `${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%` : '❌ NOT FOUND',
        Status: data?.price > 0 ? '✅' : '❌'
      });
    });
    table(tableData);
    
    const found = Object.values(results).filter(r => r.price > 0).length;
    log(`Result: ${found}/${symbols.length} prices found`);
    groupEnd();
  }

  /**
   * Log token balances ophalen
   */
  logTokenBalancesFetch(chain: string, method: 'alchemy' | 'popular_tokens' | 'spl' | 'none', tokens: TokenResult[]) {
    group(`🪙 TOKEN BALANCES FETCH [${chain}]`);
    log('Method:', method);
    log('Tokens found:', tokens.length);
    
    if (tokens.length > 0) {
      const tableData = tokens.map(t => ({
        Symbol: t.symbol,
        Name: t.name.substring(0, 20),
        Balance: t.balance,
        'Price USD': t.priceUSD > 0 ? `$${t.priceUSD.toFixed(6)}` : '❌',
        'Value USD': t.balanceUSD !== '0' ? `$${parseFloat(t.balanceUSD).toFixed(2)}` : '$0.00',
        '24h %': t.change24h !== 0 ? `${t.change24h >= 0 ? '+' : ''}${t.change24h.toFixed(2)}%` : '❌',
        'Price Source': t.priceSource
      }));
      table(tableData);
    } else {
      log('No tokens found');
    }
    groupEnd();
  }

  /**
   * Log portfolio berekening
   */
  logPortfolioCalculation(summary: PortfolioSummary) {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    💼 PORTFOLIO CALCULATION RESULT                             ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
    
    // Native token
    console.log('║ NATIVE TOKEN:                                                                  ║');
    console.log(`║   Symbol:        ${summary.nativeSymbol.padEnd(60)}║`);
    console.log(`║   Balance:       ${summary.nativeBalance.padEnd(60)}║`);
    console.log(`║   Price USD:     $${summary.nativePriceUSD.toFixed(6).padEnd(58)}║`);
    console.log(`║   Value USD:     $${summary.nativeValueUSD.toFixed(2).padEnd(58)}║`);
    console.log(`║   24h Change:    ${(summary.nativeChange24h >= 0 ? '+' : '') + summary.nativeChange24h.toFixed(2) + '%'.padEnd(55)}║`);
    
    console.log('╠────────────────────────────────────────────────────────────────────────────────╣');
    
    // Tokens
    console.log('║ TOKENS:                                                                        ║');
    console.log(`║   Count:         ${String(summary.tokensCount).padEnd(60)}║`);
    console.log(`║   Total USD:     $${summary.tokensTotalUSD.toFixed(2).padEnd(58)}║`);
    
    console.log('╠────────────────────────────────────────────────────────────────────────────────╣');
    
    // Totaal
    console.log('║ PORTFOLIO TOTAL:                                                               ║');
    console.log(`║   Total USD:     $${summary.totalPortfolioUSD.toFixed(2).padEnd(58)}║`);
    console.log(`║   24h Change:    ${(summary.weightedChange24h >= 0 ? '+' : '') + summary.weightedChange24h.toFixed(2) + '%'.padEnd(55)}║`);
    
    console.log('╠────────────────────────────────────────────────────────────────────────────────╣');
    
    // Breakdown
    const nativePercentage = summary.totalPortfolioUSD > 0 
      ? ((summary.nativeValueUSD / summary.totalPortfolioUSD) * 100).toFixed(1) 
      : '0.0';
    const tokensPercentage = summary.totalPortfolioUSD > 0 
      ? ((summary.tokensTotalUSD / summary.totalPortfolioUSD) * 100).toFixed(1) 
      : '0.0';
    
    console.log('║ BREAKDOWN:                                                                     ║');
    console.log(`║   Native:        ${nativePercentage}% ($${summary.nativeValueUSD.toFixed(2)})`.padEnd(79) + '║');
    console.log(`║   Tokens:        ${tokensPercentage}% ($${summary.tokensTotalUSD.toFixed(2)})`.padEnd(79) + '║');
    
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  }

  /**
   * Log waarschuwingen voor ontbrekende data
   */
  logMissingData(chain: string, issues: string[]) {
    if (issues.length === 0) return;
    
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    ⚠️ MISSING DATA WARNINGS                                    ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Chain: ${chain.padEnd(70)}║`);
    console.log('╠────────────────────────────────────────────────────────────────────────────────╣');
    
    issues.forEach((issue, idx) => {
      const lines = this.wrapText(issue, 75);
      lines.forEach(line => {
        console.log(`║ ${(idx + 1)}. ${line.padEnd(74)}║`);
      });
    });
    
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  }

  /**
   * Log fetch complete
   */
  logFetchComplete(chain: string, duration: number, success: boolean, errorMessage?: string) {
    const status = success ? '✅ SUCCESS' : '❌ FAILED';
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log(`║                    ${status.padEnd(57)}║`);
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Chain:           ${chain.padEnd(60)}║`);
    console.log(`║ Duration:        ${duration}ms`.padEnd(79) + '║');
    console.log(`║ Time:            ${new Date().toISOString().padEnd(60)}║`);
    if (!success && errorMessage) {
      console.log('╠────────────────────────────────────────────────────────────────────────────────╣');
      console.log(`║ Reason:          ${errorMessage.substring(0, 58).padEnd(60)}║`);
    }
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
    console.log('\n');
  }

  /**
   * Log API call details
   */
  logAPICall(api: string, endpoint: string, params: Record<string, any>, response: any, duration: number) {
    group(`🌐 API CALL [${api}]`);
    log('Endpoint:', endpoint);
    log('Params:', params);
    log('Duration:', `${duration}ms`);
    log('Response status:', response?.status || 'N/A');
    if (response?.error) {
      error('Error:', response.error);
    }
    groupEnd();
  }

  /**
   * Log cache status
   */
  logCacheStatus(chain: string, address: string, hit: boolean, age: number | null, stale: boolean) {
    const status = hit ? (stale ? '⚠️ STALE' : '✅ FRESH') : '❌ MISS';
    group(`💾 CACHE STATUS [${chain}] ${status}`);
    log('Address:', address);
    log('Cache hit:', hit);
    if (hit && age !== null) {
      log('Age:', `${Math.round(age / 1000)}s`);
      log('Stale:', stale);
    }
    groupEnd();
  }

  /**
   * Log 24h change details voor alle assets
   */
  logChange24hDetails(chain: string, nativeSymbol: string, nativeChange: number, tokens: { symbol: string; change24h: number; hasData: boolean }[]) {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    📈 24H CHANGE DETAILS                                       ║');
    console.log('╠════════════════════════════════════════════════════════════════════════════════╣');
    console.log(`║ Chain: ${chain.padEnd(70)}║`);
    console.log('╠────────────────────────────────────────────────────────────────────────────────╣');
    
    // Native
    const nativeStatus = nativeChange !== 0 ? '✅' : '❌';
    const nativeChangeStr = nativeChange !== 0 
      ? `${nativeChange >= 0 ? '+' : ''}${nativeChange.toFixed(2)}%`
      : 'NOT FOUND';
    console.log(`║ ${nativeStatus} ${nativeSymbol.padEnd(12)} (native):  ${nativeChangeStr.padEnd(50)}║`);
    
    // Tokens
    if (tokens.length > 0) {
      console.log('╠────────────────────────────────────────────────────────────────────────────────╣');
      tokens.forEach(token => {
        const status = token.hasData ? '✅' : '❌';
        const changeStr = token.hasData 
          ? `${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`
          : 'NOT FOUND';
        console.log(`║ ${status} ${token.symbol.padEnd(12)} (token):   ${changeStr.padEnd(50)}║`);
      });
    }
    
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
  }

  /**
   * Helper: wrap text to max width
   */
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    words.forEach(word => {
      if ((currentLine + ' ' + word).length <= maxWidth) {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }
}

// Singleton export
export const portfolioDebug = new PortfolioDebugLogger();

// Quick access functions
export const debugFetchStart = (chain: string, address: string, force?: boolean) => 
  portfolioDebug.logFetchStart(chain, address, force);

export const debugChainInfo = (info: ChainInfo) => 
  portfolioDebug.logChainInfo(info);

export const debugNativeBalance = (chain: string, address: string, result: BalanceResult) => 
  portfolioDebug.logNativeBalanceFetch(chain, address, result);

export const debugPriceFetch = (symbol: string, result: PriceResult) => 
  portfolioDebug.logPriceFetch(symbol, result);

export const debugBatchPrices = (symbols: string[], results: Record<string, { price: number; change24h: number }>) => 
  portfolioDebug.logBatchPriceFetch(symbols, results);

export const debugTokenBalances = (chain: string, method: 'alchemy' | 'popular_tokens' | 'spl' | 'none', tokens: TokenResult[]) => 
  portfolioDebug.logTokenBalancesFetch(chain, method, tokens);

export const debugPortfolioResult = (summary: PortfolioSummary) => 
  portfolioDebug.logPortfolioCalculation(summary);

export const debugMissingData = (chain: string, issues: string[]) => 
  portfolioDebug.logMissingData(chain, issues);

export const debugFetchComplete = (chain: string, duration: number, success: boolean, errorMessage?: string) => 
  portfolioDebug.logFetchComplete(chain, duration, success, errorMessage);

export const debugCache = (chain: string, address: string, hit: boolean, age: number | null, stale: boolean) => 
  portfolioDebug.logCacheStatus(chain, address, hit, age, stale);

export const debugChange24h = (chain: string, nativeSymbol: string, nativeChange: number, tokens: { symbol: string; change24h: number; hasData: boolean }[]) => 
  portfolioDebug.logChange24hDetails(chain, nativeSymbol, nativeChange, tokens);

