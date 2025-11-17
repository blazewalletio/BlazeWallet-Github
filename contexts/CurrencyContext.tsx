'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { currencyService, SupportedCurrency, CURRENCIES } from '@/lib/currency-service';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface CurrencyContextType {
  currency: SupportedCurrency;
  symbol: string;
  setCurrency: (currency: SupportedCurrency) => Promise<void>;
  formatUSD: (usdAmount: number) => Promise<string>;
  formatUSDSync: (usdAmount: number) => string;
  convertUSD: (usdAmount: number) => Promise<number>;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<SupportedCurrency>('USD');
  const [symbol, setSymbol] = useState<string>('$');
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({ USD: 1 });

  // Load preferred currency on mount
  useEffect(() => {
    loadPreferredCurrency();
  }, []);

  // Update exchange rates every 5 minutes
  useEffect(() => {
    updateExchangeRates();
    const interval = setInterval(updateExchangeRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadPreferredCurrency = async () => {
    try {
      const preferred = await currencyService.getPreferredCurrency();
      setCurrencyState(preferred);
      setSymbol(CURRENCIES[preferred].symbol);
    } catch (error) {
      logger.error('Failed to load preferred currency:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateExchangeRates = async () => {
    try {
      const rates = await currencyService.getExchangeRates();
      setExchangeRates(rates);
      logger.log('Exchange rates updated in context');
    } catch (error) {
      logger.error('Failed to update exchange rates:', error);
    }
  };

  const setCurrency = async (newCurrency: SupportedCurrency) => {
    try {
      // Update state immediately
      setCurrencyState(newCurrency);
      setSymbol(CURRENCIES[newCurrency].symbol);

      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('preferredCurrency', newCurrency);
      }

      // Save to Supabase (if logged in)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_profiles')
          .update({ preferred_currency: newCurrency })
          .eq('user_id', user.id);

        // Log activity
        await supabase.rpc('log_user_activity', {
          p_user_id: user.id,
          p_activity_type: 'settings_change',
          p_description: `Currency changed to ${newCurrency}`,
          p_metadata: JSON.stringify({ currency: newCurrency })
        });
      }

      logger.log('Currency updated to:', newCurrency);
    } catch (error) {
      logger.error('Failed to update currency:', error);
    }
  };

  const formatUSD = async (usdAmount: number): Promise<string> => {
    try {
      return await currencyService.formatInPreferredCurrency(usdAmount);
    } catch (error) {
      logger.error('Format error:', error);
      return `$${usdAmount.toFixed(2)}`;
    }
  };

  // Synchronous version using cached rates
  const formatUSDSync = (usdAmount: number): string => {
    if (currency === 'USD') {
      return `$${usdAmount.toFixed(2)}`;
    }

    const rate = exchangeRates[currency];
    if (!rate || rate === 0) {
      return `$${usdAmount.toFixed(2)}`;
    }

    let converted: number;
    if (currency === 'BTC' || currency === 'ETH') {
      converted = usdAmount / rate;
    } else {
      converted = usdAmount / rate;
    }

    const info = CURRENCIES[currency];
    return `${info.symbol}${converted.toFixed(info.decimals)}`;
  };

  const convertUSD = async (usdAmount: number): Promise<number> => {
    try {
      return await currencyService.convert(usdAmount, currency);
    } catch (error) {
      logger.error('Conversion error:', error);
      return usdAmount;
    }
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        symbol,
        setCurrency,
        formatUSD,
        formatUSDSync,
        convertUSD,
        isLoading
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}

