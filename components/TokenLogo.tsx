/**
 * TokenLogo Component - Smart token logo rendering with fallback
 * 
 * Features:
 * - Dynamic logo loading via TokenLogoService
 * - Automatic fallback to placeholder
 * - Loading states
 * - Error handling
 */

'use client';

import { useState, useEffect } from 'react';
import { TokenLogoService } from '@/lib/token-logo-service';

interface TokenLogoProps {
  symbol: string;
  address: string;
  chainKey: string;
  logoURI?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TokenLogo({ 
  symbol, 
  address, 
  chainKey, 
  logoURI, 
  size = 'md',
  className = ''
}: TokenLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(logoURI || null);
  const [isLoading, setIsLoading] = useState(!logoURI);
  const [hasError, setHasError] = useState(false);

  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16',
  };

  const sizeClass = sizeClasses[size];

  // Fetch logo dynamically if not provided
  useEffect(() => {
    let isMounted = true;

    if (!logoURI && !hasError) {
      setIsLoading(true);
      
      TokenLogoService.getTokenLogo(
        { symbol, address, chainKey },
        logoURI
      )
        .then((url) => {
          if (isMounted) {
            setLogoUrl(url);
            setIsLoading(false);
            if (!url) {
              setHasError(true);
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            setHasError(true);
            setIsLoading(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [symbol, address, chainKey, logoURI, hasError]);

  // Handle image load error
  const handleError = () => {
    setHasError(true);
    setLogoUrl(null);
  };

  // Show placeholder if loading, error, or no logo
  if (isLoading || hasError || !logoUrl) {
    return (
      <div 
        className={`${sizeClass} rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center flex-shrink-0 ${className}`}
      >
        {isLoading ? (
          <div className="w-1/2 h-1/2 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="text-white font-bold" style={{ fontSize: size === 'sm' ? '10px' : size === 'md' ? '14px' : '20px' }}>
            {symbol[0]}
          </span>
        )}
      </div>
    );
  }

  // Render image
  return (
    <img
      src={logoUrl}
      alt={symbol}
      className={`${sizeClass} rounded-full flex-shrink-0 object-cover ${className}`}
      onError={handleError}
    />
  );
}

