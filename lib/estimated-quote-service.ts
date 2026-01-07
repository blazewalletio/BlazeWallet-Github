/**
 * Estimated Quote Service
 * Calculates realistic quotes for cryptocurrencies when Onramper doesn't provide payout/rate
 * Uses market rates + provider fee estimates
 */

import { priceService } from '@/lib/price-service';
import { logger } from '@/lib/logger';

export interface Quote {
  cryptoAmount: string;
  exchangeRate: string;
  fee: string;
  totalAmount: string;
  baseCurrency: string;
  quoteCurrency: string;
  isEstimated?: boolean;
}

export class EstimatedQuoteService {
  /**
   * Provider-specific fee estimates (as percentage of fiat amount)
   * Based on typical fees from each provider
   */
  private static readonly PROVIDER_FEES: Record<string, number> = {
    'moonpay': 0.045,        // ~4.5%
    'banxa': 0.04,           // ~4%
    'transak': 0.035,        // ~3.5%
    'ramp': 0.04,            // ~4%
    'onramp.money': 0.035,   // ~3.5%
    'guardarian': 0.04,      // ~4%
    'simplex': 0.05,         // ~5%
    'mercuryo': 0.04,        // ~4%
    'coinify': 0.04,         // ~4%
    'paybis': 0.04,          // ~4%
    'changelly': 0.05,       // ~5%
    'indacoin': 0.04,        // ~4%
  };

  /**
   * Default fee if provider not found
   */
  private static readonly DEFAULT_FEE = 0.04; // 4%

  /**
   * Network fee estimates per crypto (fixed amount in crypto)
   * These are typical network fees for transactions
   */
  private static readonly NETWORK_FEES: Record<string, number> = {
    'ETH': 0.001,      // ~$2-3 at current prices
    'SOL': 0.000005,   // ~$0.0005
    'BTC': 0.0001,     // ~$4-5
    'MATIC': 0.01,     // ~$0.008
    'BNB': 0.001,      // ~$0.30
    'AVAX': 0.001,     // ~$0.025
    'USDT': 0,         // USDT transfers typically have no network fee (or very small)
    'USDC': 0,         // USDC transfers typically have no network fee (or very small)
  };

  /**
   * Calculate estimated quote based on market rate and provider fees
   */
  static async calculate(
    fiatAmount: number,
    fiatCurrency: string,
    cryptoCurrency: string,
    provider: string
  ): Promise<Quote & { isEstimated: true }> {
    try {
      logger.log(`📊 [EstimatedQuote] Calculating quote for ${cryptoCurrency} via ${provider}`);

      // Step 1: Get current market rate
      const marketRate = await this.getMarketRate(cryptoCurrency, fiatCurrency);
      
      if (marketRate <= 0) {
        throw new Error(`Invalid market rate for ${cryptoCurrency}: ${marketRate}`);
      }

      logger.log(`💰 [EstimatedQuote] Market rate: 1 ${cryptoCurrency} = ${marketRate} ${fiatCurrency}`);

      // Step 2: Get provider fee percentage
      const feePercentage = this.getProviderFee(provider);
      logger.log(`💳 [EstimatedQuote] Provider fee: ${(feePercentage * 100).toFixed(2)}%`);

      // Step 3: Calculate fees
      const providerFee = fiatAmount * feePercentage;
      const networkFeeCrypto = this.getNetworkFee(cryptoCurrency);
      const networkFeeFiat = networkFeeCrypto * marketRate;
      const totalFee = providerFee + networkFeeFiat;

      // Step 4: Calculate crypto amount (after all fees)
      const amountAfterFees = fiatAmount - totalFee;
      const cryptoAmount = amountAfterFees / marketRate;

      // Step 5: Calculate exchange rate (fiat per crypto)
      const exchangeRate = fiatAmount / cryptoAmount;

      logger.log(`✅ [EstimatedQuote] Calculated quote:`, {
        fiatAmount,
        cryptoAmount: cryptoAmount.toFixed(8),
        totalFee: totalFee.toFixed(2),
        exchangeRate: exchangeRate.toFixed(2),
      });

      return {
        cryptoAmount: cryptoAmount.toFixed(8),
        exchangeRate: exchangeRate.toFixed(2),
        fee: totalFee.toFixed(2),
        totalAmount: fiatAmount.toFixed(2),
        baseCurrency: fiatCurrency,
        quoteCurrency: cryptoCurrency,
        isEstimated: true,
      };
    } catch (error: any) {
      logger.error(`❌ [EstimatedQuote] Error calculating quote:`, error);
      throw error;
    }
  }

  /**
   * Get market rate for crypto in fiat currency
   */
  private static async getMarketRate(
    cryptoCurrency: string,
    fiatCurrency: string
  ): Promise<number> {
    try {
      // Get price in USD first
      const priceUSD = await priceService.getPrice(cryptoCurrency);
      
      if (priceUSD <= 0) {
        throw new Error(`Invalid price for ${cryptoCurrency}: ${priceUSD}`);
      }

      // Convert to requested fiat currency
      if (fiatCurrency.toUpperCase() === 'USD') {
        return priceUSD;
      }

      // Get fiat exchange rate
      const fiatRate = await this.getFiatExchangeRate(fiatCurrency);
      return priceUSD * fiatRate;
    } catch (error: any) {
      logger.error(`❌ [EstimatedQuote] Error getting market rate:`, error);
      throw error;
    }
  }

  /**
   * Get fiat exchange rate (1 USD = X FIAT)
   */
  private static async getFiatExchangeRate(fiatCurrency: string): Promise<number> {
    const rates: Record<string, number> = {
      'EUR': 0.92,
      'GBP': 0.79,
      'JPY': 149,
      'AUD': 1.53,
      'CAD': 1.36,
      'CHF': 0.88,
      'CNY': 7.24,
      'NOK': 10.5,
      'SEK': 10.3,
      'DKK': 6.85,
    };

    return rates[fiatCurrency.toUpperCase()] || 1; // Default to 1 if not found
  }

  /**
   * Get provider fee percentage
   */
  private static getProviderFee(provider: string): number {
    const providerLower = provider.toLowerCase();
    return this.PROVIDER_FEES[providerLower] || this.DEFAULT_FEE;
  }

  /**
   * Get network fee in crypto
   */
  private static getNetworkFee(cryptoCurrency: string): number {
    return this.NETWORK_FEES[cryptoCurrency.toUpperCase()] || 0;
  }

  /**
   * Calculate estimated quotes for multiple providers
   */
  static async calculateForProviders(
    fiatAmount: number,
    fiatCurrency: string,
    cryptoCurrency: string,
    providers: Array<{ ramp: string }>
  ): Promise<Array<Quote & { isEstimated: true; provider: string }>> {
    const quotes = await Promise.all(
      providers.map(async (provider) => {
        try {
          const quote = await this.calculate(
            fiatAmount,
            fiatCurrency,
            cryptoCurrency,
            provider.ramp
          );
          return {
            ...quote,
            provider: provider.ramp,
          };
        } catch (error: any) {
          logger.error(`❌ [EstimatedQuote] Failed for ${provider.ramp}:`, error);
          return null;
        }
      })
    );

    return quotes.filter((q): q is Quote & { isEstimated: true; provider: string } => q !== null);
  }
}

