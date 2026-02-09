/**
 * Currency Service
 * Handles currency conversion and formatting across the entire wallet
 */

import { logger } from './logger';

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AUD' | 'CAD' | 'CHF' | 'CNY' | 'BTC' | 'ETH';

interface ExchangeRates {
  [key: string]: number;
}

interface CurrencyInfo {
  code: SupportedCurrency;
  symbol: string;
  name: string;
  decimals: number;
}

export const CURRENCIES: Record<SupportedCurrency, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimals: 2 },
  CHF: { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc', decimals: 2 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimals: 2 },
  BTC: { code: 'BTC', symbol: '₿', name: 'Bitcoin', decimals: 8 },
  ETH: { code: 'ETH', symbol: 'Ξ', name: 'Ethereum', decimals: 6 }
};

class CurrencyService {
  private rates: ExchangeRates = { USD: 1 }; // Base is USD
  private lastUpdate: number = 0;
  private updateInterval = 5 * 60 * 1000; // Update every 5 minutes

  /**
   * Get current preferred currency from localStorage or Supabase
   */
  async getPreferredCurrency(): Promise<SupportedCurrency> {
    // First check localStorage for instant access
    const stored = typeof window !== 'undefined' ? localStorage.getItem('preferredCurrency') : null;
    if (stored && this.isValidCurrency(stored)) {
      return stored as SupportedCurrency;
    }

    // Then check Supabase (if logged in)
    try {
      const { supabase } = await import('./supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('preferred_currency')
          .eq('user_id', user.id)
          .single();

        if (profile && (profile as any).preferred_currency && this.isValidCurrency((profile as any).preferred_currency)) {
          // Sync to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('preferredCurrency', (profile as any).preferred_currency);
          }
          return (profile as any).preferred_currency as SupportedCurrency;
        }
      }
    } catch (error) {
      logger.error('Failed to fetch preferred currency from Supabase:', error);
    }

    return 'USD'; // Default
  }

  /**
   * Get exchange rates (updates every 5 minutes)
   */
  async getExchangeRates(): Promise<ExchangeRates> {
    const now = Date.now();
    
    // Return cached rates if still fresh
    if (now - this.lastUpdate < this.updateInterval && Object.keys(this.rates).length > 1) {
      return this.rates;
    }

    // Fetch real-time fiat exchange rates
    try {
      const fiatResponse = await fetch(
        'https://api.exchangerate-api.com/v4/latest/USD'
      );
      
      if (fiatResponse.ok) {
        const fiatData = await fiatResponse.json();
        // fiatData.rates gives us 1 USD = X CURRENCY (direct rates)
        this.rates = {
          USD: 1,
          EUR: fiatData.rates.EUR,
          GBP: fiatData.rates.GBP,
          JPY: fiatData.rates.JPY,
          AUD: fiatData.rates.AUD,
          CAD: fiatData.rates.CAD,
          CHF: fiatData.rates.CHF,
          CNY: fiatData.rates.CNY,
          BTC: 0, // Will be updated below from CoinGecko
          ETH: 0  // Will be updated below from CoinGecko
        };
        logger.log('✅ Real-time fiat rates loaded');
      } else {
        throw new Error('Fiat API failed');
      }
    } catch (error) {
      // Fallback to hardcoded rates if API fails
      logger.warn('⚠️ Using fallback fiat rates:', error);
      this.rates = {
        USD: 1,
        EUR: 0.92,  // Fallback: 1 USD = 0.92 EUR
        GBP: 0.79,  // Fallback: 1 USD = 0.79 GBP
        JPY: 149,   // Fallback: 1 USD = 149 JPY
        AUD: 1.53,  // Fallback: 1 USD = 1.53 AUD
        CAD: 1.36,  // Fallback: 1 USD = 1.36 CAD
        CHF: 0.88,  // Fallback: 1 USD = 0.88 CHF
        CNY: 7.24,  // Fallback: 1 USD = 7.24 CNY
        BTC: 0,
        ETH: 0
      };
    }

    // Fetch crypto prices from CoinGecko
    try {
      // ✅ Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const cryptoResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd',
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);

      if (cryptoResponse.ok) {
        const cryptoData = await cryptoResponse.json();
        this.rates.BTC = cryptoData.bitcoin?.usd || 0;
        this.rates.ETH = cryptoData.ethereum?.usd || 0;
        if (process.env.NODE_ENV === 'development') {
          logger.log('✅ Real-time crypto prices loaded');
        }
      }
    } catch (error: any) {
      // ✅ Better error handling - only log in development, not as warning
      if (error?.name === 'AbortError' || error?.message?.includes('timeout') || error?.message?.includes('QUIC') || error?.message?.includes('Failed to fetch')) {
        // Network timeout/error - use fallback rates (already set above)
        if (process.env.NODE_ENV === 'development') {
          logger.log('ℹ️ [CurrencyService] Network timeout fetching crypto prices (using fallback)');
        }
      } else if (process.env.NODE_ENV === 'development') {
        logger.warn('⚠️ Failed to fetch crypto prices:', error);
      }
    }

    this.lastUpdate = now;
    logger.log('💱 Exchange rates updated:', this.rates);

    return this.rates;
  }

  /**
   * Convert USD amount to target currency
   */
  async convert(usdAmount: number, targetCurrency: SupportedCurrency): Promise<number> {
    if (targetCurrency === 'USD') return usdAmount;

    const rates = await this.getExchangeRates();
    const rate = rates[targetCurrency];

    if (!rate || rate === 0) {
      logger.warn(`No exchange rate for ${targetCurrency}, returning USD amount`);
      return usdAmount;
    }

    // For BTC/ETH, divide by the rate (since rate is price in USD per coin)
    if (targetCurrency === 'BTC' || targetCurrency === 'ETH') {
      return usdAmount / rate;
    }

    // For fiat currencies, multiply by the rate (1 USD = X CURRENCY)
    return usdAmount * rate;
  }

  /**
   * Format amount with currency symbol
   */
  format(amount: number, currency: SupportedCurrency, showCode = false): string {
    const info = CURRENCIES[currency];
    const formatted = amount.toFixed(info.decimals);

    if (showCode) {
      return `${info.symbol}${formatted} ${currency}`;
    }

    return `${info.symbol}${formatted}`;
  }

  /**
   * Format USD amount in preferred currency
   */
  async formatInPreferredCurrency(usdAmount: number, showCode = false): Promise<string> {
    const currency = await this.getPreferredCurrency();
    const converted = await this.convert(usdAmount, currency);
    return this.format(converted, currency, showCode);
  }

  /**
   * Get currency symbol for preferred currency
   */
  async getPreferredCurrencySymbol(): Promise<string> {
    const currency = await this.getPreferredCurrency();
    return CURRENCIES[currency].symbol;
  }

  /**
   * Check if currency code is valid
   */
  private isValidCurrency(code: string): boolean {
    return Object.keys(CURRENCIES).includes(code);
  }
}

// Export singleton instance
export const currencyService = new CurrencyService();

// Export helper hook for React components
export function useCurrency() {
  return {
    format: (usdAmount: number) => currencyService.formatInPreferredCurrency(usdAmount),
    convert: (usdAmount: number, currency: SupportedCurrency) => currencyService.convert(usdAmount, currency),
    getSymbol: () => currencyService.getPreferredCurrencySymbol(),
    getCurrency: () => currencyService.getPreferredCurrency()
  };
}

