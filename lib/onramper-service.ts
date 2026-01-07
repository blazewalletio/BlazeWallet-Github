// Onramper integration for fiat on-ramp
// Docs: https://docs.onramper.com/docs/integration-steps
// Widget integration - Simple and powerful fiat-to-crypto solution
// IMPORTANT: URL signing is required since April 2025
// Docs: https://knowledge.onramper.com/url-signing

import { logger } from '@/lib/logger';
import crypto from 'crypto';

export interface OnramperConfig {
  walletAddress: string;
  walletAddresses?: { [key: string]: string }; // Multi-chain wallet addresses
  defaultCryptoCurrency?: string; // e.g., 'ETH', 'USDT', 'USDC'
  defaultFiatCurrency?: string; // e.g., 'EUR', 'USD', 'GBP'
  defaultAmount?: number; // Default fiat amount
  onlyCryptos?: string; // Comma-separated list of crypto currencies to show
  onlyFiats?: string; // Comma-separated list of fiat currencies to show
  theme?: 'light' | 'dark'; // Theme preference
  mode?: 'buy' | 'sell'; // Transaction mode
}

export class OnramperService {
  private static readonly WIDGET_URL = 'https://buy.onramper.com';
  private static readonly SANDBOX_URL = 'https://buy-staging.onramper.com';

