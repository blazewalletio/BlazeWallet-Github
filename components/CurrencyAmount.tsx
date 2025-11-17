'use client';

import { useCurrency } from '@/contexts/CurrencyContext';

interface CurrencyAmountProps {
  usdAmount: number;
  decimals?: number;
  className?: string;
}

export function CurrencyAmount({ usdAmount, decimals, className = '' }: CurrencyAmountProps) {
  const { formatUSDSync } = useCurrency();
  
  const formatted = formatUSDSync(usdAmount);
  
  return <span className={className}>{formatted}</span>;
}

export function CurrencySymbol({ className = '' }: { className?: string }) {
  const { symbol } = useCurrency();
  return <span className={className}>{symbol}</span>;
}

