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
  useCurrencyPrefix?: boolean; // NEW: Use dynamic currency prefix
}

export default function AnimatedNumber({ 
  value, 
  decimals = 2, 
  prefix = '', 
  suffix = '',
  className = '',
  useCurrencyPrefix = false
}: AnimatedNumberProps) {
  const { symbol, formatUSDSync } = useCurrency();
  
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
    spring.set(value);
  }, [spring, value]);

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