  /**
   * Clean API key - remove quotes, whitespace, and newlines
   * CRITICAL: Vercel environment variables sometimes include quotes
   */
  private static cleanApiKey(apiKey?: string): string {
    if (!apiKey) return '';
    return apiKey.trim().replace(/^["']|["']$/g, '').trim();
  }

  // Get supported assets by chain (hardcoded fallback)
  static getSupportedAssets(chainId: number): string[] {
    const assetMap: Record<number, string[]> = {
      1: ['ETH', 'USDT', 'USDC', 'DAI', 'WBTC', 'LINK', 'UNI', 'AAVE'], // Ethereum
      137: ['MATIC', 'USDT', 'USDC'], // Polygon
      56: ['BNB', 'USDT', 'BUSD'], // BSC
      42161: ['ETH', 'USDT', 'USDC'], // Arbitrum
      10: ['ETH', 'USDT'], // Optimism
      8453: ['ETH', 'USDC'], // Base
      43114: ['AVAX', 'USDT', 'USDC'], // Avalanche
      101: ['SOL', 'USDC', 'USDT'], // Solana
      250: ['FTM', 'USDT', 'USDC'], // Fantom
      25: ['CRO', 'USDT', 'USDC'], // Cronos
      324: ['ETH', 'USDT', 'USDC'], // zkSync Era
      59144: ['ETH', 'USDT', 'USDC'], // Linea
      0: ['BTC'], // Bitcoin
      2: ['LTC'], // Litecoin
      3: ['DOGE'], // Dogecoin
      145: ['BCH'], // Bitcoin Cash
    };

    return assetMap[chainId] || ['ETH'];
  }

  // Server-side cache for available cryptos (5 minutes TTL)
  private static cryptoCache = new Map<string, { data: string[]; timestamp: number }>();
  private static readonly SERVER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get available cryptocurrencies for a specific chain via Onramper API
   * Uses /supported/assets endpoint + quote validation to ensure 100% accuracy
   * Implements aggressive caching for maximum speed
   */
  static async getAvailableCryptosForChain(
    chainId: number,
    fiatCurrency: string = 'EUR',
    country?: string,
    apiKey?: string
  ): Promise<string[]> {
    try {
      if (!apiKey) {
        // Fallback to hardcoded list if no API key
        logger.warn(`No API key provided for getAvailableCryptosForChain, using fallback for chain ${chainId}`);
        return this.getSupportedAssets(chainId);
      }

      // Check server-side cache first
      const cacheKey = `${chainId}_${fiatCurrency}_${country || 'any'}`;
      const cached = this.cryptoCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.SERVER_CACHE_TTL) {
        logger.log(`✅ Using server-cached available cryptos for chain ${chainId}`);
        return cached.data;
      }

      const networkCode = this.getNetworkCode(chainId);
      const cleanApiKey = this.cleanApiKey(apiKey);
      const nativeToken = this.getDefaultCrypto(chainId);
      
      // Step 1: Get potential crypto's from /supported/assets endpoint
      const url = `https://api.onramper.com/supported/assets?source=${fiatCurrency}&type=buy${country ? `&country=${country}` : ''}`;
      
      logger.log(`📊 Fetching available cryptos for chain ${chainId} (${networkCode}) from Onramper...`);

      let response = await fetch(url, {
        headers: {
          'Authorization': cleanApiKey,
          'Accept': 'application/json',
        },
      });

      // Fallback: try with API key as query parameter
      if (!response.ok && (response.status === 401 || response.status === 403)) {
        logger.log('🔄 Trying API key as query parameter...');
        response = await fetch(`${url}&apiKey=${cleanApiKey}`, {
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      if (!response.ok) {
        logger.warn(`Onramper /supported/assets failed for chain ${chainId} (${response.status}), using fallback`);
        return this.getSupportedAssets(chainId);
      }

      const data = await response.json();
      
      // Parse response structure:
      // { message: { assets: [{ fiat: "eur", crypto: ["eth", "btc", "eth_arbitrum"], paymentMethods: [...] }] } }
      const assets = data?.message?.assets || [];
      
      // Step 2: Extract potential crypto's for this specific network
      const potentialCryptos: string[] = [];
      
      for (const asset of assets) {
        const cryptos = asset.crypto || [];
        for (const crypto of cryptos) {
          // Parse crypto format: "eth", "btc", "eth_arbitrum", "sol_solana", "usdc_polygon"
          const parts = crypto.split('_');
          const cryptoSymbol = parts[0].toUpperCase();
          const cryptoNetwork = parts.length > 1 ? parts[1] : null;
          
          // Match network or native token
          if (cryptoNetwork === networkCode) {
            // Network-specific crypto (e.g., "eth_arbitrum", "usdc_polygon")
            if (!potentialCryptos.includes(cryptoSymbol)) {
              potentialCryptos.push(cryptoSymbol);
            }
          } else if (!cryptoNetwork && cryptoSymbol === nativeToken) {
            // Native token without network suffix (e.g., "eth" for Ethereum, "sol" for Solana)
            if (!potentialCryptos.includes(cryptoSymbol)) {
              potentialCryptos.push(cryptoSymbol);
            }
          }
        }
      }

      // Always include native token (most likely to work)
      if (!potentialCryptos.includes(nativeToken)) {
        potentialCryptos.unshift(nativeToken);
      }

      // Step 3: Validate each crypto with a quick quote check (max 5 crypto's to keep it fast)
      const cryptosToValidate = potentialCryptos.slice(0, 5);
      const availableCryptos: string[] = [];
      
      // Validate in parallel with timeout
      const validationPromises = cryptosToValidate.map(async (crypto) => {
        try {
          const quoteUrl = `https://api.onramper.com/quotes?apiKey=${cleanApiKey}&fiatAmount=100&fiatCurrency=${fiatCurrency}&cryptoCurrency=${crypto}&network=${networkCode}`;
          
          // Use AbortController for timeout (2 seconds)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          
          const quoteResponse = await fetch(quoteUrl, {
            headers: { 'Authorization': cleanApiKey },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!quoteResponse.ok) return null;

          const quoteData = await quoteResponse.json();
          const quotes = quoteData.quotes || [];
          
          // CRITICAL: Check if we have at least one valid quote with payout, rate, and no errors
          // This ensures we only show crypto's that actually have working quotes
          const hasValidQuote = quotes.some((q: any) => {
            const hasPayout = q.payout && parseFloat(q.payout.toString()) > 0;
            const hasRate = q.rate && parseFloat(q.rate.toString()) > 0;
            const hasNoErrors = !q.errors || (Array.isArray(q.errors) && q.errors.length === 0);
            
            return hasPayout && hasRate && hasNoErrors;
          });

          return hasValidQuote ? crypto : null;
        } catch (error: any) {
          // Timeout or error - skip this crypto (but always include native token)
          if (crypto === nativeToken) {
            // Native token is most likely to work, include it even on error
            return nativeToken;
          }
          return null;
        }
      });

      const validated = await Promise.all(validationPromises);
      const validCryptos = validated.filter(Boolean) as string[];

      // Always include native token as fallback (most likely to work)
      if (!validCryptos.includes(nativeToken)) {
        validCryptos.unshift(nativeToken);
      }

      // Store in server-side cache
      this.cryptoCache.set(cacheKey, { data: validCryptos, timestamp: Date.now() });

      // Cleanup old cache entries (keep cache size manageable)
      if (this.cryptoCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of this.cryptoCache.entries()) {
          if (now - value.timestamp > this.SERVER_CACHE_TTL) {
            this.cryptoCache.delete(key);
          }
        }
      }

      logger.log(`✅ Available cryptos for chain ${chainId} (${networkCode}):`, validCryptos);
      
      return validCryptos.length > 0 ? validCryptos : [nativeToken];
    } catch (error: any) {
      logger.error(`Error fetching available cryptos for chain ${chainId}:`, error);
      return this.getSupportedAssets(chainId);
    }
  }

  // Get default crypto currency for chain
  static getDefaultCrypto(chainId: number): string {
    const defaultMap: Record<number, string> = {
      1: 'ETH',
      137: 'MATIC',
      56: 'BNB',
      42161: 'ETH',
      10: 'ETH',
      8453: 'ETH',
      43114: 'AVAX',
      101: 'SOL',
      250: 'FTM',
      25: 'CRO',
      324: 'ETH',
      59144: 'ETH',
      0: 'BTC',
      2: 'LTC',
      3: 'DOGE',
      145: 'BCH',
    };

    return defaultMap[chainId] || 'ETH';
  }

  // Map chain ID to Onramper network code
  static getNetworkCode(chainId: number): string {
    const networkMap: Record<number, string> = {
      1: 'ethereum',
      137: 'polygon',
      56: 'bsc',
      42161: 'arbitrum',
      10: 'optimism',
      8453: 'base',
      43114: 'avalanche',
      101: 'solana',
      250: 'fantom',
      25: 'cronos',
      324: 'zksync',
      59144: 'linea',
      0: 'bitcoin',
      2: 'litecoin',
      3: 'dogecoin',
      145: 'bitcoincash',
    };

    return networkMap[chainId] || 'ethereum';
  }

  // Create multi-chain wallet addresses object for Onramper
  // Format: { "ethereum": "0x...", "polygon": "0x...", "solana": "..." }
  static createWalletAddresses(
    primaryAddress: string,
    chainId: number,
    solanaAddress?: string,
    bitcoinAddress?: string
  ): { [key: string]: string } {
    const addresses: { [key: string]: string } = {};
    const network = this.getNetworkCode(chainId);

    // Add primary address for current chain
    addresses[network] = primaryAddress;

    // For EVM chains, all use the same address
    const evmChains = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'base', 'avalanche'];
    if (evmChains.includes(network)) {
      // Add to all EVM chains that use the same address
      evmChains.forEach(chain => {
        if (chain !== network) {
          addresses[chain] = primaryAddress;
        }
      });
    }

    // Add Solana address if provided
    if (solanaAddress && network !== 'solana') {
      addresses['solana'] = solanaAddress;
    }

    // Add Bitcoin address if provided
    if (bitcoinAddress) {
      addresses['bitcoin'] = bitcoinAddress;
    }

    return addresses;
  }

  // Format wallet addresses for Onramper widget
  // Onramper expects: wallets=ethereum:0x...,polygon:0x...,solana:...
  static formatWalletAddresses(walletAddresses: { [key: string]: string }): string {
    return Object.entries(walletAddresses)
      .map(([network, address]) => `${network}:${address}`)
      .join(',');
  }

  // Validate wallet address format
  static validateWalletAddress(address: string, asset: string): boolean {
    // Ethereum format (for EVM chains)
    if (['ETH', 'USDT', 'USDC', 'DAI', 'MATIC', 'BNB', 'AVAX'].includes(asset)) {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    // Solana format
    if (asset === 'SOL') {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }

    // Bitcoin format
    if (asset === 'BTC') {
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    }

    // Default: assume valid if we can't validate
    return true;
  }

  // Get display name for currency code
  static getDisplayName(currencyCode: string): string {
    const nameMap: Record<string, string> = {
      'ETH': 'Ethereum',
      'USDT': 'Tether',
      'USDC': 'USD Coin',
      'DAI': 'Dai',
      'MATIC': 'Polygon',
      'BNB': 'BNB',
      'BUSD': 'Binance USD',
      'SOL': 'Solana',
      'AVAX': 'Avalanche',
      'WBTC': 'Wrapped Bitcoin',
      'LINK': 'Chainlink',
      'UNI': 'Uniswap',
      'AAVE': 'Aave',
    };

    return nameMap[currencyCode] || currencyCode;
  }

  // Generate widget URL with all parameters
  static generateWidgetUrl(config: OnramperConfig, apiKey: string, isSandbox: boolean = false): string {
    const baseUrl = isSandbox ? this.SANDBOX_URL : this.WIDGET_URL;
    const params = new URLSearchParams();

    // Required: API key
    params.append('apiKey', apiKey);

    // Required: Mode
    params.append('mode', config.mode || 'buy');

    // Wallet address (primary)
    if (config.walletAddress) {
      params.append('wallets', config.walletAddress);
    }

    // Multi-chain wallet addresses
    if (config.walletAddresses && Object.keys(config.walletAddresses).length > 0) {
      const formattedAddresses = this.formatWalletAddresses(config.walletAddresses);
      params.append('wallets', formattedAddresses);
    }

    // Default crypto currency
    if (config.defaultCryptoCurrency) {
      params.append('defaultCryptoCurrency', config.defaultCryptoCurrency);
    }

    // Default fiat currency
    if (config.defaultFiatCurrency) {
      params.append('defaultFiatCurrency', config.defaultFiatCurrency);
    }

    // Default amount
    if (config.defaultAmount) {
      params.append('defaultAmount', config.defaultAmount.toString());
    }

    // Only show specific cryptos
    if (config.onlyCryptos) {
      params.append('onlyCryptos', config.onlyCryptos);
    }

    // Only show specific fiats
    if (config.onlyFiats) {
      params.append('onlyFiats', config.onlyFiats);
    }

    // Theme
    if (config.theme) {
      params.append('theme', config.theme);
    }

    const url = `${baseUrl}?${params.toString()}`;
    logger.log('✅ Onramper widget URL generated:', url.replace(apiKey, '***API_KEY***'));
    
    return url;
  }

  // Get supported payment methods (for display purposes)
  static getSupportedPaymentMethods(): string[] {
    return [
      'iDEAL',
      'Credit Card',
      'Debit Card',
      'Bank Transfer',
      'Apple Pay',
      'Google Pay',
      'SEPA',
      'Faster Payments',
    ];
  }

  // Get quote from Onramper API
  // Docs: https://docs.onramper.com/reference/get_quotes-fiat-crypto
  // Endpoint: GET https://api.onramper.com/quotes/{fiat}/{crypto}
  static async getQuote(
    fiatAmount: number,
    fiatCurrency: string,
    cryptoCurrency: string,
    paymentMethod?: string,
    apiKey?: string
  ): Promise<{
    cryptoAmount: string;
    exchangeRate: string;
    fee: string;
    totalAmount: string;
  } | null> {
    try {
      if (!apiKey) {
        logger.error('Onramper API key is required for quotes');
        return null;
      }

      // Onramper API format: /quotes/{fiat}/{crypto}?amount={amount}
      const fiatLower = fiatCurrency.toLowerCase();
      const cryptoLower = cryptoCurrency.toLowerCase();
      const baseUrl = `https://api.onramper.com/quotes/${fiatLower}/${cryptoLower}`;
      
      // Build query parameters
      // CRITICAL: Don't include paymentMethod in quote request
      // Onramper returns different structure with paymentMethod that doesn't include payout/rate
      // Payment method is only used when creating the transaction, not for getting quotes
      const params = new URLSearchParams();
      params.append('amount', fiatAmount.toString());
      // NOTE: paymentMethod is NOT included here - it causes Onramper to return metadata-only response
      
      logger.log('📊 Fetching Onramper quote:', { 
        fiatAmount, 
        fiatCurrency, 
        cryptoCurrency,
        note: 'paymentMethod not included in quote request (only used for transaction creation)',
        apiKeyPrefix: apiKey.substring(0, 10) + '...'
      });

      // Try multiple authentication methods
      // Method 1: Authorization header with direct API key (CORRECT per docs!)
      let url = `${baseUrl}?${params.toString()}`;
      let response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok && (response.status === 401 || response.status === 403)) {
        logger.log('🔄 Method 1 failed (direct API key), trying Method 2...');
        
        // Method 2: API key as query parameter (no Authorization header)
        params.append('apiKey', apiKey);
        url = `${baseUrl}?${params.toString()}`;
        response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      if (!response.ok && (response.status === 401 || response.status === 403)) {
        logger.log('🔄 Method 2 failed (query param), trying Method 3...');
        
        // Method 3: API key as query parameter + Authorization header (legacy fallback)
        response = await fetch(url, {
          headers: {
            'Authorization': apiKey,
            'Accept': 'application/json',
          },
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ Onramper quote API error (all methods failed):', {
          status: response.status,
          statusText: response.statusText,
          error: errorText.substring(0, 500),
          url: url.replace(apiKey, '***API_KEY***'),
        });
        return null;
      }

      const data = await response.json();
      
      logger.log('✅ Onramper quote response received:', {
        hasData: !!data,
        isArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'N/A',
        dataPreview: JSON.stringify(data, null, 2).substring(0, 500)
      });
      
      return OnramperService.parseQuoteResponse(data, fiatAmount);
    } catch (error: any) {
      logger.error('❌ Error fetching Onramper quote:', {
        error: error.message,
        stack: error.stack,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
      });
      return null;
    }
  }

  // Helper method to parse quote response
  // Onramper API response structure:
  // {
  //   "payout": 0.799,              // Crypto amount user receives
  //   "rate": 125.15644555694618,  // Exchange rate
  //   "networkFee": 0.32,          // Network fee
  //   "transactionFee": 0.1,       // Transaction fee
  //   "availablePaymentMethods": [...],
  //   "ramp": "moonpay",
  //   "paymentMethod": "creditcard",
  //   ...
  // }
  private static parseQuoteResponse(data: any, fiatAmount: number): {
    cryptoAmount: string;
    exchangeRate: string;
    fee: string;
    totalAmount: string;
  } | null {
      // Helper function to extract quote data from a single quote object
      const extractQuoteData = (quote: any): {
        cryptoAmount: string;
        exchangeRate: string;
        fee: string;
        totalAmount: string;
      } | null => {
        // Check if this is a metadata-only response (no actual quote data)
        // This happens when paymentMethod is included in the request
        const hasPayout = quote.payout !== undefined && quote.payout !== null;
        const hasRate = quote.rate !== undefined && quote.rate !== null;
        const hasErrors = quote.errors !== undefined;
        
        if (!hasPayout && !hasRate && (hasErrors || quote.availablePaymentMethods)) {
          logger.error('❌ Onramper returned metadata-only response (no quote data):', {
            hasPayout,
            hasRate,
            hasErrors,
            hasPaymentMethods: !!quote.availablePaymentMethods,
            quoteKeys: Object.keys(quote),
            errors: quote.errors,
            message: 'This usually happens when paymentMethod is included in quote request. Quote should be fetched without paymentMethod.'
          });
          return null;
        }
        
        // CRITICAL: Onramper uses "payout" for crypto amount, not "destinationAmount"
        const cryptoAmount = quote.payout || 
                            quote.destinationAmount || 
                            quote.cryptoAmount || 
                            quote.amount || 
                            quote.destination_amount ||
                            '0';
        
        // Source amount is the fiat amount user pays
        const sourceAmount = quote.sourceAmount || 
                            quote.source_amount || 
                            quote.fiatAmount ||
                            fiatAmount.toString();
        
        // CRITICAL: Onramper uses "rate" for exchange rate
        let exchangeRate = quote.rate || 
                          quote.exchangeRate || 
                          quote.exchange_rate;
        
        // CRITICAL: Onramper uses "networkFee" + "transactionFee" for total fee
        const networkFee = parseFloat(quote.networkFee || '0');
        const transactionFee = parseFloat(quote.transactionFee || '0');
        const totalFee = networkFee + transactionFee;
        const fee = quote.fee || 
                   quote.totalFee || 
                   quote.total_fee ||
                   totalFee.toString();
        
        // Calculate exchange rate if not provided
        const cryptoAmountNum = parseFloat(cryptoAmount.toString());
        const sourceAmountNum = parseFloat(sourceAmount.toString());
        
        if (!exchangeRate && cryptoAmountNum > 0 && sourceAmountNum > 0) {
          // Exchange rate = fiat amount / crypto amount
          exchangeRate = (sourceAmountNum / cryptoAmountNum).toString();
        } else if (!exchangeRate) {
          exchangeRate = '0';
        }
        
        // Validate crypto amount
        if (cryptoAmountNum <= 0) {
          logger.error('❌ Invalid crypto amount in quote:', {
            cryptoAmount,
            cryptoAmountNum,
            hasPayout,
            hasRate,
            quoteKeys: Object.keys(quote),
            quotePreview: JSON.stringify(quote, null, 2).substring(0, 500)
          });
          return null;
        }
        
        return {
          cryptoAmount: cryptoAmount.toString(),
          exchangeRate: exchangeRate.toString(),
          fee: fee.toString(),
          totalAmount: sourceAmount.toString(),
        };
      };
      
      // Onramper returns an array of quotes from different providers
      if (Array.isArray(data) && data.length > 0) {
        logger.log(`📊 Found ${data.length} quotes from Onramper`);
        
        // Find the best quote (lowest total fee or best payout)
        const bestQuote = data.reduce((best, current) => {
          const bestPayout = parseFloat(best.payout || best.destinationAmount || '0');
          const currentPayout = parseFloat(current.payout || current.destinationAmount || '0');
          const bestTotalFee = parseFloat(best.networkFee || '0') + parseFloat(best.transactionFee || '0');
          const currentTotalFee = parseFloat(current.networkFee || '0') + parseFloat(current.transactionFee || '0');
          
          // Prefer quote with higher payout (more crypto for same fiat) or lower fees
          if (currentPayout > bestPayout) return current;
          if (currentPayout === bestPayout && currentTotalFee < bestTotalFee) return current;
          return best;
        });
        
        logger.log('📊 Best quote selected:', {
          payout: bestQuote.payout,
          rate: bestQuote.rate,
          networkFee: bestQuote.networkFee,
          transactionFee: bestQuote.transactionFee,
          ramp: bestQuote.ramp,
          paymentMethod: bestQuote.paymentMethod
        });
        
        const extracted = extractQuoteData(bestQuote);
        if (extracted) {
          logger.log('✅ Parsed Onramper quote (array):', extracted);
        }
        return extracted;
      }
      
      // Check if response is a single object (not array)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        logger.log('📊 Single quote object received');
        
        const extracted = extractQuoteData(data);
        if (extracted) {
          logger.log('✅ Parsed Onramper quote (single object):', extracted);
        }
        return extracted;
      }
      
      logger.error('❌ Unexpected Onramper quote response format:', {
        dataType: typeof data,
        isArray: Array.isArray(data),
        data: JSON.stringify(data, null, 2).substring(0, 1000)
      });
      return null;
  }

  // Get supported data (payment methods, fiat currencies, crypto currencies)
  // Docs: https://docs.onramper.com/reference/get_supported
  // Endpoint: GET https://api.onramper.com/supported
  // Also uses: GET https://api.onramper.com/supported/payment-types for payment methods
  static async getSupportedData(apiKey?: string, country: string = 'NL'): Promise<{
    paymentMethods: Array<{ id: string; name: string; icon: string; processingTime: string; fee: string }>;
    fiatCurrencies: string[];
    cryptoCurrencies: string[];
  } | null> {
    try {
      if (!apiKey) {
        logger.warn('Onramper API key not provided - returning fallback data');
        return {
          paymentMethods: [
            { id: 'creditcard', name: 'Credit/Debit Card', icon: 'card', processingTime: 'Instant', fee: '€2.00' },
            { id: 'applepay', name: 'Apple Pay', icon: 'applepay', processingTime: 'Instant', fee: '€1.50' },
            { id: 'googlepay', name: 'Google Pay', icon: 'googlepay', processingTime: 'Instant', fee: '€1.50' },
            { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
            { id: 'bancontact', name: 'Bancontact', icon: 'bancontact', processingTime: 'Instant', fee: '€0.50' },
            { id: 'sepa', name: 'SEPA Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
          ],
          fiatCurrencies: ['EUR', 'USD', 'GBP'],
          cryptoCurrencies: ['ETH', 'USDT', 'USDC', 'BTC', 'SOL'],
        };
      }

      // CRITICAL: Fetch payment types from the correct endpoint
      // Docs: https://docs.onramper.com/reference/get_supported-payment-types
      let paymentTypesResponse = await fetch(`https://api.onramper.com/supported/payment-types?type=buy&country=${country}`, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!paymentTypesResponse.ok && (paymentTypesResponse.status === 401 || paymentTypesResponse.status === 403)) {
        logger.log('🔄 Payment types: Failed with direct key, trying query param...');
        paymentTypesResponse = await fetch(`https://api.onramper.com/supported/payment-types?type=buy&country=${country}&apiKey=${apiKey}`, {
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      // Fetch general supported data
      let supportedResponse = await fetch('https://api.onramper.com/supported', {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!supportedResponse.ok && (supportedResponse.status === 401 || supportedResponse.status === 403)) {
        logger.log('🔄 Supported data: Failed with direct key, trying query param...');
        supportedResponse = await fetch(`https://api.onramper.com/supported?apiKey=${apiKey}`, {
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      // Parse payment types
      let paymentMethods: Array<{ id: string; name: string; icon: string; processingTime: string; fee: string }> = [];
      if (paymentTypesResponse.ok) {
        try {
          const paymentTypesData = await paymentTypesResponse.json();
          logger.log('📊 Onramper payment types response:', JSON.stringify(paymentTypesData, null, 2).substring(0, 1500));
          
          // Onramper returns payment types in various formats
          // Try to extract from different possible response structures
          if (Array.isArray(paymentTypesData)) {
            paymentMethods = paymentTypesData
              .filter((pm: any) => {
                // Filter out invalid/weird payment methods
                const id = pm.id || pm.code || pm.paymentMethod || pm.name?.toLowerCase() || '';
                const name = pm.name || pm.label || pm.displayName || '';
                
                // Skip if ID or name is suspicious (like "message", "error", etc.)
                if (!id || !name || id === 'message' || name === 'message' || name === 'Unknown') {
                  logger.warn('⚠️ Skipping invalid payment method:', pm);
                  return false;
                }
                
                return true;
              })
              .map((pm: any) => ({
                id: pm.id || pm.code || pm.paymentMethod || pm.name?.toLowerCase() || 'unknown',
                name: pm.name || pm.label || pm.displayName || pm.id || 'Unknown',
                icon: pm.icon || pm.id || 'card',
                processingTime: pm.processingTime || pm.processing_time || pm.time || 'Instant',
                fee: pm.fee || pm.feeAmount || '€0.00',
              }));
          } else if (paymentTypesData.paymentTypes || paymentTypesData.payment_methods || paymentTypesData.methods) {
            const methods = paymentTypesData.paymentTypes || paymentTypesData.payment_methods || paymentTypesData.methods;
            if (Array.isArray(methods)) {
              paymentMethods = methods
                .filter((pm: any) => {
                  const id = pm.id || pm.code || pm.paymentMethod || pm.name?.toLowerCase() || '';
                  const name = pm.name || pm.label || pm.displayName || '';
                  if (!id || !name || id === 'message' || name === 'message' || name === 'Unknown') {
                    logger.warn('⚠️ Skipping invalid payment method:', pm);
                    return false;
                  }
                  return true;
                })
                .map((pm: any) => ({
                  id: pm.id || pm.code || pm.paymentMethod || pm.name?.toLowerCase() || 'unknown',
                  name: pm.name || pm.label || pm.displayName || pm.id || 'Unknown',
                  icon: pm.icon || pm.id || 'card',
                  processingTime: pm.processingTime || pm.processing_time || pm.time || 'Instant',
                  fee: pm.fee || pm.feeAmount || '€0.00',
                }));
            }
          } else if (typeof paymentTypesData === 'object') {
            // If it's an object with payment method keys
            paymentMethods = Object.entries(paymentTypesData)
              .filter(([key, value]: [string, any]) => {
                if (!key || key === 'message' || key === 'error' || !value) {
                  logger.warn('⚠️ Skipping invalid payment method:', { key, value });
                  return false;
                }
                return true;
              })
              .map(([key, value]: [string, any]) => ({
                id: key,
                name: value.name || value.label || key,
                icon: value.icon || key,
                processingTime: value.processingTime || value.processing_time || 'Instant',
                fee: value.fee || value.feeAmount || '€0.00',
              }));
          }
          
          logger.log(`✅ Parsed ${paymentMethods.length} valid payment methods from Onramper`);
        } catch (parseError) {
          logger.error('Error parsing payment types response:', parseError);
        }
      } else {
        logger.error('❌ Onramper payment types API failed:', {
          status: paymentTypesResponse.status,
          statusText: paymentTypesResponse.statusText,
        });
      }
      
      // If no valid payment methods were parsed, use sensible defaults
      if (paymentMethods.length === 0) {
        logger.warn('⚠️ No valid payment methods from Onramper API - using defaults');
        paymentMethods = [
          { id: 'creditcard', name: 'Credit/Debit Card', icon: 'card', processingTime: 'Instant', fee: '€2.00' },
          { id: 'applepay', name: 'Apple Pay', icon: 'applepay', processingTime: 'Instant', fee: '€1.50' },
          { id: 'googlepay', name: 'Google Pay', icon: 'googlepay', processingTime: 'Instant', fee: '€1.50' },
          { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
          { id: 'bancontact', name: 'Bancontact', icon: 'bancontact', processingTime: 'Instant', fee: '€0.50' },
          { id: 'sepa', name: 'SEPA Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
        ];
      }

      // Parse general supported data
      let fiatCurrencies: string[] = ['EUR', 'USD', 'GBP'];
      let cryptoCurrencies: string[] = ['ETH', 'USDT', 'USDC', 'BTC', 'SOL'];
      
      if (supportedResponse.ok) {
        try {
          const supportedData = await supportedResponse.json();
          logger.log('📊 Onramper supported data response:', JSON.stringify(supportedData, null, 2).substring(0, 1000));
          
          // Extract fiat currencies
          if (supportedData.fiatCurrencies || supportedData.fiat_currencies || supportedData.fiats) {
            fiatCurrencies = supportedData.fiatCurrencies || supportedData.fiat_currencies || supportedData.fiats;
          }
          
          // Extract crypto currencies
          if (supportedData.cryptoCurrencies || supportedData.crypto_currencies || supportedData.cryptos) {
            cryptoCurrencies = supportedData.cryptoCurrencies || supportedData.crypto_currencies || supportedData.cryptos;
          }
        } catch (parseError) {
          logger.error('Error parsing supported data response:', parseError);
        }
      }

      // If no payment methods found, use fallback
      if (paymentMethods.length === 0) {
        logger.warn('⚠️ No payment methods found from Onramper API, using fallback');
        paymentMethods = [
          { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
          { id: 'card', name: 'Credit Card', icon: 'card', processingTime: '2-5 min', fee: '€2.00' },
          { id: 'bank', name: 'Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
        ];
      }

      logger.log('✅ Parsed Onramper supported data:', {
        paymentMethodsCount: paymentMethods.length,
        fiatCurrenciesCount: fiatCurrencies.length,
        cryptoCurrenciesCount: cryptoCurrencies.length,
        paymentMethods: paymentMethods.map(pm => pm.id),
      });

      return {
        paymentMethods,
        fiatCurrencies,
        cryptoCurrencies,
      };
    } catch (error) {
      logger.error('Error fetching Onramper supported data:', error);
      // Return default data on error
      return {
        paymentMethods: [
          { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
          { id: 'card', name: 'Credit Card', icon: 'card', processingTime: '2-5 min', fee: '€2.00' },
          { id: 'bank', name: 'Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
        ],
        fiatCurrencies: ['EUR', 'USD', 'GBP'],
        cryptoCurrencies: ['ETH', 'USDT', 'USDC', 'BTC', 'SOL'],
      };
    }
  }

  // Create transaction via Onramper
  // Supports two flows:
  // 1. Standard Widget Flow - Full Onramper experience
  // 2. Direct Checkout Flow - Skip transaction screen, go directly to provider
  // 
  // Docs: 
  // - Standard: https://docs.onramper.com/docs/customize-the-experience
  // - Direct: https://docs.onramper.com/docs/choose-integration-method (Direct checkout section)
  // - Signing: https://docs.onramper.com/docs/signatures/widget-sign-a-url
  static async createTransaction(
    fiatAmount: number,
    fiatCurrency: string,
    cryptoCurrency: string,
    walletAddress: string,
    paymentMethod: string,
    apiKey?: string,
    useDirectCheckout: boolean = true // Use direct checkout by default for better UX
  ): Promise<{
    transactionId: string;
    paymentUrl: string;
    status: string;
  } | null> {
    try {
      if (!apiKey) {
        logger.error('Onramper API key is required to create transactions');
        return null;
      }

      // Validate input
      if (typeof fiatAmount !== 'number' || isNaN(fiatAmount) || fiatAmount <= 0) {
        logger.error('❌ Invalid fiatAmount:', fiatAmount);
        return null;
      }

      // Build Onramper Widget URL with transaction parameters
      // Docs: https://docs.onramper.com/docs/customization
      // IMPORTANT: URL signing is required since April 2025
      // Docs: https://docs.onramper.com/docs/signatures/widget-sign-a-url
      // 
      // KEY POINTS FROM DOCUMENTATION:
      // 1. Use a SEPARATE secret key (NOT the API key) for signing
      // 2. Only sign "sensitive parameters" (wallets, networkIds/cryptoIds, walletAddress/tags)
      // 3. Sort parameters alphabetically before signing
      // 4. Use unencoded values for signing (don't URL encode before signing)
      // 5. All crypto IDs and network IDs must be in lowercase
      
      // Get secret key from environment (separate from API key)
      const secretKey = process.env.ONRAMPER_SECRET_KEY?.trim();
      if (!secretKey) {
        logger.error('❌ ONRAMPER_SECRET_KEY is required for URL signing. Please contact Onramper support to obtain your secret key.');
        logger.error('📧 Contact: support@onramper.com');
        logger.error('📚 Docs: https://docs.onramper.com/docs/signatures/widget-sign-a-url');
        logger.error('💡 TEMPORARY WORKAROUND: Trying without signature (may fail if signing is required)');
        
        // TEMPORARY: Try without signature to see if it works
        // This is a fallback - normally signing is required
        logger.warn('⚠️ Attempting to create URL without signature (fallback mode)');
        
        // Build URL without signature as fallback
        const cryptoLower = cryptoCurrency.toLowerCase();
        const fiatLower = fiatCurrency.toLowerCase();
        
        if (useDirectCheckout) {
          const fallbackParams = new URLSearchParams({
            apiKey: apiKey,
            skipTransactionScreen: 'true',
            txnAmount: fiatAmount.toString(),
            txnFiat: fiatLower,
            txnCrypto: cryptoLower,
            txnRedirect: 'false', // false = stay in iframe, don't redirect to top-level window
            wallets: `${cryptoLower}:${walletAddress}`,
          });
          
          if (paymentMethod && paymentMethod !== 'undefined' && paymentMethod !== '') {
            fallbackParams.append('txnPaymentMethod', paymentMethod.toLowerCase());
          }
          
          const fallbackUrl = `https://buy.onramper.com?${fallbackParams.toString()}`;
          
          logger.warn('⚠️ Generated URL WITHOUT signature (fallback):', {
            url: fallbackUrl.replace(apiKey, '***API_KEY***'),
            note: 'This may fail if Onramper requires signing',
          });
          
          return {
            transactionId: `onramper-${Date.now()}`,
            paymentUrl: fallbackUrl,
            status: 'PENDING',
          };
        } else {
          // Standard widget flow without signature
          const fallbackParams = new URLSearchParams({
            apiKey: apiKey,
            onlyCryptos: cryptoLower,
            onlyFiats: fiatLower,
            defaultFiat: fiatLower,
            defaultAmount: fiatAmount.toString(),
            defaultCrypto: cryptoLower,
            wallets: `${cryptoLower}:${walletAddress}`,
            redirectAtCheckout: 'false',
          });
          
          if (paymentMethod && paymentMethod !== 'undefined' && paymentMethod !== '') {
            const pmLower = paymentMethod.toLowerCase();
            fallbackParams.append('onlyPaymentMethods', pmLower);
            fallbackParams.append('defaultPaymentMethod', pmLower);
          }
          
          const fallbackUrl = `https://buy.onramper.com?${fallbackParams.toString()}`;
          
          logger.warn('⚠️ Generated URL WITHOUT signature (fallback):', {
            url: fallbackUrl.replace(apiKey, '***API_KEY***'),
            note: 'This may fail if Onramper requires signing',
          });
          
          return {
            transactionId: `onramper-${Date.now()}`,
            paymentUrl: fallbackUrl,
            status: 'PENDING',
          };
        }
      }

      // IMPORTANT: All crypto IDs must be lowercase (per documentation)
      const cryptoLower = cryptoCurrency.toLowerCase();
      const fiatLower = fiatCurrency.toLowerCase();
      const pmLower = paymentMethod && paymentMethod !== 'undefined' && paymentMethod !== '' 
        ? paymentMethod.toLowerCase() 
        : null;

      // Choose flow based on useDirectCheckout parameter
      if (useDirectCheckout) {
        // DIRECT CHECKOUT FLOW
        // Docs: https://docs.onramper.com/docs/choose-integration-method
        // Skips Onramper's transaction screen, goes directly to provider checkout
        // 
        // Parameters for Direct Checkout:
        // - skipTransactionScreen=true (required)
        // - txnAmount (required) - fiat amount
        // - txnFiat (required) - fiat currency ID
        // - txnCrypto (required) - crypto currency ID
        // - txnPaymentMethod (optional) - payment method ID
        // - txnOnramp (optional) - provider ID (if not specified, uses Onramper Ranking Engine)
        // - txnRedirect (optional) - direct redirect to provider widget
        // - wallets (required for good UX) - wallet address (requires URL signing)
        
        logger.log('🚀 Using Direct Checkout Flow (skipTransactionScreen=true)');
        
        const directCheckoutParams = new URLSearchParams({
          apiKey: apiKey,
          skipTransactionScreen: 'true',
          txnAmount: fiatAmount.toString(),
          txnFiat: fiatLower,
          txnCrypto: cryptoLower,
          txnRedirect: 'false', // false = stay in iframe, don't redirect to top-level window
        });

        // Add wallet address with signature if secret key is available
        // Docs: https://docs.onramper.com/docs/signatures/widget-sign-a-url
        if (secretKey) {
          const walletParam = `${cryptoLower}:${walletAddress}`;
          // Sign only the wallets parameter (sensitive parameter per docs)
          const signContent = `wallets=${walletParam}`;
          const signature = crypto
            .createHmac('sha256', secretKey)
            .update(signContent)
            .digest('hex');
          
          directCheckoutParams.append('wallets', walletParam);
          directCheckoutParams.append('signature', signature);
        } else {
          // Without signature, Onramper may still accept it but user might need to confirm
          logger.warn('⚠️ Wallet address added without signature - user may need to confirm address');
          directCheckoutParams.append('wallets', `${cryptoLower}:${walletAddress}`);
        }

        // Add optional parameters
        if (pmLower) {
          directCheckoutParams.append('txnPaymentMethod', pmLower);
        }
        // Note: txnOnramp is optional - if not provided, Onramper uses Ranking Engine

        const widgetUrl = `https://buy.onramper.com?${directCheckoutParams.toString()}`;

        logger.log('✅ Generated Onramper Direct Checkout URL:', {
          flow: 'Direct Checkout',
          crypto: cryptoCurrency,
          fiat: fiatCurrency,
          amount: fiatAmount,
          paymentMethod: paymentMethod || 'none',
          wallet: walletAddress.substring(0, 10) + '...',
          fullUrl: widgetUrl.replace(apiKey, '***API_KEY***'),
        });

        return {
          transactionId: `onramper-${Date.now()}`,
          paymentUrl: widgetUrl,
          status: 'PENDING',
        };
      } else {
        // STANDARD WIDGET FLOW
        // Full Onramper experience with transaction screen
        // Docs: https://docs.onramper.com/docs/customize-the-experience
        
        logger.log('🎨 Using Standard Widget Flow');
        
      const widgetParams = new URLSearchParams({
        apiKey: apiKey,
          onlyCryptos: cryptoLower, // lowercase per docs
          onlyFiats: fiatLower,
          defaultFiat: fiatLower, // Use defaultFiat instead of just onlyFiats
          defaultAmount: fiatAmount.toString(), // Use defaultAmount (not amount)
          defaultCrypto: cryptoLower, // Pre-select the crypto
          wallets: `${cryptoLower}:${walletAddress}`, // lowercase crypto ID per docs
          redirectAtCheckout: 'false', // false = opens in new tab (better for popup)
        });

        // Add payment method if provided
        if (pmLower) {
          widgetParams.append('onlyPaymentMethods', pmLower);
          widgetParams.append('defaultPaymentMethod', pmLower); // Also set as default
        }

        // Sensitive parameters to sign according to Onramper documentation
        // Docs: https://docs.onramper.com/docs/signatures/widget-sign-a-url
        // For the widget flow the *only* parameter that is strictly required
        // to be signed is `wallets` (and related wallet address tags). To
        // avoid mismatches with Onramper's own internal canonicalization we
        // keep the signContent minimal and only include `wallets` here.
        const sensitiveParams: { [key: string]: string } = {
          wallets: `${cryptoLower}:${walletAddress}`, // Wallet address - sensitive
        };

        // Sort keys alphabetically (required by Onramper)
        const sortedKeys = Object.keys(sensitiveParams).sort();
        const signContent = sortedKeys
          .map(key => `${key}=${sensitiveParams[key]}`)
          .join('&');

        // Generate HMAC-SHA256 signature with secret key
        const signature = crypto
          .createHmac('sha256', secretKey)
          .update(signContent)
          .digest('hex');
        
        // Add signature to URL parameters
        widgetParams.append('signature', signature);

        // Use buy.onramper.com - this is the correct widget URL
        const widgetUrl = `https://buy.onramper.com?${widgetParams.toString()}`;

        logger.log('✅ Generated Onramper Standard Widget URL:', {
          flow: 'Standard Widget',
        crypto: cryptoCurrency,
        fiat: fiatCurrency,
        amount: fiatAmount,
          paymentMethod: paymentMethod || 'none',
        wallet: walletAddress.substring(0, 10) + '...',
          fullUrl: widgetUrl.replace(apiKey, '***API_KEY***'),
      });

      // Return widget URL as the payment URL
        // The frontend will open this in a new window/popup
      // Webhook will provide real transaction updates
      return {
        transactionId: `onramper-${Date.now()}`, // Temporary ID, real ID comes from webhook
        paymentUrl: widgetUrl,
        status: 'PENDING',
      };
      }

    } catch (error: any) {
      logger.error('❌ Onramper createTransaction error:', {
        error: error.message,
        stack: error.stack,
        fiatAmount,
        fiatCurrency,
        cryptoCurrency,
        paymentMethod,
      });
      return null;
    }
  }

  // =============================================================================
  // NEW METHODS FOR MULTI-PROVIDER SUPPORT
  // =============================================================================

  /**
   * Get available onramp providers for a specific transaction
   * Endpoint: GET /supported/onramps
   * Docs: https://docs.onramper.com/reference/get_supported-onramps
   */
  static async getAvailableProviders(
    fiatCurrency: string,
    cryptoCurrency: string,
    country?: string,
    apiKey?: string
  ): Promise<Array<{
    onramp: string;
    country: string;
    paymentMethods: string[];
    recommendedPaymentMethod: string;
  }>> {
    try {
      if (!apiKey) {
        logger.warn('⚠️ Onramper API key not provided for getAvailableProviders');
        return [];
      }

      const fiatLower = fiatCurrency.toLowerCase();
      const cryptoLower = cryptoCurrency.toLowerCase();
      let url = `https://api.onramper.com/supported/onramps?type=buy&source=${fiatLower}&destination=${cryptoLower}`;
      
      // Add country if provided (otherwise Onramper auto-detects via IP)
      if (country) {
        url += `&country=${country.toLowerCase()}`;
      }

      logger.log('📊 Fetching available providers:', { fiatCurrency, cryptoCurrency, country: country || 'auto-detect' });

      // Try multiple authentication methods
      let response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok && (response.status === 401 || response.status === 403)) {
        // Fallback to query param
        const urlWithKey = `${url}${url.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
        response = await fetch(urlWithKey, {
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      if (!response.ok) {
        logger.error('❌ Failed to fetch available providers:', {
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const data = await response.json();
      
      // Response format: { message: [...] }
      const providers = data.message || [];
      
      logger.log(`✅ Found ${providers.length} available providers`);
      return providers;
    } catch (error: any) {
      logger.error('❌ Error fetching available providers:', error);
      return [];
    }
  }

  /**
   * Get payment methods with provider support
   * Endpoint: GET /supported/payment-types/{source}
   * Docs: https://docs.onramper.com/reference/get_supported-payment-types-source
   */
  static async getPaymentMethods(
    fiatCurrency: string,
    cryptoCurrency: string,
    country?: string,
    apiKey?: string
  ): Promise<Array<{
    paymentTypeId: string;
    name: string;
    icon: string;
    details: {
      currencyStatus: string;
      limits: Record<string, { min: number; max: number }>;
    };
  }>> {
    try {
      if (!apiKey) {
        logger.warn('⚠️ Onramper API key not provided for getPaymentMethods');
        return [];
      }

      const fiatLower = fiatCurrency.toLowerCase();
      const cryptoLower = cryptoCurrency.toLowerCase();
      let url = `https://api.onramper.com/supported/payment-types/${fiatLower}?type=buy&destination=${cryptoLower}`;
      
      // Add country if provided (otherwise Onramper auto-detects via IP)
      if (country) {
        url += `&country=${country.toLowerCase()}`;
      }

      logger.log('📊 Fetching payment methods:', { fiatCurrency, cryptoCurrency, country: country || 'auto-detect' });

      // Try multiple authentication methods
      let response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok && (response.status === 401 || response.status === 403)) {
        // Fallback to query param
        const urlWithKey = `${url}${url.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
        response = await fetch(urlWithKey, {
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      if (!response.ok) {
        logger.error('❌ Failed to fetch payment methods:', {
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const data = await response.json();
      
      // Response format: { message: [...] }
      const paymentMethods = data.message || [];
      
      logger.log(`✅ Found ${paymentMethods.length} payment methods`);
      return paymentMethods;
    } catch (error: any) {
      logger.error('❌ Error fetching payment methods:', error);
      return [];
    }
  }

  /**
   * Get country-specific defaults
   * Endpoint: GET /supported/defaults/all
   * Docs: https://docs.onramper.com/reference/get_supported-defaults-all
   */
  static async getCountryDefaults(
    country?: string,
    apiKey?: string
  ): Promise<{
    recommended?: {
      source: string;
      target: string;
      amount: number;
      paymentMethod: string;
      provider: string;
      country: string;
    };
    defaults?: Record<string, {
      source: string;
      target: string;
      amount: number;
      paymentMethod: string;
      provider: string;
    }>;
  } | null> {
    try {
      if (!apiKey) {
        logger.warn('⚠️ Onramper API key not provided for getCountryDefaults');
        return null;
      }

      let url = `https://api.onramper.com/supported/defaults/all?type=buy`;
      
      // Add country if provided (otherwise Onramper auto-detects via IP)
      if (country) {
        url += `&country=${country.toLowerCase()}`;
      }

      logger.log('📊 Fetching country defaults:', { country: country || 'auto-detect' });

      // Try multiple authentication methods
      let response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok && (response.status === 401 || response.status === 403)) {
        // Fallback to query param
        const urlWithKey = `${url}${url.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
        response = await fetch(urlWithKey, {
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      if (!response.ok) {
        logger.error('❌ Failed to fetch country defaults:', {
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const data = await response.json();
      
      // Response format: { message: {...} }
      const defaults = data.message || {};
      
      logger.log('✅ Country defaults fetched:', { 
        hasRecommended: !!defaults.recommended,
        defaultCount: defaults.defaults ? Object.keys(defaults.defaults).length : 0,
      });
      return defaults;
    } catch (error: any) {
      logger.error('❌ Error fetching country defaults:', error);
      return null;
    }
  }

  /**
   * Get all provider quotes for comparison
   * Endpoint: GET /quotes/{fiat}/{crypto}
   * Docs: https://docs.onramper.com/reference/get_quotes-fiat-crypto
   * 
   * ⚠️ IMPORTANT: This endpoint returns DIRECT ARRAY (not in message field!)
   */
  static async getAllProviderQuotes(
    fiatAmount: number,
    fiatCurrency: string,
    cryptoCurrency: string,
    paymentMethod?: string,
    country?: string,
    apiKey?: string
  ): Promise<Array<{
    ramp: string;
    paymentMethod: string;
    rate?: number;
    networkFee?: number;
    transactionFee?: number;
    payout?: number;
    availablePaymentMethods?: Array<{ paymentTypeId: string; name: string; icon: string }>;
    quoteId?: string;
    recommendations?: string[];
    errors?: Array<{ type: string; errorId: number; message: string }>;
  }>> {
    try {
      if (!apiKey) {
        logger.warn('⚠️ Onramper API key not provided for getAllProviderQuotes');
        return [];
      }

      const fiatLower = fiatCurrency.toLowerCase();
      const cryptoLower = cryptoCurrency.toLowerCase();
      let url = `https://api.onramper.com/quotes/${fiatLower}/${cryptoLower}?amount=${fiatAmount}`;
      
      // ⚠️ CRITICAL: Always use paymentMethod filter when provided
      // Testing shows that Onramper correctly returns quotes with paymentMethod set
      // when we use the filter. For iDEAL, BANXA returns paymentMethod: "ideal" when
      // we use paymentMethod=ideal, but returns paymentMethod: "creditcard" when we don't.
      // Using the filter ensures quotes have the correct paymentMethod set.
      const paymentMethodLower = paymentMethod?.toLowerCase() || '';
      
      // Always use paymentMethod filter if provided
      if (paymentMethod) {
        url += `&paymentMethod=${paymentMethodLower}`;
      }
      
      // Add country if provided (otherwise Onramper auto-detects via IP)
      if (country) {
        url += `&country=${country.toLowerCase()}`;
      }

      logger.error('🔍 [OnramperService] ============================================');
      logger.error('🔍 [OnramperService] FETCHING ALL PROVIDER QUOTES');
      logger.error('🔍 [OnramperService] ============================================');
      logger.error('🔍 [OnramperService] Request Parameters:', {
        fiatAmount, 
        fiatCurrency, 
        cryptoCurrency, 
        paymentMethod: paymentMethod || 'NONE',
        country: country || 'auto-detect',
        url: url,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'MISSING',
      });

      // Try multiple authentication methods
      let response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok && (response.status === 401 || response.status === 403)) {
        // Fallback to query param
        const urlWithKey = `${url}${url.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
        response = await fetch(urlWithKey, {
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      if (!response.ok) {
        logger.error('❌ Failed to fetch quotes:', {
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const data = await response.json();
      
      logger.error('🔍 [OnramperService] ============================================');
      logger.error('🔍 [OnramperService] ONRAMPER API RESPONSE RECEIVED');
      logger.error('🔍 [OnramperService] ============================================');
      logger.error('🔍 [OnramperService] Response Status:', response.status, response.statusText);
      logger.error('🔍 [OnramperService] Response Type:', typeof data);
      logger.error('🔍 [OnramperService] Is Array:', Array.isArray(data));
      logger.error('🔍 [OnramperService] Response Keys:', data && typeof data === 'object' ? Object.keys(data) : 'N/A');
      logger.error('🔍 [OnramperService] Full Response (first 2000 chars):', JSON.stringify(data).substring(0, 2000));
      
      // ⚠️ CRITICAL: Quotes endpoint returns DIRECT ARRAY (not in message field!)
      let quotes = Array.isArray(data) ? data : (data.message || []);
      
      logger.error('🔍 [OnramperService] ============================================');
      logger.error('🔍 [OnramperService] PARSED QUOTES');
      logger.error('🔍 [OnramperService] ============================================');
      logger.error('🔍 [OnramperService] Total Quotes:', quotes.length);
      logger.error('🔍 [OnramperService] Quotes Type:', Array.isArray(quotes) ? 'ARRAY' : typeof quotes);
      
      // ⚠️ CRITICAL LOGGING: Log ALL quotes BEFORE any filtering, including payout/rate
      if (paymentMethod) {
        logger.error(`🔍 [OnramperService] RAW QUOTES FROM ONRAMPER (${quotes.length} total):`, {
          paymentMethod,
          totalQuotes: quotes.length,
          providers: quotes.map((q: any) => ({
            ramp: q.ramp,
            paymentMethod: q.paymentMethod,
            payout: q.payout,
            rate: q.rate,
            networkFee: q.networkFee,
            transactionFee: q.transactionFee,
            hasErrors: !!(q.errors && q.errors.length > 0),
            errorCount: q.errors?.length || 0,
            errors: q.errors?.map((e: any) => e.message || e.type) || [],
            availableMethods: q.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || []
          }))
        });
        
        // Log BANXA specifically for debugging
        const banxaQuote = quotes.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
        if (banxaQuote) {
          logger.error('🔍 [OnramperService] ============================================');
          logger.error('🔍 [OnramperService] BANXA RAW QUOTE (BEFORE ANY FILTERING)');
          logger.error('🔍 [OnramperService] ============================================');
          logger.error('🔍 [OnramperService] BANXA Quote Summary:', {
            ramp: banxaQuote.ramp,
            paymentMethod: banxaQuote.paymentMethod,
            payout: banxaQuote.payout,
            payoutType: typeof banxaQuote.payout,
            payoutIsUndefined: banxaQuote.payout === undefined,
            payoutIsNull: banxaQuote.payout === null,
            rate: banxaQuote.rate,
            rateType: typeof banxaQuote.rate,
            rateIsUndefined: banxaQuote.rate === undefined,
            rateIsNull: banxaQuote.rate === null,
            networkFee: banxaQuote.networkFee,
            transactionFee: banxaQuote.transactionFee,
            hasErrors: !!(banxaQuote.errors && banxaQuote.errors.length > 0),
            errorCount: banxaQuote.errors?.length || 0,
            errors: banxaQuote.errors,
            availableMethods: banxaQuote.availablePaymentMethods,
            availableMethodsCount: banxaQuote.availablePaymentMethods?.length || 0,
            allKeys: Object.keys(banxaQuote),
          });
          logger.error('🔍 [OnramperService] BANXA Full Quote JSON:', JSON.stringify(banxaQuote, null, 2));
        } else {
          logger.error('🔍 [OnramperService] ❌ BANXA QUOTE NOT FOUND IN RESPONSE');
          logger.error('🔍 [OnramperService] Available providers:', quotes.map((q: any) => q.ramp));
        }
      }
      
      // ⚠️ CRITICAL FIX: Onramper sometimes returns quotes with errors but STILL has payout/rate
      // We need to preserve the FULL quote object, including payout/rate even if there are errors
      // The errors might be warnings or non-critical issues that don't prevent quote calculation
      // We'll filter by payment method support, but keep quotes with payout/rate even if they have errors
      
      // ⚠️ CRITICAL: Don't filter out quotes with errors if they have payout/rate
      // Onramper sometimes returns quotes with errors BUT STILL includes payout/rate
      // This means the quote is valid and can be used, even if there are warnings/errors
      // We'll filter by payment method support, but keep quotes with payout/rate even if they have errors
      let validQuotes = quotes.filter((q: any) => {
        // ⚠️ CRITICAL: If quote has payout/rate, it's a valid quote (even with errors)
        // This is the key fix - quotes with payout/rate are usable, errors might just be warnings
        const hasPayoutOrRate = (q.payout !== undefined && q.payout !== null) || 
                                (q.rate !== undefined && q.rate !== null);
        
        if (hasPayoutOrRate) {
          // Quote has payout/rate - it's valid, keep it (even if it has errors)
          return true;
        }
        
        // If quote has the requested payment method set, keep it even if it has errors
        // (errors might be unrelated to payment method support)
        if (paymentMethod && q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethod.toLowerCase()) {
          return true;
        }
        
        // Otherwise, only keep quotes without errors
        return !q.errors || q.errors.length === 0;
      });
      
      // ⚠️ CRITICAL: Filter by payment method support if payment method is specified
      // This ensures we only return providers that actually support the selected payment method
      if (paymentMethod) {
        logger.error('🔍 [OnramperService] ============================================');
        logger.error('🔍 [OnramperService] FILTERING QUOTES (STEP 2: PAYMENT METHOD)');
        logger.error('🔍 [OnramperService] ============================================');
        logger.error('🔍 [OnramperService] Requested payment method:', paymentMethod);
        logger.error('🔍 [OnramperService] Starting with', validQuotes.length, 'valid quotes');
        
        const paymentMethodLower = paymentMethod.toLowerCase();
        const isIdeal = paymentMethodLower.includes('ideal');
        
        const filteredQuotes = validQuotes.filter((q: any) => {
          const ramp = q.ramp || 'unknown';
          
          // If quote already has the payment method set, it's supported
          if (q.paymentMethod && q.paymentMethod.toLowerCase() === paymentMethodLower) {
            logger.error(`🔍 [OnramperService] ✅ ${ramp}: KEEPING (paymentMethod=${q.paymentMethod} matches ${paymentMethodLower})`);
            return true;
          }
          
          // Check availablePaymentMethods array
          const methods = q.availablePaymentMethods || [];
          const methodIds = methods.map((pm: any) => (pm.paymentTypeId || pm.id || '').toLowerCase()).filter(Boolean);
          
          const supportsMethod = methodIds.some((idLower: string) => {
            // Exact match
            if (idLower === paymentMethodLower) {
              return true;
            }
            
            // For iDEAL, also check for variants (ideal, idealbanktransfer, etc.)
            if (isIdeal && idLower.includes('ideal')) {
              return true;
            }
            
            return false;
          });
          
          if (supportsMethod) {
            logger.error(`🔍 [OnramperService] ✅ ${ramp}: KEEPING (availablePaymentMethods contains ${paymentMethodLower})`);
            logger.error(`🔍 [OnramperService]    Available methods:`, methodIds);
            return true;
          }
          
          logger.error(`🔍 [OnramperService] ❌ ${ramp}: REJECTING (paymentMethod=${q.paymentMethod}, availableMethods=${methodIds.join(', ')})`);
          return false;
        });
        
        logger.error('🔍 [OnramperService] After Step 2 (payment method filter):', filteredQuotes.length, 'quotes');
        
        // Log BANXA after second filter
        const banxaAfterFilter2 = filteredQuotes.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
        if (banxaAfterFilter2) {
          logger.error('🔍 [OnramperService] BANXA after Step 2:', {
            ramp: banxaAfterFilter2.ramp,
            paymentMethod: banxaAfterFilter2.paymentMethod,
            payout: banxaAfterFilter2.payout,
            rate: banxaAfterFilter2.rate,
            hasErrors: !!(banxaAfterFilter2.errors && banxaAfterFilter2.errors.length > 0),
            availableMethods: banxaAfterFilter2.availablePaymentMethods?.map((pm: any) => pm.paymentTypeId || pm.id) || [],
          });
        } else {
          logger.error('🔍 [OnramperService] ❌ BANXA REMOVED IN STEP 2');
        }
        
        if (filteredQuotes.length > 0) {
          logger.error(`🔍 [OnramperService] ✅ Found ${filteredQuotes.length} providers supporting ${paymentMethod} (filtered from ${validQuotes.length} total)`);
          validQuotes = filteredQuotes;
        } else {
          logger.error(`🔍 [OnramperService] ⚠️ No providers found supporting ${paymentMethod} in availablePaymentMethods, using Onramper filter result`);
        }
      }
      
      logger.error('🔍 [OnramperService] ============================================');
      logger.error('🔍 [OnramperService] FINAL RESULT');
      logger.error('🔍 [OnramperService] ============================================');
      logger.error('🔍 [OnramperService] Original quotes:', quotes.length);
      logger.error('🔍 [OnramperService] Valid quotes after filtering:', validQuotes.length);
      logger.error('🔍 [OnramperService] Returning quotes:', validQuotes.length);
      
      // Log all final quotes
      validQuotes.forEach((q: any) => {
        logger.error(`🔍 [OnramperService] Final quote: ${q.ramp}`, {
          ramp: q.ramp,
          paymentMethod: q.paymentMethod,
          payout: q.payout,
          rate: q.rate,
          hasErrors: !!(q.errors && q.errors.length > 0),
        });
      });
      
      // Log BANXA in final result
      const banxaFinal = validQuotes.find((q: any) => q.ramp?.toLowerCase() === 'banxa');
      if (banxaFinal) {
        logger.error('🔍 [OnramperService] ============================================');
        logger.error('🔍 [OnramperService] BANXA FINAL QUOTE (RETURNING TO API ROUTE)');
        logger.error('🔍 [OnramperService] ============================================');
        logger.error('🔍 [OnramperService] BANXA Final:', JSON.stringify({
          ramp: banxaFinal.ramp,
          paymentMethod: banxaFinal.paymentMethod,
          payout: banxaFinal.payout,
          rate: banxaFinal.rate,
          networkFee: banxaFinal.networkFee,
          transactionFee: banxaFinal.transactionFee,
          hasErrors: !!(banxaFinal.errors && banxaFinal.errors.length > 0),
          errors: banxaFinal.errors,
          availableMethods: banxaFinal.availablePaymentMethods,
        }, null, 2));
      } else {
        logger.error('🔍 [OnramperService] ❌ BANXA NOT IN FINAL RESULT');
      }
      
      // ⚠️ CRITICAL: Always return filtered quotes when payment method is specified
      // This ensures frontend only sees providers that actually support the payment method
      if (paymentMethod) {
        return validQuotes;
      }
      
      // If no payment method specified, return all quotes (including errors) for comparison
      return quotes;
    } catch (error: any) {
      logger.error('❌ Error fetching all provider quotes:', error);
      return [];
    }
  }

  /**
   * Get transaction details
   * Endpoint: GET /transactions/{transactionId}
   * Docs: https://docs.onramper.com/reference/get_transactions-transactionid
   */
  static async getTransaction(
    transactionId: string,
    apiKey?: string,
    secretKey?: string
  ): Promise<{
    transactionId: string;
    onramp: string;
    status: string;
    paymentMethod: string;
    sourceCurrency: string;
    targetCurrency: string;
    inAmount: number;
    outAmount: number;
    country: string;
    walletAddress: string;
    statusDate: string;
    transactionHash?: string;
    onrampTransactionId?: string;
  } | null> {
    try {
      if (!apiKey || !secretKey) {
        logger.warn('⚠️ Onramper API key or secret key not provided for getTransaction');
        return null;
      }

      const url = `https://api.onramper.com/transactions/${transactionId}`;

      logger.log('📊 Fetching transaction details:', { transactionId });

      const response = await fetch(url, {
        headers: {
          'Authorization': apiKey,
          'x-onramper-secret': secretKey, // Required for transaction endpoint
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        logger.error('❌ Failed to fetch transaction:', {
          status: response.status,
          statusText: response.statusText,
        });
        return null;
      }

      const data = await response.json();
      
      // Response format: Direct object (not in message field)
      // { transactionId, onramp, status, paymentMethod, ... }
      
      logger.log('✅ Transaction details fetched:', { 
        transactionId: data.transactionId,
        onramp: data.onramp,
        status: data.status,
      });
      
      return {
        transactionId: data.transactionId,
        onramp: data.onramp,
        status: data.status,
        paymentMethod: data.paymentMethod,
        sourceCurrency: data.sourceCurrency,
        targetCurrency: data.targetCurrency,
        inAmount: data.inAmount,
        outAmount: data.outAmount,
        country: data.country,
        walletAddress: data.walletAddress,
        statusDate: data.statusDate,
        transactionHash: data.transactionHash,
        onrampTransactionId: data.onrampTransactionId,
      };
    } catch (error: any) {
      logger.error('❌ Error fetching transaction:', error);
      return null;
    }
  }
}

