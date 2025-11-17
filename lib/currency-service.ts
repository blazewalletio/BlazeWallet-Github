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

        if (profile?.preferred_currency && this.isValidCurrency(profile.preferred_currency)) {
          // Sync to localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('preferredCurrency', profile.preferred_currency);
          }
          return profile.preferred_currency as SupportedCurrency;
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

    try {
      // Use CoinGecko API for crypto prices and exchange rates
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd,eur,gbp,jpy,aud,cad,chf,cny'
      );

      if (!response.ok) throw new Error('Failed to fetch exchange rates');

      const data = await response.json();

      // Update rates (base is always USD = 1)
      this.rates = {
        USD: 1,
        EUR: 1 / 0.92, // Approximate EUR/USD rate
        GBP: 1 / 0.79, // Approximate GBP/USD rate
        JPY: 1 / 149,  // Approximate JPY/USD rate
        AUD: 1 / 1.53, // Approximate AUD/USD rate
        CAD: 1 / 1.36, // Approximate CAD/USD rate
        CHF: 1 / 0.88, // Approximate CHF/USD rate
        CNY: 1 / 7.24, // Approximate CNY/USD rate
        BTC: data.bitcoin?.usd || 0,
        ETH: data.ethereum?.usd || 0
      };

      // Fetch fiat exchange rates from exchangerate-api.com (free tier)
      try {
        const fiatResponse = await fetch(
          'https://api.exchangerate-api.com/v4/latest/USD'
        );
        
        if (fiatResponse.ok) {
          const fiatData = await fiatResponse.json();
          this.rates = {
            ...this.rates,
            USD: 1,
            EUR: 1 / fiatData.rates.EUR,
            GBP: 1 / fiatData.rates.GBP,
            JPY: 1 / fiatData.rates.JPY,
            AUD: 1 / fiatData.rates.AUD,
            CAD: 1 / fiatData.rates.CAD,
            CHF: 1 / fiatData.rates.CHF,
            CNY: 1 / fiatData.rates.CNY
          };
        }
      } catch (error) {
        logger.warn('Failed to fetch fiat exchange rates, using fallback:', error);
      }

      this.lastUpdate = now;
      logger.log('Exchange rates updated:', this.rates);
    } catch (error) {
      logger.error('Failed to fetch exchange rates:', error);
      // Keep using cached rates
    }

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

    // For BTC/ETH, divide by the rate (since rate is in USD)
    if (targetCurrency === 'BTC' || targetCurrency === 'ETH') {
      return usdAmount / rate;
    }

    // For fiat, divide by the rate (since our rates are USD-to-X)
    return usdAmount / rate;
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

