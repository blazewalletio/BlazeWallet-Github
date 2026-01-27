/**
 * TokenLogo Component
 * Displays token logos with multi-layer caching for optimal performance
 */

import React, { useState, useEffect } from 'react';
import { TokenLogoCache } from '@/lib/token-logo-cache';

interface TokenLogoProps {
  symbol: string;
  address: string;
  chainKey: string;
  logoURI?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg',
};

export const TokenLogo: React.FC<TokenLogoProps> = ({
  symbol,
  address,
  chainKey,
  logoURI,
  size = 'md',
  className = '',
}) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadLogo = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        // Fetch via multi-layer cache
        const url = await TokenLogoCache.getTokenLogo(
          { symbol, address, chainKey },
          logoURI
        );

        if (isMounted) {
          if (url) {
            setLogoUrl(url);
          } else {
            setHasError(true);
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('TokenLogo: Failed to load logo', error);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    loadLogo();

    return () => {
      isMounted = false;
    };
  }, [symbol, address, chainKey, logoURI]);

  const sizeClass = sizeClasses[size];

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`${sizeClass} ${className} rounded-full bg-gradient-to-br from-gray-600 to-gray-700 animate-pulse`}
      />
    );
  }

  // Error state or no logo - show letter placeholder
  if (hasError || !logoUrl) {
    const firstLetter = symbol.charAt(0).toUpperCase();
    return (
      <div
        className={`${sizeClass} ${className} rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-bold text-white`}
      >
        {firstLetter}
      </div>
    );
  }

  // Success - show logo
  return (
    <img
      src={logoUrl}
      alt={`${symbol} logo`}
      className={`${sizeClass} ${className} rounded-full object-cover`}
      onError={() => setHasError(true)}
    />
  );
};
