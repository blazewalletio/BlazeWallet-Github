// Onramper integration for fiat on-ramp
// Docs: https://docs.onramper.com/docs/integration-steps
// Widget integration - Simple and powerful fiat-to-crypto solution

import { logger } from '@/lib/logger';

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

  // Get supported assets by chain
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
    };

    return assetMap[chainId] || ['ETH'];
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
      const url = `https://api.onramper.com/quotes/${fiatLower}/${cryptoLower}?amount=${fiatAmount}${paymentMethod ? `&paymentMethod=${paymentMethod}` : ''}`;
      
      logger.log('📊 Fetching Onramper quote:', { url: url.replace(apiKey, '***'), fiatAmount, fiatCurrency, cryptoCurrency });

      // Try both formats: direct API key and Bearer token
      // Onramper docs are unclear, so we'll try Bearer first (most common)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`, // Try Bearer format first
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ Onramper quote API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          url: url.replace(apiKey, '***'),
        });
        
        // If Bearer fails with 401/403, try direct API key
        if (response.status === 401 || response.status === 403) {
          logger.log('🔄 Retrying with direct API key (no Bearer)...');
          const retryResponse = await fetch(url, {
            headers: {
              'Authorization': apiKey, // Direct API key
              'Accept': 'application/json',
            },
          });
          
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text();
            logger.error('❌ Onramper quote API error (retry):', {
              status: retryResponse.status,
              statusText: retryResponse.statusText,
              error: retryErrorText,
            });
            return null;
          }
          
          // Success with direct API key - parse response
          const retryData = await retryResponse.json();
          logger.log('✅ Onramper quote response (direct API key):', JSON.stringify(retryData, null, 2).substring(0, 500));
          return OnramperService.parseQuoteResponse(retryData, fiatAmount);
        }
        
        return null;
      }

      const data = await response.json();
      
      logger.log('📊 Onramper quote response (full):', JSON.stringify(data, null, 2));
      
      return OnramperService.parseQuoteResponse(data, fiatAmount);
    } catch (error) {
      logger.error('Error fetching Onramper quote:', error);
      return null;
    }
  }

  // Helper method to parse quote response
  private static parseQuoteResponse(data: any, fiatAmount: number): {
    cryptoAmount: string;
    exchangeRate: string;
    fee: string;
    totalAmount: string;
  } | null {
      // Onramper returns an array of quotes from different providers
      // Each quote object structure can vary, but typically includes:
      // - destinationAmount (crypto amount)
      // - sourceAmount (fiat amount)
      // - exchangeRate
      // - fee or totalFee
      // - provider info
      if (Array.isArray(data) && data.length > 0) {
        logger.log(`📊 Found ${data.length} quotes from Onramper`);
        
        // Find the best quote (lowest fee or best rate)
        const bestQuote = data.reduce((best, current) => {
          // Prefer quotes with lower fees or better rates
          const bestFee = parseFloat(best.fee || best.totalFee || '0');
          const currentFee = parseFloat(current.fee || current.totalFee || '0');
          return currentFee < bestFee ? current : best;
        });
        
        logger.log('📊 Best quote selected:', JSON.stringify(bestQuote, null, 2));
        
        // Extract values from Onramper response format
        // Try multiple possible field names
        const cryptoAmount = bestQuote.destinationAmount || 
                            bestQuote.cryptoAmount || 
                            bestQuote.amount || 
                            bestQuote.destination_amount ||
                            '0';
        const sourceAmount = bestQuote.sourceAmount || 
                            bestQuote.source_amount || 
                            bestQuote.fiatAmount ||
                            fiatAmount.toString();
        const fee = bestQuote.fee || 
                   bestQuote.totalFee || 
                   bestQuote.total_fee ||
                   '0';
        
        // Calculate exchange rate if not provided
        const cryptoAmountNum = parseFloat(cryptoAmount.toString());
        const sourceAmountNum = parseFloat(sourceAmount.toString());
        let exchangeRate = bestQuote.exchangeRate || bestQuote.exchange_rate;
        
        if (!exchangeRate && cryptoAmountNum > 0 && sourceAmountNum > 0) {
          exchangeRate = (sourceAmountNum / cryptoAmountNum).toString();
        } else if (!exchangeRate) {
          exchangeRate = '0';
        }
        
        logger.log('✅ Parsed Onramper quote:', { 
          cryptoAmount: cryptoAmount.toString(), 
          exchangeRate: exchangeRate.toString(), 
          fee: fee.toString(), 
          totalAmount: sourceAmount.toString() 
        });
        
        // Validate that we have valid data
        if (parseFloat(cryptoAmount.toString()) <= 0) {
          logger.error('❌ Invalid crypto amount in quote:', cryptoAmount);
          return null;
        }
        
        return {
          cryptoAmount: cryptoAmount.toString(),
          exchangeRate: exchangeRate.toString(),
          fee: fee.toString(),
          totalAmount: sourceAmount.toString(),
        };
      }
      
      // Check if response is a single object (not array)
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        logger.log('📊 Single quote object received');
        
        const cryptoAmount = data.destinationAmount || 
                            data.cryptoAmount || 
                            data.amount || 
                            data.destination_amount ||
                            '0';
        const sourceAmount = data.sourceAmount || 
                            data.source_amount || 
                            data.fiatAmount ||
                            fiatAmount.toString();
        const fee = data.fee || 
                   data.totalFee || 
                   data.total_fee ||
                   '0';
        
        const cryptoAmountNum = parseFloat(cryptoAmount.toString());
        const sourceAmountNum = parseFloat(sourceAmount.toString());
        let exchangeRate = data.exchangeRate || data.exchange_rate;
        
        if (!exchangeRate && cryptoAmountNum > 0 && sourceAmountNum > 0) {
          exchangeRate = (sourceAmountNum / cryptoAmountNum).toString();
        } else if (!exchangeRate) {
          exchangeRate = '0';
        }
        
        if (parseFloat(cryptoAmount.toString()) <= 0) {
          logger.error('❌ Invalid crypto amount in quote:', cryptoAmount);
          return null;
        }
        
        return {
          cryptoAmount: cryptoAmount.toString(),
          exchangeRate: exchangeRate.toString(),
          fee: fee.toString(),
          totalAmount: sourceAmount.toString(),
        };
      }
      
      logger.error('❌ Unexpected Onramper quote response format:', JSON.stringify(data, null, 2));
      return null;
  }

  // Get supported data (payment methods, fiat currencies, crypto currencies)
  // Docs: https://docs.onramper.com/reference/get_supported
  // Endpoint: GET https://api.onramper.com/supported
  static async getSupportedData(apiKey?: string): Promise<{
    paymentMethods: Array<{ id: string; name: string; icon: string; processingTime: string; fee: string }>;
    fiatCurrencies: string[];
    cryptoCurrencies: string[];
  } | null> {
    try {
      if (!apiKey) {
        logger.warn('Onramper API key not provided - returning fallback data');
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

      const response = await fetch('https://api.onramper.com/supported', {
        headers: {
          'Authorization': apiKey, // Onramper uses API key directly, not Bearer token
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Onramper supported data API error:', response.status, errorText);
        // Return default data if API fails
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

      const data = await response.json();
      
      // Transform Onramper response to our format
      return {
        paymentMethods: data.paymentMethods || [
          { id: 'ideal', name: 'iDEAL', icon: 'ideal', processingTime: 'Instant', fee: '€0.50' },
          { id: 'card', name: 'Credit Card', icon: 'card', processingTime: '2-5 min', fee: '€2.00' },
          { id: 'bank', name: 'Bank Transfer', icon: 'bank', processingTime: '1-3 days', fee: '€0.00' },
        ],
        fiatCurrencies: data.fiatCurrencies || ['EUR', 'USD', 'GBP'],
        cryptoCurrencies: data.cryptoCurrencies || ['ETH', 'USDT', 'USDC', 'BTC', 'SOL'],
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

  // Create transaction via Onramper API
  // Docs: https://docs.onramper.com/reference/post_checkout-intent
  // Endpoint: POST https://api.onramper.com/checkout/intent
  static async createTransaction(
    fiatAmount: number,
    fiatCurrency: string,
    cryptoCurrency: string,
    walletAddress: string,
    paymentMethod: string,
    apiKey?: string
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

      // Onramper checkout intent format
      // Docs: https://docs.onramper.com/reference/post_checkout-intent
      const requestBody = {
        sourceCurrency: fiatCurrency.toLowerCase(),
        destinationCurrency: cryptoCurrency.toLowerCase(),
        sourceAmount: fiatAmount,
        destinationWalletAddress: walletAddress,
        paymentMethod: paymentMethod,
      };

      logger.log('📊 Creating Onramper transaction:', {
        ...requestBody,
        destinationWalletAddress: walletAddress.substring(0, 10) + '...',
      });

      const response = await fetch('https://api.onramper.com/checkout/intent', {
        method: 'POST',
        headers: {
          'Authorization': apiKey, // Onramper uses API key directly, not Bearer token
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ Onramper create transaction API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        });
        return null;
      }

      const data = await response.json();
      
      logger.log('📊 Onramper transaction response (full):', JSON.stringify(data, null, 2));
      
      // Extract transaction info from Onramper response
      // Response format (from docs):
      // {
      //   "message": { ... },
      //   "transactionInformation": {
      //     "transactionId": "01H9KBT5C21JY0BAX4VTW9EP3V",
      //     "url": "https://buy.moonpay.com?...",
      //     "type": "iframe",
      //     "params": { ... }
      //   }
      // }
      const transactionInfo = data.transactionInformation;
      
      if (!transactionInfo) {
        logger.error('❌ No transactionInformation in Onramper response. Full response:', JSON.stringify(data, null, 2));
        return null;
      }
      
      // Extract values according to Onramper API documentation
      const transactionId = transactionInfo.transactionId || '';
      const paymentUrl = transactionInfo.url || ''; // CRITICAL: It's "url", not "redirectUrl"!
      const status = 'PENDING'; // Transactions start as PENDING
      
      logger.log('📊 Extracted transaction info:', { 
        transactionId, 
        paymentUrl: paymentUrl ? paymentUrl.substring(0, 50) + '...' : 'MISSING', 
        status,
        hasUrl: !!transactionInfo.url,
        hasTransactionId: !!transactionInfo.transactionId,
        type: transactionInfo.type,
      });
      
      if (!paymentUrl) {
        logger.error('❌ No payment URL (url field) in transactionInformation. Full response:', JSON.stringify(data, null, 2));
        return null;
      }
      
      if (!transactionId) {
        logger.warn('⚠️ No transaction ID in Onramper response, but payment URL exists');
      }
      
      logger.log('✅ Onramper transaction created successfully:', { 
        transactionId: transactionId || 'N/A', 
        paymentUrl: paymentUrl.substring(0, 50) + '...', 
        status 
      });
      
      return {
        transactionId: transactionId || 'pending',
        paymentUrl,
        status,
      };
    } catch (error) {
      logger.error('Error creating Onramper transaction:', error);
      return null;
    }
  }
}

