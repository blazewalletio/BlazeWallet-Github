'use client';

import { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useCurrency } from '@/contexts/CurrencyContext';
import { logger } from '@/lib/logger';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  useCurrencyPrefix?: boolean; // Use dynamic currency prefix
  isUSD?: boolean; // NEW: If true, value is in USD and needs conversion
}

export default function AnimatedNumber({ 
  value, 
  decimals = 2, 
  prefix = '', 
  suffix = '',
  className = '',
  useCurrencyPrefix = false,
  isUSD = true // Default: assume value is in USD
}: AnimatedNumberProps) {
  const { symbol, formatUSDSync, selectedCurrency, exchangeRates } = useCurrency();
  
  // Convert USD to selected currency if needed
  const convertedValue = isUSD && useCurrencyPrefix ? (() => {
    if (selectedCurrency === 'USD' || !exchangeRates[selectedCurrency]) {
      return value;
    }
    // For crypto (BTC/ETH), divide by rate
    if (selectedCurrency === 'BTC' || selectedCurrency === 'ETH') {
      return value / exchangeRates[selectedCurrency];
    }
    // For fiat, multiply by rate
    return value * exchangeRates[selectedCurrency];
  })() : value;
  
  // Use currency symbol if requested
  const actualPrefix = useCurrencyPrefix ? symbol : prefix;
  
  const spring = useSpring(0, { 
    stiffness: 100, 
    damping: 30,
    restDelta: 0.001 
  });
  const display = useTransform(spring, (current) =>
    `${actualPrefix}${current.toFixed(decimals)}${suffix}`
  );

  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    spring.set(convertedValue);
  }, [spring, convertedValue]);

  useEffect(() => {
    const unsubscribe = display.on('change', (latest) => {
      setDisplayValue(latest);
    });
    return unsubscribe;
  }, [display]);

  return (
    <span className={className}>
      {displayValue || `${actualPrefix}0${suffix}`}
    </span>
  );
}
